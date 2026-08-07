import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import {
  reinitiateOrderPayment,
  releasePaymentClaim,
  type ReinitiatableOrder,
} from "@/lib/checkout/reinitiatePayment";
import { checkoutSchema, type CheckoutInput } from "@/lib/checkout/validation";
import { getActivePrice, getCheckoutVariant } from "@/lib/flutterwave/getActivePrice";
import type { SanityCheckoutProduct } from "@/lib/flutterwave/getActivePrice";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import { sanityFetch } from "@/lib/sanity/fetch";
import { CART_PRICES_QUERY } from "@/lib/sanity/queries";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

async function respondForExistingOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  order: ReinitiatableOrder,
  preferredPayment: CheckoutInput["preferred_payment"]
) {
  if (!["pending_payment", "payment_failed"].includes(order.status)) {
    // Already resolved (e.g. confirmed) — nothing to (re)pay, just hand back
    // the order id so the client can route to the processing/order page.
    return NextResponse.json({ order_id: order.id, payment_link: null });
  }

  const result = await reinitiateOrderPayment(supabase, order, preferredPayment);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ order_id: order.id, payment_link: result.paymentLink });
}

interface CartPriceProduct extends SanityCheckoutProduct {
  images?: Array<{ url?: string | null; alt?: string | null }> | null;
  supplier?: { _id?: string | null; name?: string | null } | null;
  supplierProductId?: string | null;
}

interface PreparedOrderItem {
  catalog_product_id: string;
  product_title: string;
  product_image_url: string | null;
  supplier_id: string | null;
  supplier_product_id: string | null;
  quantity: number;
  unit_price: number;
}

function findProduct(products: CartPriceProduct[], productId: string) {
  return products.find((product) => product._id === productId) ?? null;
}

function getUnavailableItem(
  item: CheckoutInput["cart_items"][number],
  product: CartPriceProduct | null
) {
  if (!product) {
    return { ...item, reason: "Product is no longer available" };
  }

  if (product.status !== "active") {
    return { ...item, title: product.title, reason: "Product is no longer active" };
  }

  if (product.hasVariants) {
    const variant = getCheckoutVariant(product, item.combination_key);

    if (!variant) {
      return { ...item, title: product.title, reason: "Variant is no longer available" };
    }

    if (variant.available === false) {
      return { ...item, title: product.title, reason: "Variant is sold out" };
    }
  }

  return null;
}

function getProductImageUrl(product: CartPriceProduct) {
  return product.images?.[0]?.url || null;
}

function prepareOrderItems(
  body: CheckoutInput,
  products: CartPriceProduct[]
) {
  const orderItems: PreparedOrderItem[] = [];
  let totalAmount = 0;

  for (const item of body.cart_items) {
    const product = findProduct(products, item.catalog_product_id);

    if (!product) {
      continue;
    }

    const variant = getCheckoutVariant(product, item.combination_key);
    const unitPrice = getActivePrice(product, item.combination_key);

    if (unitPrice <= 0) {
      throw new Error(`Invalid price for product: ${product._id}`);
    }

    orderItems.push({
      catalog_product_id: item.catalog_product_id,
      product_title: product.title || "Untitled gift",
      product_image_url: getProductImageUrl(product),
      supplier_id: product.supplier?._id || null,
      supplier_product_id:
        variant?.supplierProductId || product.supplierProductId || null,
      quantity: item.quantity,
      unit_price: unitPrice,
    });
    totalAmount += unitPrice * item.quantity;
  }

  return { orderItems, totalAmount };
}

async function validateWishlistItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  wishlistItemId: string | undefined,
  cartItems: CheckoutInput["cart_items"]
) {
  if (!wishlistItemId) {
    return { ok: true as const };
  }

  const { data, error } = await supabase
    .from("wishlist_items_with_status")
    .select("id, origin, status, catalog_product_id")
    .eq("id", wishlistItemId)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: "Couldn't verify this wishlist item.",
    };
  }

  const item = data as {
    id: string;
    origin: string;
    status: string;
    catalog_product_id: string | null;
  } | null;

  if (!item) {
    return {
      ok: false as const,
      status: 404,
      error: "Wishlist item not found.",
    };
  }

  if (item.origin !== "catalog") {
    return {
      ok: false as const,
      status: 400,
      error: "External gifts do not use checkout.",
    };
  }

  if (item.status !== "available") {
    return {
      ok: false as const,
      status: 409,
      error: "This wishlist item is no longer available.",
    };
  }

  if (
    item.catalog_product_id &&
    !cartItems.some(
      (cartItem) => cartItem.catalog_product_id === item.catalog_product_id
    )
  ) {
    return {
      ok: false as const,
      status: 400,
      error: "Wishlist item does not match the checkout cart.",
    };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();

  if (!idempotencyKey) {
    return jsonError("Missing Idempotency-Key header.", 400);
  }

  const body = await readJson(request);
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check your checkout details and try again.", 400);
  }

  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("orders")
    .select(
      "id, buyer_id, total_amount, currency, status, shipping_email, shipping_name, shipping_phone"
    )
    .eq("idempotency_key", idempotencyKey)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (existingOrderError) {
    return jsonError("Couldn't verify your checkout request.", 500);
  }

  if (existingOrder) {
    return respondForExistingOrder(
      supabase,
      existingOrder as ReinitiatableOrder,
      parsed.data.preferred_payment
    );
  }

  const wishlistValidation = await validateWishlistItem(
    supabase,
    parsed.data.wishlist_item_id,
    parsed.data.cart_items
  );

  if (!wishlistValidation.ok) {
    return jsonError(wishlistValidation.error, wishlistValidation.status);
  }

  const productIds = parsed.data.cart_items.map(
    (item) => item.catalog_product_id
  );
  const products = await sanityFetch<CartPriceProduct[]>(CART_PRICES_QUERY, {
    ids: productIds,
  });
  const unavailableItems = parsed.data.cart_items
    .map((item) => getUnavailableItem(item, findProduct(products, item.catalog_product_id)))
    .filter(Boolean);

  if (unavailableItems.length > 0) {
    return NextResponse.json(
      {
        error: "Some items are no longer available",
        unavailable_items: unavailableItems,
      },
      { status: 400 }
    );
  }

  let prepared: ReturnType<typeof prepareOrderItems>;

  try {
    prepared = prepareOrderItems(parsed.data, products);
  } catch {
    return jsonError("Some items no longer have a valid price.", 400);
  }

  if (prepared.totalAmount <= 0 || prepared.orderItems.length === 0) {
    return jsonError("Cart total must be greater than zero.", 400);
  }

  const shippingName = `${parsed.data.shipping.first_name} ${parsed.data.shipping.last_name}`;
  const shippingAddress = [
    parsed.data.shipping.street_address,
    parsed.data.shipping.apartment,
  ]
    .filter(Boolean)
    .join(", ");

  // orders + order_items are created together in one Postgres transaction
  // (see gifvtme_create_checkout_order, migration 018) — no other request
  // can observe an order that doesn't already have its items, so the
  // existing-order lookups above and below are always safe to act on.
  const { data: createdOrderId, error: createOrderError } = await supabase.rpc(
    "gifvtme_create_checkout_order",
    {
      p_buyer_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_total_amount: prepared.totalAmount,
      p_currency: "NGN",
      p_shipping_name: shippingName,
      p_shipping_email: parsed.data.shipping.email,
      p_shipping_phone: parsed.data.shipping.phone,
      p_shipping_address: shippingAddress,
      p_shipping_city: parsed.data.shipping.city,
      p_shipping_state: parsed.data.shipping.state,
      p_wishlist_item_id: parsed.data.wishlist_item_id ?? null,
      p_order_items: prepared.orderItems,
    }
  );

  if (createOrderError?.code === "23505") {
    // Lost a race with a concurrent request carrying the same key — the
    // winning transaction has already committed both the order and its
    // items by the time this can happen, so it's safe to treat as a
    // normal existing-order replay.
    const { data: raceOrder, error: raceOrderError } = await supabase
      .from("orders")
      .select(
        "id, buyer_id, total_amount, currency, status, shipping_email, shipping_name, shipping_phone"
      )
      .eq("idempotency_key", idempotencyKey)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (raceOrderError || !raceOrder) {
      return jsonError("Couldn't create your order. Try again.", 500);
    }

    return respondForExistingOrder(
      supabase,
      raceOrder as ReinitiatableOrder,
      parsed.data.preferred_payment
    );
  }

  if (createOrderError || !createdOrderId) {
    return jsonError("Couldn't create your order. Try again.", 500);
  }

  const orderId = createdOrderId as string;

  try {
    const payment = await initiateFlutterwavePayment({
      orderId,
      amount: prepared.totalAmount,
      customer: {
        email: parsed.data.shipping.email,
        name: shippingName,
        phone: parsed.data.shipping.phone,
      },
      preferredPayment: parsed.data.preferred_payment,
    });

    if (!payment.ok || !payment.paymentLink) {
      // Keep pending_payment so retry can reuse the traceable order row —
      // but release the claim gifvtme_create_checkout_order took on
      // creation, so an immediate retry isn't blocked as "already in
      // progress" for no reason.
      await releasePaymentClaim(supabase, orderId, user.id);
      return jsonError("Payment couldn't start - try again.", 502);
    }

    return NextResponse.json({
      order_id: orderId,
      payment_link: payment.paymentLink,
    });
  } catch (error) {
    console.error("Flutterwave initiation failed.", error);
    await releasePaymentClaim(supabase, orderId, user.id);
    return jsonError("Payment couldn't start - try again.", 502);
  }
}
