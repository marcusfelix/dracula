import {
  PRODUCT_FRAGMENT,
  COLLECTION_FRAGMENT,
  PAGE_FRAGMENT,
  ARTICLE_FRAGMENT,
  CART_FRAGMENT,
  IMAGE_FRAGMENT,
  SEO_FRAGMENT,
  MONEY_FRAGMENT,
  VARIANT_FRAGMENT,
} from "./fragments.js";

// ─── Products ────────────────────────────────────────────────────────────────

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductFields
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const PRODUCT_BY_ID_QUERY = `
  query ProductById($id: ID!) {
    product(id: $id) {
      ...ProductFields
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const PRODUCTS_QUERY = `
  query Products($first: Int, $after: String, $last: Int, $before: String, $sortKey: ProductSortKeys, $reverse: Boolean, $query: String) {
    products(first: $first, after: $after, last: $last, before: $before, sortKey: $sortKey, reverse: $reverse, query: $query) {
      edges {
        node { ...ProductFields }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const PRODUCT_RECOMMENDATIONS_QUERY = `
  query ProductRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) {
      ...ProductFields
    }
  }
  ${PRODUCT_FRAGMENT}
`;

// ─── Collections ─────────────────────────────────────────────────────────────

export const COLLECTION_BY_HANDLE_QUERY = `
  query CollectionByHandle($handle: String!) {
    collection(handle: $handle) {
      ...CollectionFields
    }
  }
  ${COLLECTION_FRAGMENT}
`;

export const COLLECTIONS_QUERY = `
  query Collections($first: Int, $after: String, $last: Int, $before: String, $sortKey: CollectionSortKeys, $reverse: Boolean, $query: String) {
    collections(first: $first, after: $after, last: $last, before: $before, sortKey: $sortKey, reverse: $reverse, query: $query) {
      edges {
        node { ...CollectionFields }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
  ${COLLECTION_FRAGMENT}
`;

export const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts($handle: String!, $first: Int, $after: String, $last: Int, $before: String, $sortKey: ProductCollectionSortKeys, $reverse: Boolean, $filters: [ProductFilter!]) {
    collection(handle: $handle) {
      products(first: $first, after: $after, last: $last, before: $before, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        edges {
          node { ...ProductFields }
          cursor
        }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }
  }
  ${PRODUCT_FRAGMENT}
`;

// ─── Cart ────────────────────────────────────────────────────────────────────

export const CART_QUERY = `
  query Cart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_CREATE_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_LINES_ADD_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_LINES_UPDATE_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_LINES_REMOVE_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_DISCOUNT_CODES_UPDATE_MUTATION = `
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_BUYER_IDENTITY_UPDATE_MUTATION = `
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

export const CART_NOTE_UPDATE_MUTATION = `
  mutation CartNoteUpdate($cartId: ID!, $note: String!) {
    cartNoteUpdate(cartId: $cartId, note: $note) {
      cart { ...CartFields }
      userErrors { field message code }
    }
  }
  ${CART_FRAGMENT}
`;

// ─── Pages ───────────────────────────────────────────────────────────────────

export const PAGE_BY_HANDLE_QUERY = `
  query PageByHandle($handle: String!) {
    page(handle: $handle) {
      ...PageFields
    }
  }
  ${PAGE_FRAGMENT}
`;

export const PAGES_QUERY = `
  query Pages($first: Int, $after: String) {
    pages(first: $first, after: $after) {
      edges {
        node { ...PageFields }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
  ${PAGE_FRAGMENT}
`;

// ─── Blogs / Articles ────────────────────────────────────────────────────────

export const BLOG_BY_HANDLE_QUERY = `
  query BlogByHandle($handle: String!) {
    blog(handle: $handle) {
      id
      handle
      title
      seo { ...SEOFields }
    }
  }
  ${SEO_FRAGMENT}
`;

export const BLOGS_QUERY = `
  query Blogs($first: Int, $after: String) {
    blogs(first: $first, after: $after) {
      edges {
        node {
          id
          handle
          title
          seo { ...SEOFields }
        }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
  ${SEO_FRAGMENT}
`;

export const ARTICLE_BY_HANDLE_QUERY = `
  query ArticleByHandle($blogHandle: String!, $articleHandle: String!) {
    blog(handle: $blogHandle) {
      articleByHandle(handle: $articleHandle) {
        ...ArticleFields
      }
    }
  }
  ${ARTICLE_FRAGMENT}
`;

export const ARTICLES_QUERY = `
  query Articles($blogHandle: String!, $first: Int, $after: String, $sortKey: ArticleSortKeys, $reverse: Boolean, $query: String) {
    blog(handle: $blogHandle) {
      articles(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, query: $query) {
        edges {
          node { ...ArticleFields }
          cursor
        }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }
  }
  ${ARTICLE_FRAGMENT}
`;

// ─── Menu ────────────────────────────────────────────────────────────────────

export const MENU_QUERY = `
  query Menu($handle: String!) {
    menu(handle: $handle) {
      id
      handle
      title
      itemsCount
      items {
        id
        title
        url
        type
        resourceId
        tags
        items {
          id
          title
          url
          type
          resourceId
          tags
          items {
            id
            title
            url
            type
            resourceId
            tags
          }
        }
      }
    }
  }
`;

// ─── Shop ────────────────────────────────────────────────────────────────────

export const SHOP_QUERY = `
  query Shop {
    shop {
      id
      name
      description
      primaryDomain { url host }
      brand {
        logo { ...ImageFields }
        squareLogo { ...ImageFields }
        colors {
          primary { background foreground }
          secondary { background foreground }
        }
        coverImage { ...ImageFields }
      }
      paymentSettings {
        currencyCode
        acceptedCardBrands
        enabledPresentmentCurrencies
      }
      privacyPolicy { id title handle body url }
      refundPolicy { id title handle body url }
      shippingPolicy { id title handle body url }
      termsOfService { id title handle body url }
    }
  }
  ${IMAGE_FRAGMENT}
`;

// ─── Metaobjects ─────────────────────────────────────────────────────────────

export const METAOBJECTS_QUERY = `
  query Metaobjects($type: String!, $first: Int, $after: String) {
    metaobjects(type: $type, first: $first, after: $after) {
      edges {
        node {
          id
          handle
          type
          fields { key value type reference { __typename } }
          updatedAt
        }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
`;

export const METAOBJECT_BY_HANDLE_QUERY = `
  query MetaobjectByHandle($handle: MetaobjectHandleInput!) {
    metaobject(handle: $handle) {
      id
      handle
      type
      fields { key value type reference { __typename } }
      updatedAt
    }
  }
`;

// ─── Search ──────────────────────────────────────────────────────────────────

export const SEARCH_QUERY = `
  query Search($query: String!, $first: Int, $after: String, $types: [SearchType!], $sortKey: SearchSortKeys, $reverse: Boolean) {
    search(query: $query, first: $first, after: $after, types: $types, sortKey: $sortKey, reverse: $reverse) {
      edges {
        node {
          ... on Product { ...ProductFields }
        }
        cursor
      }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      totalCount
    }
  }
  ${PRODUCT_FRAGMENT}
`;

export const PREDICTIVE_SEARCH_QUERY = `
  query PredictiveSearch($query: String!, $limit: Int, $types: [PredictiveSearchType!]) {
    predictiveSearch(query: $query, limit: $limit, types: $types) {
      products { ...ProductFields }
      collections { ...CollectionFields }
      pages { ...PageFields }
      articles { ...ArticleFields }
      queries { text styledText }
    }
  }
  ${PRODUCT_FRAGMENT}
  ${COLLECTION_FRAGMENT}
  ${PAGE_FRAGMENT}
  ${ARTICLE_FRAGMENT}
`;
