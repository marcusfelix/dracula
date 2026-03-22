// ─── Money ───────────────────────────────────────────────────────────────────

export interface ShopifyMoneyV2 {
  amount: string;
  currencyCode: string;
}

// ─── Media / Images ──────────────────────────────────────────────────────────

export interface ShopifyImage {
  id: string | null;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

// ─── Connection Pattern ──────────────────────────────────────────────────────

export interface ShopifyPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface ShopifyEdge<T> {
  node: T;
  cursor: string;
}

export interface ShopifyConnection<T> {
  edges: ShopifyEdge<T>[];
  pageInfo: ShopifyPageInfo;
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export interface ShopifySEO {
  title: string | null;
  description: string | null;
}

// ─── Metafield ───────────────────────────────────────────────────────────────

export interface ShopifyMetafield {
  id: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
  reference: unknown | null;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyProductOptionValue {
  name: string;
  swatch: { color: string | null } | null;
}

export interface ShopifyProductOption {
  id: string;
  name: string;
  optionValues: ShopifyProductOptionValue[];
}

export interface ShopifyProductVariant {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: ShopifyMoneyV2;
  compareAtPrice: ShopifyMoneyV2 | null;
  image: ShopifyImage | null;
  selectedOptions: ShopifySelectedOption[];
  requiresShipping: boolean;
  weight: number | null;
  weightUnit: "KILOGRAMS" | "GRAMS" | "POUNDS" | "OUNCES";
  barcode: string | null;
  currentlyNotInStock: boolean;
}

export interface ShopifyProductPriceRange {
  minVariantPrice: ShopifyMoneyV2;
  maxVariantPrice: ShopifyMoneyV2;
}

export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  tags: string[];
  availableForSale: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  priceRange: ShopifyProductPriceRange;
  compareAtPriceRange: ShopifyProductPriceRange;
  images: ShopifyConnection<ShopifyImage>;
  variants: ShopifyConnection<ShopifyProductVariant>;
  options: ShopifyProductOption[];
  metafields: ShopifyMetafield[];
  seo: ShopifySEO;
  featuredImage: ShopifyImage | null;
  isGiftCard: boolean;
  totalInventory: number | null;
}

// ─── Collection ──────────────────────────────────────────────────────────────

export interface ShopifyCollection {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  image: ShopifyImage | null;
  seo: ShopifySEO;
  updatedAt: string;
  products?: ShopifyConnection<ShopifyProduct>;
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface ShopifyCartLineItem {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      id: string;
      handle: string;
      title: string;
      featuredImage: ShopifyImage | null;
    };
    price: ShopifyMoneyV2;
    compareAtPrice: ShopifyMoneyV2 | null;
    image: ShopifyImage | null;
    selectedOptions: ShopifySelectedOption[];
    requiresShipping: boolean;
  };
  cost: {
    totalAmount: ShopifyMoneyV2;
    amountPerQuantity: ShopifyMoneyV2;
    compareAtAmountPerQuantity: ShopifyMoneyV2 | null;
  };
  attributes: ShopifyAttribute[];
  discountAllocations: ShopifyDiscountAllocation[];
}

export interface ShopifyAttribute {
  key: string;
  value: string | null;
}

export interface ShopifyDiscountAllocation {
  discountedAmount: ShopifyMoneyV2;
}

export interface ShopifyCartCost {
  subtotalAmount: ShopifyMoneyV2;
  totalAmount: ShopifyMoneyV2;
  totalTaxAmount: ShopifyMoneyV2 | null;
  totalDutyAmount: ShopifyMoneyV2 | null;
}

export interface ShopifyCartDiscountCode {
  code: string;
  applicable: boolean;
}

export interface ShopifyCartBuyerIdentity {
  email: string | null;
  phone: string | null;
  countryCode: string | null;
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  createdAt: string;
  updatedAt: string;
  totalQuantity: number;
  lines: ShopifyConnection<ShopifyCartLineItem>;
  cost: ShopifyCartCost;
  discountCodes: ShopifyCartDiscountCode[];
  buyerIdentity: ShopifyCartBuyerIdentity;
  note: string | null;
  attributes: ShopifyAttribute[];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export interface ShopifyPage {
  id: string;
  handle: string;
  title: string;
  body: string;
  bodySummary: string;
  seo: ShopifySEO;
  createdAt: string;
  updatedAt: string;
}

// ─── Blog / Article ──────────────────────────────────────────────────────────

export interface ShopifyArticleAuthor {
  name: string;
}

export interface ShopifyArticle {
  id: string;
  handle: string;
  title: string;
  content: string;
  contentHtml: string;
  excerpt: string | null;
  excerptHtml: string | null;
  image: ShopifyImage | null;
  author: ShopifyArticleAuthor;
  publishedAt: string;
  tags: string[];
  seo: ShopifySEO;
  blog: { id: string; handle: string; title: string };
}

export interface ShopifyBlog {
  id: string;
  handle: string;
  title: string;
  seo: ShopifySEO;
  articles?: ShopifyConnection<ShopifyArticle>;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export interface ShopifyMenuItem {
  id: string;
  title: string;
  url: string;
  type: string;
  resourceId: string | null;
  items: ShopifyMenuItem[];
  tags: string[];
}

export interface ShopifyMenu {
  id: string;
  handle: string;
  title: string;
  items: ShopifyMenuItem[];
  itemsCount: number;
}

// ─── Shop ────────────────────────────────────────────────────────────────────

export interface ShopifyShopPolicy {
  id: string;
  title: string;
  handle: string;
  body: string;
  url: string;
}

export interface ShopifyShop {
  id: string;
  name: string;
  description: string;
  primaryDomain: {
    url: string;
    host: string;
  };
  brand: {
    logo: ShopifyImage | null;
    squareLogo: ShopifyImage | null;
    colors: {
      primary: { background: string; foreground: string }[];
      secondary: { background: string; foreground: string }[];
    };
    coverImage: ShopifyImage | null;
  } | null;
  paymentSettings: {
    currencyCode: string;
    acceptedCardBrands: string[];
    enabledPresentmentCurrencies: string[];
  };
  privacyPolicy: ShopifyShopPolicy | null;
  refundPolicy: ShopifyShopPolicy | null;
  shippingPolicy: ShopifyShopPolicy | null;
  termsOfService: ShopifyShopPolicy | null;
}

// ─── Metaobject ──────────────────────────────────────────────────────────────

export interface ShopifyMetaobjectField {
  key: string;
  value: string | null;
  type: string;
  reference: unknown | null;
}

export interface ShopifyMetaobject {
  id: string;
  handle: string;
  type: string;
  fields: ShopifyMetaobjectField[];
  updatedAt: string;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface ShopifySearchResult {
  products: ShopifyConnection<ShopifyProduct>;
}

export interface ShopifyPredictiveSearchResult {
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  pages: ShopifyPage[];
  articles: ShopifyArticle[];
  queries: { text: string; styledText: string }[];
}

// ─── Connection Type Aliases ─────────────────────────────────────────────────

export type ShopifyProductConnection = ShopifyConnection<ShopifyProduct>;
export type ShopifyProductVariantConnection =
  ShopifyConnection<ShopifyProductVariant>;
export type ShopifyCollectionConnection =
  ShopifyConnection<ShopifyCollection>;
export type ShopifyCartLineConnection =
  ShopifyConnection<ShopifyCartLineItem>;
export type ShopifyImageConnection = ShopifyConnection<ShopifyImage>;
export type ShopifyArticleConnection = ShopifyConnection<ShopifyArticle>;

// ─── Param Types ─────────────────────────────────────────────────────────────

export type ProductSortKey =
  | "TITLE"
  | "PRICE"
  | "CREATED_AT"
  | "BEST_SELLING"
  | "RELEVANCE"
  | "UPDATED_AT"
  | "ID"
  | "PRODUCT_TYPE"
  | "VENDOR";

export type CollectionSortKey = "TITLE" | "UPDATED_AT" | "ID" | "RELEVANCE";

export type ArticleSortKey =
  | "TITLE"
  | "PUBLISHED_AT"
  | "BLOG_TITLE"
  | "AUTHOR"
  | "ID"
  | "RELEVANCE";

export interface PaginationParams {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface ProductListParams extends PaginationParams {
  sortKey?: ProductSortKey;
  reverse?: boolean;
  query?: string;
}

export interface CollectionListParams extends PaginationParams {
  sortKey?: CollectionSortKey;
  reverse?: boolean;
  query?: string;
}

export interface ArticleListParams extends PaginationParams {
  sortKey?: ArticleSortKey;
  reverse?: boolean;
  query?: string;
}

export interface CollectionProductsParams extends PaginationParams {
  sortKey?: ProductSortKey;
  reverse?: boolean;
  filters?: Record<string, unknown>[];
}

export interface SearchParams extends PaginationParams {
  query: string;
  types?: ("PRODUCT" | "PAGE" | "ARTICLE")[];
  sortKey?: "RELEVANCE" | "PRICE";
  reverse?: boolean;
}

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
  attributes?: ShopifyAttribute[];
}

export interface CartLineUpdateInput {
  id: string;
  merchandiseId?: string;
  quantity?: number;
  attributes?: ShopifyAttribute[];
}

export interface CartCreateInput {
  lines?: CartLineInput[];
  note?: string;
  attributes?: ShopifyAttribute[];
  buyerIdentity?: Partial<ShopifyCartBuyerIdentity>;
  discountCodes?: string[];
}

export interface MetafieldIdentifier {
  namespace: string;
  key: string;
}
