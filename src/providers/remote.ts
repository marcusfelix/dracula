import { createStorefrontApiClient } from "@shopify/storefront-api-client";
import type { DraculaConfig } from "../config.js";
import {
  DraculaNetworkError,
  DraculaNotFoundError,
  DraculaUserError,
} from "../errors.js";
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
import type {
  DraculaProvider,
  ProductsNamespace,
  CollectionsNamespace,
  CartNamespace,
  ContentNamespace,
  MetaobjectsNamespace,
  SEONamespace,
  SearchNamespace,
} from "./provider.js";
import * as Q from "../graphql/queries.js";

type StorefrontClient = ReturnType<typeof createStorefrontApiClient>;

export class RemoteProvider implements DraculaProvider {
  private client: StorefrontClient;
  public products: ProductsNamespace;
  public collections: CollectionsNamespace;
  public cart: CartNamespace;
  public content: ContentNamespace;
  public metaobjects: MetaobjectsNamespace;
  public seo: SEONamespace;
  public search: SearchNamespace;

  constructor(config: DraculaConfig) {
    this.client = createStorefrontApiClient({
      storeDomain: config.shop.includes(".")
        ? config.shop
        : `https://${config.shop}.myshopify.com`,
      apiVersion: config.apiVersion ?? "2025-04",
      publicAccessToken: config.storefrontAccessToken,
    });

    this.products = this.createProductsNamespace();
    this.collections = this.createCollectionsNamespace();
    this.cart = this.createCartNamespace();
    this.content = this.createContentNamespace();
    this.metaobjects = this.createMetaobjectsNamespace();
    this.seo = this.createSEONamespace();
    this.search = this.createSearchNamespace();
  }

  private async query<T>(
    operation: string,
    variables?: Record<string, unknown>,
    retries = 3
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, errors } = await this.client.request(operation, {
          variables: variables as Record<string, string>,
        });

        if (errors) {
          const msg = errors.message ?? "GraphQL error";
          throw new DraculaNetworkError(msg, 400);
        }

        return data as T;
      } catch (error) {
        if (error instanceof DraculaNetworkError && !error.retryable) throw error;
        if (error instanceof DraculaNotFoundError) throw error;
        if (error instanceof DraculaUserError) throw error;

        if (attempt < retries) {
          const delay = Math.min(1000 * 2 ** attempt, 10000);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw error;
      }
    }
    throw new DraculaNetworkError("Max retries exceeded", 0);
  }

  private handleUserErrors(
    userErrors: Array<{
      message: string;
      code?: string;
      field?: string[];
    }>
  ): void {
    if (userErrors?.length) {
      const err = userErrors[0];
      throw new DraculaUserError(err.message, err.code ?? null, err.field ?? null);
    }
  }

  // ─── Products ──────────────────────────────────────────────────────────────

  private createProductsNamespace(): ProductsNamespace {
    return {
      get: async ({ handle }) => {
        const data = await this.query<{ product: ShopifyProduct | null }>(
          Q.PRODUCT_BY_HANDLE_QUERY,
          { handle }
        );
        if (!data.product)
          throw new DraculaNotFoundError("Product", handle);
        return data.product;
      },

      getById: async ({ id }) => {
        const data = await this.query<{ product: ShopifyProduct | null }>(
          Q.PRODUCT_BY_ID_QUERY,
          { id }
        );
        if (!data.product) throw new DraculaNotFoundError("Product", id);
        return data.product;
      },

      list: async (params: ProductListParams = {}) => {
        const data = await this.query<{
          products: ShopifyConnection<ShopifyProduct>;
        }>(Q.PRODUCTS_QUERY, {
          first: params.first ?? 20,
          after: params.after,
          last: params.last,
          before: params.before,
          sortKey: params.sortKey,
          reverse: params.reverse,
          query: params.query,
        });
        return data.products;
      },

      search: async (params: SearchParams) => {
        const data = await this.query<{
          search: ShopifyConnection<ShopifyProduct>;
        }>(Q.SEARCH_QUERY, {
          query: params.query,
          first: params.first ?? 20,
          after: params.after,
          types: params.types ?? ["PRODUCT"],
          sortKey: params.sortKey,
          reverse: params.reverse,
        });
        return data.search;
      },

      getRecommendations: async ({ productId }) => {
        const data = await this.query<{
          productRecommendations: ShopifyProduct[];
        }>(Q.PRODUCT_RECOMMENDATIONS_QUERY, { productId });
        return data.productRecommendations ?? [];
      },
    };
  }

  // ─── Collections ───────────────────────────────────────────────────────────

  private createCollectionsNamespace(): CollectionsNamespace {
    return {
      get: async ({ handle }) => {
        const data = await this.query<{
          collection: ShopifyCollection | null;
        }>(Q.COLLECTION_BY_HANDLE_QUERY, { handle });
        if (!data.collection)
          throw new DraculaNotFoundError("Collection", handle);
        return data.collection;
      },

      list: async (params: CollectionListParams = {}) => {
        const data = await this.query<{
          collections: ShopifyConnection<ShopifyCollection>;
        }>(Q.COLLECTIONS_QUERY, {
          first: params.first ?? 20,
          after: params.after,
          last: params.last,
          before: params.before,
          sortKey: params.sortKey,
          reverse: params.reverse,
          query: params.query,
        });
        return data.collections;
      },

      getProducts: async ({ handle, params = {} }) => {
        const data = await this.query<{
          collection: {
            products: ShopifyConnection<ShopifyProduct>;
          } | null;
        }>(Q.COLLECTION_PRODUCTS_QUERY, {
          handle,
          first: params.first ?? 20,
          after: params.after,
          last: params.last,
          before: params.before,
          sortKey: params.sortKey,
          reverse: params.reverse,
          filters: params.filters,
        });
        if (!data.collection)
          throw new DraculaNotFoundError("Collection", handle);
        return data.collection.products;
      },
    };
  }

  // ─── Cart ──────────────────────────────────────────────────────────────────

  private createCartNamespace(): CartNamespace {
    return {
      create: async (params: CartCreateInput = {}) => {
        const data = await this.query<{
          cartCreate: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_CREATE_MUTATION, { input: params });
        this.handleUserErrors(data.cartCreate.userErrors);
        return data.cartCreate.cart;
      },

      get: async ({ cartId }) => {
        const data = await this.query<{ cart: ShopifyCart | null }>(
          Q.CART_QUERY,
          { cartId }
        );
        if (!data.cart) throw new DraculaNotFoundError("Cart", cartId);
        return data.cart;
      },

      addLines: async ({ cartId, lines }) => {
        const data = await this.query<{
          cartLinesAdd: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_LINES_ADD_MUTATION, { cartId, lines });
        this.handleUserErrors(data.cartLinesAdd.userErrors);
        return data.cartLinesAdd.cart;
      },

      updateLines: async ({ cartId, lines }) => {
        const data = await this.query<{
          cartLinesUpdate: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_LINES_UPDATE_MUTATION, { cartId, lines });
        this.handleUserErrors(data.cartLinesUpdate.userErrors);
        return data.cartLinesUpdate.cart;
      },

      removeLines: async ({ cartId, lineIds }) => {
        const data = await this.query<{
          cartLinesRemove: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_LINES_REMOVE_MUTATION, { cartId, lineIds });
        this.handleUserErrors(data.cartLinesRemove.userErrors);
        return data.cartLinesRemove.cart;
      },

      updateDiscountCodes: async ({ cartId, discountCodes }) => {
        const data = await this.query<{
          cartDiscountCodesUpdate: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_DISCOUNT_CODES_UPDATE_MUTATION, { cartId, discountCodes });
        this.handleUserErrors(data.cartDiscountCodesUpdate.userErrors);
        return data.cartDiscountCodesUpdate.cart;
      },

      updateBuyerIdentity: async ({ cartId, buyerIdentity }) => {
        const data = await this.query<{
          cartBuyerIdentityUpdate: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_BUYER_IDENTITY_UPDATE_MUTATION, { cartId, buyerIdentity });
        this.handleUserErrors(data.cartBuyerIdentityUpdate.userErrors);
        return data.cartBuyerIdentityUpdate.cart;
      },

      updateNote: async ({ cartId, note }) => {
        const data = await this.query<{
          cartNoteUpdate: {
            cart: ShopifyCart;
            userErrors: Array<{ message: string; code?: string; field?: string[] }>;
          };
        }>(Q.CART_NOTE_UPDATE_MUTATION, { cartId, note });
        this.handleUserErrors(data.cartNoteUpdate.userErrors);
        return data.cartNoteUpdate.cart;
      },
    };
  }

  // ─── Content ───────────────────────────────────────────────────────────────

  private createContentNamespace(): ContentNamespace {
    return {
      getPage: async ({ handle }) => {
        const data = await this.query<{ page: ShopifyPage | null }>(
          Q.PAGE_BY_HANDLE_QUERY,
          { handle }
        );
        if (!data.page) throw new DraculaNotFoundError("Page", handle);
        return data.page;
      },

      listPages: async (params: PaginationParams = {}) => {
        const data = await this.query<{
          pages: ShopifyConnection<ShopifyPage>;
        }>(Q.PAGES_QUERY, {
          first: params.first ?? 20,
          after: params.after,
        });
        return data.pages;
      },

      getBlog: async ({ handle }) => {
        const data = await this.query<{ blog: ShopifyBlog | null }>(
          Q.BLOG_BY_HANDLE_QUERY,
          { handle }
        );
        if (!data.blog) throw new DraculaNotFoundError("Blog", handle);
        return data.blog;
      },

      listBlogs: async (params: PaginationParams = {}) => {
        const data = await this.query<{
          blogs: ShopifyConnection<ShopifyBlog>;
        }>(Q.BLOGS_QUERY, {
          first: params.first ?? 20,
          after: params.after,
        });
        return data.blogs;
      },

      getArticle: async ({ blogHandle, articleHandle }) => {
        const data = await this.query<{
          blog: { articleByHandle: ShopifyArticle | null } | null;
        }>(Q.ARTICLE_BY_HANDLE_QUERY, { blogHandle, articleHandle });
        if (!data.blog?.articleByHandle)
          throw new DraculaNotFoundError("Article", `${blogHandle}/${articleHandle}`);
        return data.blog.articleByHandle;
      },

      listArticles: async ({ blogHandle, params = {} }) => {
        const data = await this.query<{
          blog: {
            articles: ShopifyConnection<ShopifyArticle>;
          } | null;
        }>(Q.ARTICLES_QUERY, {
          blogHandle,
          first: params.first ?? 20,
          after: params.after,
          sortKey: params.sortKey,
          reverse: params.reverse,
          query: params.query,
        });
        if (!data.blog)
          throw new DraculaNotFoundError("Blog", blogHandle);
        return data.blog.articles;
      },

      getMenu: async ({ handle }) => {
        const data = await this.query<{ menu: ShopifyMenu | null }>(
          Q.MENU_QUERY,
          { handle }
        );
        if (!data.menu) throw new DraculaNotFoundError("Menu", handle);
        return data.menu;
      },
    };
  }

  // ─── Metaobjects ──────────────────────────────────────────────────────────

  private createMetaobjectsNamespace(): MetaobjectsNamespace {
    return {
      get: async ({ type, handle }) => {
        const data = await this.query<{
          metaobject: ShopifyMetaobject | null;
        }>(Q.METAOBJECT_BY_HANDLE_QUERY, {
          handle: { type, handle },
        });
        if (!data.metaobject)
          throw new DraculaNotFoundError("Metaobject", `${type}/${handle}`);
        return data.metaobject;
      },

      list: async ({ type, first, after }) => {
        const data = await this.query<{
          metaobjects: ShopifyConnection<ShopifyMetaobject>;
        }>(Q.METAOBJECTS_QUERY, {
          type,
          first: first ?? 20,
          after,
        });
        return data.metaobjects;
      },
    };
  }

  // ─── SEO ───────────────────────────────────────────────────────────────────

  private createSEONamespace(): SEONamespace {
    return {
      getShop: async () => {
        const data = await this.query<{ shop: ShopifyShop }>(Q.SHOP_QUERY);
        return data.shop;
      },
    };
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  private createSearchNamespace(): SearchNamespace {
    return {
      search: async (params) => {
        const data = await this.query<{
          search: ShopifyConnection<ShopifyProduct>;
        }>(Q.SEARCH_QUERY, {
          query: params.query,
          first: params.first ?? 20,
          after: params.after,
          types: params.types ?? ["PRODUCT"],
          sortKey: params.sortKey,
          reverse: params.reverse,
        });
        return data.search;
      },

      predictive: async ({ query, limit, types }) => {
        const data = await this.query<{
          predictiveSearch: ShopifyPredictiveSearchResult;
        }>(Q.PREDICTIVE_SEARCH_QUERY, {
          query,
          limit: limit ?? 10,
          types,
        });
        return data.predictiveSearch;
      },
    };
  }
}
