import type {
  ShopifyProduct,
  ShopifyCollection,
  ShopifyCart,
  ShopifyPage,
  ShopifyBlog,
  ShopifyArticle,
  ShopifyMenu,
  ShopifyShop,
  ShopifyMetaobject,
  ShopifyConnection,
  ShopifyPredictiveSearchResult,
  ProductListParams,
  CollectionListParams,
  CollectionProductsParams,
  ArticleListParams,
  SearchParams,
  CartCreateInput,
  CartLineInput,
  CartLineUpdateInput,
  ShopifyCartBuyerIdentity,
  PaginationParams,
} from "../types.js";

export interface ProductsNamespace {
  get(params: { handle: string }): Promise<ShopifyProduct>;
  getById(params: { id: string }): Promise<ShopifyProduct>;
  list(params?: ProductListParams): Promise<ShopifyConnection<ShopifyProduct>>;
  search(params: SearchParams): Promise<ShopifyConnection<ShopifyProduct>>;
  getRecommendations(params: {
    productId: string;
  }): Promise<ShopifyProduct[]>;
}

export interface CollectionsNamespace {
  get(params: { handle: string }): Promise<ShopifyCollection>;
  list(
    params?: CollectionListParams
  ): Promise<ShopifyConnection<ShopifyCollection>>;
  getProducts(params: {
    handle: string;
    params?: CollectionProductsParams;
  }): Promise<ShopifyConnection<ShopifyProduct>>;
}

export interface CartNamespace {
  create(params?: CartCreateInput): Promise<ShopifyCart>;
  get(params: { cartId: string }): Promise<ShopifyCart>;
  addLines(params: {
    cartId: string;
    lines: CartLineInput[];
  }): Promise<ShopifyCart>;
  updateLines(params: {
    cartId: string;
    lines: CartLineUpdateInput[];
  }): Promise<ShopifyCart>;
  removeLines(params: {
    cartId: string;
    lineIds: string[];
  }): Promise<ShopifyCart>;
  updateDiscountCodes(params: {
    cartId: string;
    discountCodes: string[];
  }): Promise<ShopifyCart>;
  updateBuyerIdentity(params: {
    cartId: string;
    buyerIdentity: Partial<ShopifyCartBuyerIdentity>;
  }): Promise<ShopifyCart>;
  updateNote(params: {
    cartId: string;
    note: string;
  }): Promise<ShopifyCart>;
}

export interface ContentNamespace {
  getPage(params: { handle: string }): Promise<ShopifyPage>;
  listPages(params?: PaginationParams): Promise<ShopifyConnection<ShopifyPage>>;
  getBlog(params: { handle: string }): Promise<ShopifyBlog>;
  listBlogs(params?: PaginationParams): Promise<ShopifyConnection<ShopifyBlog>>;
  getArticle(params: {
    blogHandle: string;
    articleHandle: string;
  }): Promise<ShopifyArticle>;
  listArticles(params: {
    blogHandle: string;
    params?: ArticleListParams;
  }): Promise<ShopifyConnection<ShopifyArticle>>;
  getMenu(params: { handle: string }): Promise<ShopifyMenu>;
}

export interface MetaobjectsNamespace {
  get(params: { type: string; handle: string }): Promise<ShopifyMetaobject>;
  list(params: {
    type: string;
    first?: number;
    after?: string;
  }): Promise<ShopifyConnection<ShopifyMetaobject>>;
}

export interface SEONamespace {
  getShop(): Promise<ShopifyShop>;
}

export interface SearchNamespace {
  search(params: SearchParams): Promise<ShopifyConnection<ShopifyProduct>>;
  predictive(params: {
    query: string;
    limit?: number;
    types?: ("PRODUCT" | "COLLECTION" | "PAGE" | "ARTICLE" | "QUERY")[];
  }): Promise<ShopifyPredictiveSearchResult>;
}

export interface DraculaProvider {
  products: ProductsNamespace;
  collections: CollectionsNamespace;
  cart: CartNamespace;
  content: ContentNamespace;
  metaobjects: MetaobjectsNamespace;
  seo: SEONamespace;
  search: SearchNamespace;
}
