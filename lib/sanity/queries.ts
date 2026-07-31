import { defineQuery } from "next-sanity";

export const PRODUCT_CARD_FRAGMENT = /* groq */ `
  _id,
  "id": _id,
  "catalogProductId": _id,
  title,
  "slug": slug.current,
  "subtitle": shortDescription,
  "imageUrl": images[0].asset->url,
  "price": coalesce(basePrice, variants[0].price),
  compareAtPrice,
  salePrice,
  saleStartTime,
  saleEndTime,
  supplierProductId,
  hasVariants,
  featured,
  status,
  "occasionTypes": collections[]->occasion->occasionType,
  "createdAt": _createdAt,
  _createdAt
`;

export const PRODUCT_FULL_FRAGMENT = /* groq */ `
  ${PRODUCT_CARD_FRAGMENT},
  shortDescription,
  description,
  "images": images[]{
    _key,
    alt,
    "url": asset->url
  },
  baseSku,
  category,
  "tags": coalesce(tags, []),
  estimatedDeliveryDays,
  "attributes": attributes[]{
    _key,
    name,
    label,
    "options": options[]{
      _key,
      label,
      value,
      colorHex
    }
  },
  "variants": variants[]{
    _key,
    combinationKey,
    "options": options[]{
      _key,
      attribute,
      value
    },
    price,
    compareAtPrice,
    sku,
    supplierSku,
    supplierProductId,
    "available": coalesce(available, true),
    "imageUrl": image.asset->url
  },
  "collections": collections[]->{
    _id,
    "id": _id,
    title,
    "slug": slug.current,
    description,
    featured,
    "coverImageUrl": coverImage.asset->url,
    "itemCount": count(*[_type == "product" && status == "active" && references(^._id)]),
    occasion->{
      _id,
      "id": _id,
      title,
      "slug": slug.current,
      emoji,
      occasionType
    }
  }
`;

export const OCCASIONS_QUERY = defineQuery(/* groq */ `
  *[_type == "occasion" && status == "active"]
  | order(orderRank asc, title asc) {
    _id,
    "id": _id,
    title,
    "slug": slug.current,
    description,
    emoji,
    occasionType,
    featured,
    "coverImageUrl": coverImage.asset->url,
    "collectionCount": count(*[_type == "collection" && status == "active" && occasion._ref == ^._id]),
    "itemCount": count(*[_type == "product" && status == "active" && references(^._id)])
  }
`);

export const FEATURED_PRODUCTS_QUERY = defineQuery(/* groq */ `
  *[_type == "product" && status == "active" && featured == true]
  | order(_createdAt desc) [0...$limit] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const NEW_PRODUCTS_QUERY = defineQuery(/* groq */ `
  *[_type == "product" && status == "active"]
  | order(_createdAt desc) [0...$limit] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const FLASH_SALE_PRODUCTS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "product" &&
    status == "active" &&
    defined(salePrice) &&
    salePrice > 0 &&
    defined(saleStartTime) &&
    defined(saleEndTime) &&
    dateTime(saleStartTime) <= dateTime($now) &&
    dateTime(saleEndTime) > dateTime($now)
  ]
  | order(saleEndTime asc) [0...$limit] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const OCCASION_PAGE_QUERY = defineQuery(/* groq */ `
  *[_type == "occasion" && status == "active" && slug.current == $slug][0] {
    _id,
    "id": _id,
    title,
    "slug": slug.current,
    description,
    emoji,
    occasionType,
    featured,
    "coverImageUrl": coverImage.asset->url,
    "collectionCount": count(*[_type == "collection" && status == "active" && occasion._ref == ^._id]),
    "itemCount": count(*[_type == "product" && status == "active" && references(^._id)]),
    "collections": *[_type == "collection" && status == "active" && occasion._ref == ^._id]
      | order(featured desc, title asc) {
        _id,
        "id": _id,
        title,
        "slug": slug.current,
        description,
        featured,
        "coverImageUrl": coverImage.asset->url,
        "itemCount": count(*[_type == "product" && status == "active" && references(^._id)])
      }
  }
`);

export const COLLECTION_PAGE_QUERY = defineQuery(/* groq */ `
  *[_type == "collection" && status == "active" && slug.current == $slug][0] {
    _id,
    "id": _id,
    title,
    "slug": slug.current,
    description,
    featured,
    "coverImageUrl": coverImage.asset->url,
    occasion->{
      _id,
      "id": _id,
      title,
      "slug": slug.current,
      emoji,
      occasionType
    },
    "totalProducts": count(*[_type == "product" && status == "active" && references(^._id)]),
    "products": *[_type == "product" && status == "active" && references(^._id)]
      | order(featured desc, _createdAt desc) [$offset...$offset + $limit] {
        ${PRODUCT_CARD_FRAGMENT}
      }
  }
`);

export const COLLECTION_PRODUCTS_QUERY = defineQuery(/* groq */ `
  *[_type == "collection" && status == "active" && slug.current == $slug][0] {
    "totalProducts": count(*[_type == "product" && status == "active" && references(^._id)]),
    "products": *[_type == "product" && status == "active" && references(^._id)]
      | order(featured desc, _createdAt desc) [$offset...$offset + $limit] {
        ${PRODUCT_CARD_FRAGMENT}
      }
  }
`);

export const SHOP_PRODUCTS_QUERY = defineQuery(/* groq */ `
  *[_type == "product" && status == "active"]
  | order(featured desc, _createdAt desc) [$offset...$offset + $limit] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const SHOP_PRODUCTS_COUNT_QUERY = defineQuery(/* groq */ `
  count(*[_type == "product" && status == "active"])
`);

export const PRODUCT_SEARCH_QUERY = defineQuery(/* groq */ `
  *[
    _type == "product" &&
    status == "active" &&
    (
      title match $term ||
      shortDescription match $term ||
      category match $term ||
      $query in tags[]
    )
  ]
  | order(featured desc, _createdAt desc) [0...48] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const PRODUCT_PAGE_QUERY = defineQuery(/* groq */ `
  *[_type == "product" && status == "active" && slug.current == $slug][0] {
    ${PRODUCT_FULL_FRAGMENT}
  }
`);

export const PRODUCT_BY_ID_QUERY = defineQuery(/* groq */ `
  *[_type == "product" && status == "active" && _id == $id][0] {
    ${PRODUCT_FULL_FRAGMENT}
  }
`);

export const RELATED_PRODUCTS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "product" &&
    status == "active" &&
    _id != $productId &&
    count(collections[_ref in $collectionIds]) > 0
  ]
  | order(featured desc, _createdAt desc) [0...4] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const CART_PRICES_QUERY = defineQuery(/* groq */ `
  *[_type == "product" && _id in $ids] {
    _id,
    title,
    status,
    hasVariants,
    basePrice,
    "baseCompareAtPrice": compareAtPrice,
    baseSku,
    salePrice,
    saleStartTime,
    saleEndTime,
    "variants": variants[] {
      combinationKey,
      price,
      compareAtPrice,
      supplierSku,
      supplierProductId,
      "available": coalesce(available, true)
    },
    "images": images[0..0] {
      asset,
      hotspot,
      alt,
      "url": asset->url
    },
    "imageUrl": images[0].asset->url,
    "supplier": supplier-> { _id, name },
    supplierProductId,
    "collectionIds": collections[]._ref,
    "occasionTypes": collections[]->occasion->occasionType
  }
`);

export const CART_RECOMMENDATIONS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "product" &&
    status == "active" &&
    !(_id in $excludeIds) &&
    count(collections[_ref in $collectionIds]) > 0
  ]
  | order(featured desc, _createdAt desc) [0...$limit] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);

export const CART_FALLBACK_RECOMMENDATIONS_QUERY = defineQuery(/* groq */ `
  *[
    _type == "product" &&
    status == "active" &&
    !(_id in $excludeIds)
  ]
  | order(featured desc, _createdAt desc) [0...$limit] {
    ${PRODUCT_CARD_FRAGMENT}
  }
`);
