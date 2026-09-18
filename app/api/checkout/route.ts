import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import {
  reinitiateOrderPayment,
  releasePaymentClaim,
  type ReinitiatableOrder,
} from "@/lib/checkout/reinitiatePayment";
import {
  checkoutSchema,
  giftCheckoutSchema,
  type CheckoutInput,
  type GiftCheckoutInput,
} from "@/lib/checkout/validation";
import { getActivePrice, getCheckoutVariant } from "@/lib/flutterwave/getActivePrice";
import type { SanityCheckoutProduct } from "@/lib/flutterwave/getActivePrice";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import {
  beginGiftCheckout,
  getActiveClaimForProduct,
} from "@/lib/gift/server";
import { sanityFetch } from "@/lib/sanity/fetch";
import { CART_PRICES_QUERY } from "@/lib/sanity/queries";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface CheckoutOrder extends ReinitiatableOrder {
  price_changes: PriceChange[];
}

const CHECKOUT_ORDER_SELECT =
  "id, buyer_id, total_amount, currency, status, shipping_email, shipping_name, shipping_phone, price_changes";

async function respondForExistingOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  order: CheckoutOrder,
  preferredPayment: CheckoutInput["preferred_payment"]
) {
  const priceChanges = order.price_changes;
  const response = {
    order_id: order.id,
    price_changed: priceChanges.length > 0,
    price_changes: priceChanges,
  };
  if (!["pending_payment", "payment_failed"].includes(order.status)) {
    // Already resolved (e.g. confirmed) — nothing to (re)pay, just hand back
    // the order id so the client can route to the processing/order page.
    return NextResponse.json({ ...response, payment_link: null });
  }

  const result = await reinitiateOrderPayment(supabase, order, preferredPayment);

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json({ ...response, payment_link: result.paymentLink });
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
  display_price: number;
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

interface PriceChange {
  title: string;
  old_price: number;
  new_price: number;
}

function prepareOrderItems(
  cartItems: CheckoutInput["cart_items"],
  products: CartPriceProduct[]
) {
  const orderItems: PreparedOrderItem[] = [];
  const priceChanges: PriceChange[] = [];
  let totalAmount = 0;

  for (const item of cartItems) {
    const product = findProduct(products, item.catalog_product_id);

    if (!product) {
      continue;
    }

    const variant = getCheckoutVariant(product, item.combination_key);
    const unitPrice = getActivePrice(product, item.combination_key);

    if (unitPrice <= 0) {
      throw new Error(`Invalid price for product: ${product._id}`);
    }

    // 18-FLASH-SALES.md Edge Case #2: the client's display_price reflects
    // whatever was last shown (possibly before a flash sale ended between
    // page load and submit). The order is always created at the correct
    // server-computed unitPrice regardless — this just tells the client
    // when to warn the buyer before redirecting to payment.
    if (unitPrice !== item.display_price) {
      priceChanges.push({
        title: product.title || "Untitled gift",
        old_price: item.display_price,
        new_price: unitPrice,
      });
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
      display_price: item.display_price,
    });
    totalAmount += unitPrice * item.quantity;
  }

  return { orderItems, totalAmount, priceChanges };
}

interface GiftOrderBinding {
  claim_id: string;
  wishlist_id: string;
  wishlist_item_id: string;
}

/**
 * Works out which wishlist item a gift order is for, using only the
 * session and the cart.
 *
 * The shape check comes first and is strict on purpose: a gift order is
 * exactly one line at quantity one, matching the item that was claimed.
 * Anything else is refused before an order exists (spec AC-27).
 */
async function bindGiftOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cartItems: CheckoutInput["cart_items"]
): Promise<
  | { ok: true; binding: GiftOrderBinding }
  | { ok: false; status: number; error: string }
> {
  if (cartItems.length !== 1 || cartItems[0].quantity !== 1) {
    return {
      ok: false,
      status: 400,
      error: "A gift is bought one at a time.",
    };
  }

  const claim = await getActiveClaimForProduct(
    supabase,
    cartItems[0].catalog_product_id
  );

  if (!claim) {
    return {
      ok: false,
      status: 409,
      error: "Reserve this gift before buying it.",
    };
  }

  // Take the checkout hold. Idempotent: reopening checkout hands back the
  // existing deadline rather than granting another hour, and the 72 hour
  // reservation deadline underneath is never extended.
  const held = await beginGiftCheckout(supabase, claim.wishlist_item_id);

  if (!held.ok) {
    return { ok: false, status: held.status, error: held.error };
  }

  return {
    ok: true,
    binding: {
      claim_id: claim.claim_id,
      wishlist_id: claim.wishlist_id,
      wishlist_item_id: claim.wishlist_item_id,
    },
  };
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
  // A gift and a self purchase are different shapes, not one shape with
  // optional fields: a gift carries the buyer's contact and no address,
  // because the destination belongs to somebody else and is resolved on
  // the server.
  const isGiftOrder =
    typeof body === "object" &&
    body !== null &&
    (body as { order_source?: unknown }).order_source === "wishlist";

  const parsed = isGiftOrder
    ? giftCheckoutSchema.safeParse(body)
    : checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check your checkout details and try again.", 400);
  }

  const contact = isGiftOrder
    ? (parsed.data as GiftCheckoutInput).contact
    : (parsed.data as CheckoutInput).shipping;
  const giftMessage = isGiftOrder
    ? ((parsed.data as GiftCheckoutInput).gift_message ?? null)
    : null;

  const { data: existingOrder, error: existingOrderError } = await supabase
    .from("orders")
    .select(CHECKOUT_ORDER_SELECT)
    .eq("idempotency_key", idempotencyKey)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (existingOrderError) {
    return jsonError("Couldn't verify your checkout request.", 500);
  }

  if (existingOrder) {
    return respondForExistingOrder(
      supabase,
      existingOrder as CheckoutOrder,
      parsed.data.preferred_payment
    );
  }

  let giftBinding: GiftOrderBinding | null = null;

  if (isGiftOrder) {
    const bound = await bindGiftOrder(supabase, parsed.data.cart_items);

    if (!bound.ok) {
      return jsonError(bound.error, bound.status);
    }

    giftBinding = bound.binding;
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
    prepared = prepareOrderItems(parsed.data.cart_items, products);
  } catch {
    return jsonError("Some items no longer have a valid price.", 400);
  }

  if (prepared.totalAmount <= 0 || prepared.orderItems.length === 0) {
    return jsonError("Cart total must be greater than zero.", 400);
  }

  const shippingName = `${contact.first_name} ${contact.last_name}`;
  // A gift order stores no address at all until the recipient's
  // destination exists. Inventing one is explicitly refused by AC-25.
  const shippingAddress = isGiftOrder
    ? null
    : [
        (parsed.data as CheckoutInput).shipping.street_address,
        (parsed.data as CheckoutInput).shipping.apartment,
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
      p_shipping_email: contact.email,
      p_shipping_phone: contact.phone,
      p_shipping_address: shippingAddress,
      p_shipping_city: isGiftOrder ? null : (parsed.data as CheckoutInput).shipping.city,
      p_shipping_state: isGiftOrder ? null : (parsed.data as CheckoutInput).shipping.state,
      p_wishlist_item_id: giftBinding?.wishlist_item_id ?? null,
      p_order_items: prepared.orderItems,
      p_order_source: parsed.data.order_source,
      p_gift_claim_id: giftBinding?.claim_id ?? null,
      p_recipient_wishlist_id: giftBinding?.wishlist_id ?? null,
      p_gift_message: giftMessage,
      p_surprise_preference: null,
      p_delivery_window_start: null,
      p_delivery_window_end: null,
      // Slice 1 of spec 0002 runs the AC-25 path: the owner has no stored
      // destination yet, so payment completes and the order is held for
      // fulfilment rather than failing or inventing an address. Slice 2
      // replaces this with the real destination snapshot.
      p_fulfilment_blocked_reason: isGiftOrder ? "needs_recipient_address" : null,
      p_recipient_destination_snapshot: null,
    }
  );

  if (createOrderError?.code === "23505") {
    // Lost a race with a concurrent request carrying the same key — the
    // winning transaction has already committed both the order and its
    // items by the time this can happen, so it's safe to treat as a
    // normal existing-order replay.
    const { data: raceOrder, error: raceOrderError } = await supabase
      .from("orders")
      .select(CHECKOUT_ORDER_SELECT)
      .eq("idempotency_key", idempotencyKey)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (raceOrderError || !raceOrder) {
      return jsonError("Couldn't create your order. Try again.", 500);
    }

    return respondForExistingOrder(
      supabase,
      raceOrder as CheckoutOrder,
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
        email: contact.email,
        name: shippingName,
        phone: contact.phone,
      },
      preferredPayment: parsed.data.preferred_payment,
    });

    if (!payment.ok || !payment.paymentLink) {
      console.error("Flutterwave initiation rejected.", {
        orderId,
        error: payment.error,
      });
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
      price_changed: prepared.priceChanges.length > 0,
      price_changes: prepared.priceChanges,
    });
  } catch (error) {
    console.error("Flutterwave initiation failed.", error);
    await releasePaymentClaim(supabase, orderId, user.id);
    return jsonError("Payment couldn't start - try again.", 502);
  }
}
