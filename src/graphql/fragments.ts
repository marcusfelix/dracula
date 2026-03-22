export const IMAGE_FRAGMENT = `
  fragment ImageFields on Image {
    id
    url
    altText
    width
    height
  }
`;

export const MONEY_FRAGMENT = `
  fragment MoneyFields on MoneyV2 {
    amount
    currencyCode
  }
`;

export const SEO_FRAGMENT = `
  fragment SEOFields on SEO {
    title
    description
  }
`;

export const VARIANT_FRAGMENT = `
  fragment VariantFields on ProductVariant {
    id
    title
    sku
    availableForSale
    price { ...MoneyFields }
    compareAtPrice { ...MoneyFields }
    image { ...ImageFields }
    selectedOptions { name value }
    requiresShipping
    weight
    weightUnit
    barcode
    currentlyNotInStock
  }
  ${MONEY_FRAGMENT}
  ${IMAGE_FRAGMENT}
`;

export const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    productType
    vendor
    tags
    availableForSale
    createdAt
    updatedAt
    publishedAt
    isGiftCard
    totalInventory
    priceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
    compareAtPriceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
    featuredImage { ...ImageFields }
    images(first: 250) {
      edges {
        node { ...ImageFields }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
    variants(first: 250) {
      edges {
        node { ...VariantFields }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
    options {
      id
      name
      optionValues { name swatch { color } }
    }
    seo { ...SEOFields }
  }
  ${VARIANT_FRAGMENT}
  ${SEO_FRAGMENT}
`;

export const COLLECTION_FRAGMENT = `
  fragment CollectionFields on Collection {
    id
    handle
    title
    description
    descriptionHtml
    image { ...ImageFields }
    seo { ...SEOFields }
    updatedAt
  }
  ${IMAGE_FRAGMENT}
  ${SEO_FRAGMENT}
`;

export const PAGE_FRAGMENT = `
  fragment PageFields on Page {
    id
    handle
    title
    body
    bodySummary
    seo { ...SEOFields }
    createdAt
    updatedAt
  }
  ${SEO_FRAGMENT}
`;

export const ARTICLE_FRAGMENT = `
  fragment ArticleFields on Article {
    id
    handle
    title
    content
    contentHtml
    excerpt
    excerptHtml
    image { ...ImageFields }
    author: authorV2 { name }
    publishedAt
    tags
    seo { ...SEOFields }
    blog { id handle title }
  }
  ${IMAGE_FRAGMENT}
  ${SEO_FRAGMENT}
`;

export const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    createdAt
    updatedAt
    totalQuantity
    note
    attributes { key value }
    discountCodes { code applicable }
    buyerIdentity {
      email
      phone
      countryCode
    }
    cost {
      subtotalAmount { ...MoneyFields }
      totalAmount { ...MoneyFields }
      totalTaxAmount { ...MoneyFields }
      totalDutyAmount { ...MoneyFields }
    }
    lines(first: 250) {
      edges {
        node {
          id
          quantity
          attributes { key value }
          discountAllocations { discountedAmount { ...MoneyFields } }
          cost {
            totalAmount { ...MoneyFields }
            amountPerQuantity { ...MoneyFields }
            compareAtAmountPerQuantity { ...MoneyFields }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
              price { ...MoneyFields }
              compareAtPrice { ...MoneyFields }
              image { ...ImageFields }
              selectedOptions { name value }
              requiresShipping
              product {
                id
                handle
                title
                featuredImage { ...ImageFields }
              }
            }
          }
        }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
  ${MONEY_FRAGMENT}
  ${IMAGE_FRAGMENT}
`;
