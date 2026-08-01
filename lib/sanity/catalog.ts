import type {
  MuseumCollection,
  MuseumOccasion,
  ProductCardData,
  ProductFullData,
  ProductVariant,
} from "@/lib/sanity/types";

const NEW_PRODUCT_WINDOW_DAYS = 14;

type RawProduct = Partial<ProductFullData> & {
  id?: string;
  _id?: string;
  catalogProductId?: string;
  _createdAt?: string;
  salePrice?: number | null;
  saleStartTime?: string | null;
  saleEndTime?: string | null;
  compareAtPrice?: number | null;
  price?: number | null;
};

export function isFlashSaleActive(
  product: {
    salePrice?: number | null;
    saleStartTime?: string | null;
    saleEndTime?: string | null;
  },
  now = new Date()
) {
  if (!product.salePrice || !product.saleStartTime || !product.saleEndTime) {
    return false;
  }

  const start = new Date(product.saleStartTime);
  const end = new Date(product.saleEndTime);

  return start <= now && end > now;
}

const MIN_SEARCH_QUERY_LENGTH = 2;

export function sanitizeSearchQuery(raw: string) {
  return raw.replace(/["*\\]/g, "").trim();
}

export function isSearchableQuery(query: string) {
  return query.length >= MIN_SEARCH_QUERY_LENGTH;
}

export function isProductNew(createdAt?: string | null, now = new Date()) {
  if (!createdAt) {
    return false;
  }

  const created = new Date(createdAt);
  const ageMs = now.getTime() - created.getTime();

  return ageMs >= 0 && ageMs <= NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function getProductDisplayPrice(
  product: RawProduct | ProductVariant,
  now = new Date()
) {
  const basePrice = product.price ?? null;

  if ("salePrice" in product && isFlashSaleActive(product, now)) {
    const salePrice =
      product.salePrice != null && basePrice != null
        ? Math.min(product.salePrice, basePrice)
        : (product.salePrice ?? basePrice);

    return {
      price: salePrice,
      compareAtPrice: basePrice ?? product.compareAtPrice ?? null,
      isOnFlashSale: true,
      saleEndTime: product.saleEndTime ?? null,
    };
  }

  return {
    price: basePrice,
    compareAtPrice: product.compareAtPrice ?? null,
    isOnFlashSale: false,
    saleEndTime: null,
  };
}

export function normalizeProductCard(product: RawProduct): ProductCardData {
  const display = getProductDisplayPrice(product);
  const id = product.id || product._id || product.catalogProductId || "";

  return {
    id,
    catalogProductId: product.catalogProductId || id,
    slug: product.slug || id,
    title: product.title || "Untitled gift",
    subtitle: product.subtitle || product.shortDescription || null,
    imageUrl: product.imageUrl || product.images?.[0]?.url || null,
    price: display.price,
    compareAtPrice: display.compareAtPrice,
    supplierProductId: product.supplierProductId || null,
    hasVariants: Boolean(product.hasVariants),
    createdAt: product.createdAt || product._createdAt || null,
    occasionTypes: product.occasionTypes || [],
    isNew: isProductNew(product._createdAt),
    isOnFlashSale: display.isOnFlashSale,
    saleEndTime: display.saleEndTime,
  };
}

export function normalizeProductCards(products: RawProduct[] = []) {
  return products.map(normalizeProductCard).filter((product) => product.id);
}

export function normalizeProductFull(product: RawProduct): ProductFullData {
  const card = normalizeProductCard(product);

  return {
    ...card,
    status: product.status || null,
    description: product.description || null,
    shortDescription: product.shortDescription || product.subtitle || null,
    images: product.images?.length
      ? product.images
      : product.imageUrl
        ? [{ url: product.imageUrl, alt: product.title || "Product image" }]
        : [],
    baseSku: product.baseSku || null,
    category: product.category || null,
    tags: product.tags || [],
    estimatedDeliveryDays: product.estimatedDeliveryDays || null,
    attributes: product.attributes || [],
    variants: product.variants || [],
    collections: product.collections || [],
  };
}

export function normalizeOccasion(occasion: Partial<MuseumOccasion>) {
  return {
    id: occasion.id || "",
    title: occasion.title || "Untitled occasion",
    slug: occasion.slug || occasion.id || "",
    description: occasion.description || null,
    emoji: occasion.emoji || "🎁",
    occasionType: occasion.occasionType || null,
    coverImageUrl: occasion.coverImageUrl || null,
    collectionCount: occasion.collectionCount || 0,
    itemCount: occasion.itemCount || occasion.collectionCount || 0,
    featured: Boolean(occasion.featured),
  } satisfies MuseumOccasion;
}

export function normalizeCollection(collection: Partial<MuseumCollection>) {
  return {
    id: collection.id || "",
    title: collection.title || "Untitled collection",
    slug: collection.slug || collection.id || "",
    description: collection.description || null,
    coverImageUrl: collection.coverImageUrl || null,
    featured: Boolean(collection.featured),
    itemCount: collection.itemCount || 0,
    occasion: collection.occasion || null,
  } satisfies MuseumCollection;
}
