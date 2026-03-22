import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DraculaConfig } from "../config.js";
import {
  DraculaNotFoundError,
  DraculaValidationError,
} from "../errors.js";
import type {
  ShopifyProduct,
  ShopifyCollection,
  ShopifyCart,
  ShopifyCartLineItem,
  ShopifyPage,
  ShopifyBlog,
  ShopifyArticle,
  ShopifyMenu,
  ShopifyShop,
  ShopifyMetaobject,
  ShopifyConnection,
  ShopifyEdge,
  ShopifyPageInfo,
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
  ShopifyAttribute,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toConnection<T extends { id?: string }>(
  items: T[],
  pagination?: { first?: number; after?: string; last?: number; before?: string }
): ShopifyConnection<T> {
  const first = pagination?.first ?? items.length;
  const after = pagination?.after;

  let startIdx = 0;
  if (after) {
    const afterIdx = items.findIndex(
      (_, i) => encodeCursor(i) === after
    );
    if (afterIdx >= 0) startIdx = afterIdx + 1;
  }

  const sliced = items.slice(startIdx, startIdx + first);

  const edges: ShopifyEdge<T>[] = sliced.map((node, i) => ({
    node,
    cursor: encodeCursor(startIdx + i),
  }));

  const pageInfo: ShopifyPageInfo = {
    hasNextPage: startIdx + first < items.length,
    hasPreviousPage: startIdx > 0,
    startCursor: edges.length > 0 ? edges[0].cursor : null,
    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
  };

  return { edges, pageInfo };
}

function encodeCursor(index: number): string {
  return Buffer.from(`cursor:${index}`).toString("base64");
}

function sortItems<T>(
  items: T[],
  sortKey: string | undefined,
  reverse: boolean | undefined,
  getSortValue: (item: T, key: string) => string | number | boolean
): T[] {
  if (!sortKey) return items;

  const sorted = [...items].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (typeof aVal === "string" && typeof bVal === "string")
      return aVal.localeCompare(bVal);
    if (typeof aVal === "number" && typeof bVal === "number")
      return aVal - bVal;
    return 0;
  });

  return reverse ? sorted.reverse() : sorted;
}

const STRUCTURED_FILTER_PATTERN = /\b\w+:[^\s]/;

function filterByQuery<T>(
  items: T[],
  query: string | undefined,
  getSearchableText: (item: T) => string
): T[] {
  if (!query) return items;

  if (STRUCTURED_FILTER_PATTERN.test(query)) {
    console.warn(
      `[Dracula] Warning: LocalProvider does not support structured Shopify filter syntax (received "${query}"). ` +
      `Filters like "product_type:Apparel" or "tag:sale" are not parsed — the query is matched as plain keywords. ` +
      `Results may differ from production. See: https://github.com/marcusfelix/dracula#local-provider-limitations`
    );
  }

  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());

  return items.filter((item) => {
    const text = getSearchableText(item).toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

// ─── LocalProvider ───────────────────────────────────────────────────────────

export class LocalProvider implements DraculaProvider {
  private dataDir: string;
  private productsStore: Map<string, ShopifyProduct> = new Map();
  private productsByHandle: Map<string, ShopifyProduct> = new Map();
  private collectionsStore: Map<string, ShopifyCollection> = new Map();
  private collectionsByHandle: Map<string, ShopifyCollection> = new Map();
  private pagesStore: Map<string, ShopifyPage> = new Map();
  private pagesByHandle: Map<string, ShopifyPage> = new Map();
  private blogsStore: Map<string, ShopifyBlog> = new Map();
  private blogsByHandle: Map<string, ShopifyBlog> = new Map();
  private articlesStore: Map<string, ShopifyArticle[]> = new Map();
  private menusStore: Map<string, ShopifyMenu> = new Map();
  private metaobjectsStore: Map<string, ShopifyMetaobject[]> = new Map();
  private shopData: ShopifyShop | null = null;
  private delay: number;
  private strict: boolean;

  public products: ProductsNamespace;
  public collections: CollectionsNamespace;
  public cart: CartNamespace;
  public content: ContentNamespace;
  public metaobjects: MetaobjectsNamespace;
  public seo: SEONamespace;
  public search: SearchNamespace;

  constructor(config: DraculaConfig) {
    this.dataDir = resolve(config.localDataDir ?? ".dracula/blood-bank");
    this.delay = config.localProvider?.artificialDelay ?? 0;
    this.strict = config.localProvider?.strictMode ?? false;

    this.loadData();

    this.products = this.createProductsNamespace();
    this.collections = this.createCollectionsNamespace();
    this.cart = this.createCartNamespace();
    this.content = this.createContentNamespace();
    this.metaobjects = this.createMetaobjectsNamespace();
    this.seo = this.createSEONamespace();
    this.search = this.createSearchNamespace();
  }

  private async maybeDelay(): Promise<void> {
    if (this.delay > 0)
      await new Promise((r) => setTimeout(r, this.delay));
  }

  private loadData(): void {
    this.loadProducts();
    this.loadCollections();
    this.loadPages();
    this.loadBlogs();
    this.loadMenus();
    this.loadMetaobjects();
    this.loadShop();
  }

  private readJson<T>(path: string): T | null {
    try {
      if (!existsSync(path)) return null;
      return JSON.parse(readFileSync(path, "utf-8")) as T;
    } catch {
      return null;
    }
  }

  private loadDir<T>(dirPath: string): T[] {
    if (!existsSync(dirPath)) return [];
    const files = readdirSync(dirPath).filter(
      (f) => f.endsWith(".json") && !f.startsWith("_")
    );
    return files
      .map((f) => this.readJson<T>(join(dirPath, f)))
      .filter((item): item is T => item !== null);
  }

  private loadProducts(): void {
    const products = this.loadDir<ShopifyProduct>(join(this.dataDir, "products"));
    for (const p of products) {
      this.productsStore.set(p.id, p);
      this.productsByHandle.set(p.handle, p);
    }
  }

  private loadCollections(): void {
    const collections = this.loadDir<ShopifyCollection>(
      join(this.dataDir, "collections")
    );
    for (const c of collections) {
      this.collectionsStore.set(c.id, c);
      this.collectionsByHandle.set(c.handle, c);
    }
  }

  private loadPages(): void {
    const pages = this.loadDir<ShopifyPage>(join(this.dataDir, "pages"));
    for (const p of pages) {
      this.pagesStore.set(p.id, p);
      this.pagesByHandle.set(p.handle, p);
    }
  }

  private loadBlogs(): void {
    const blogsDir = join(this.dataDir, "blogs");
    if (!existsSync(blogsDir)) return;

    for (const dir of readdirSync(blogsDir)) {
      const blogPath = join(blogsDir, dir);
      const blogMeta = this.readJson<ShopifyBlog>(join(blogPath, "_blog.json"));
      if (!blogMeta) continue;

      this.blogsStore.set(blogMeta.id, blogMeta);
      this.blogsByHandle.set(blogMeta.handle, blogMeta);

      const articles = this.loadDir<ShopifyArticle>(blogPath);
      this.articlesStore.set(blogMeta.handle, articles);
    }
  }

  private loadMenus(): void {
    const menus = this.loadDir<ShopifyMenu>(join(this.dataDir, "menus"));
    for (const m of menus) {
      this.menusStore.set(m.handle, m);
    }
  }

  private loadMetaobjects(): void {
    const metaDir = join(this.dataDir, "metaobjects");
    if (!existsSync(metaDir)) return;

    for (const typeDir of readdirSync(metaDir)) {
      const items = this.loadDir<ShopifyMetaobject>(join(metaDir, typeDir));
      this.metaobjectsStore.set(typeDir, items);
    }
  }

  private loadShop(): void {
    this.shopData = this.readJson<ShopifyShop>(join(this.dataDir, "shop.json"));
  }

  // ─── Product sort helper ──────────────────────────────────────────────────

  private getProductSortValue(
    product: ShopifyProduct,
    key: string
  ): string | number {
    switch (key) {
      case "TITLE":
        return product.title;
      case "PRICE":
        return parseFloat(product.priceRange.minVariantPrice.amount);
      case "CREATED_AT":
        return new Date(product.createdAt).getTime();
      case "UPDATED_AT":
        return new Date(product.updatedAt).getTime();
      case "VENDOR":
        return product.vendor;
      case "PRODUCT_TYPE":
        return product.productType;
      case "ID":
        return product.id;
      default:
        return product.title;
    }
  }

  private productSearchText(p: ShopifyProduct): string {
    return `${p.title} ${p.productType} ${p.vendor} ${p.tags.join(" ")} ${p.description}`;
  }

  // ─── Products Namespace ────────────────────────────────────────────────────

  private createProductsNamespace(): ProductsNamespace {
    return {
      get: async ({ handle }) => {
        await this.maybeDelay();
        const product = this.productsByHandle.get(handle);
        if (!product) {
          if (this.strict) throw new DraculaNotFoundError("Product", handle);
          throw new DraculaNotFoundError("Product", handle);
        }
        return product;
      },

      getById: async ({ id }) => {
        await this.maybeDelay();
        const product = this.productsStore.get(id);
        if (!product) throw new DraculaNotFoundError("Product", id);
        return product;
      },

      list: async (params: ProductListParams = {}) => {
        await this.maybeDelay();
        let items = Array.from(this.productsStore.values());
        items = filterByQuery(items, params.query, (p) =>
          this.productSearchText(p)
        );
        items = sortItems(items, params.sortKey, params.reverse, (p, k) =>
          this.getProductSortValue(p, k)
        );
        return toConnection(items, params);
      },

      search: async (params: SearchParams) => {
        await this.maybeDelay();
        let items = Array.from(this.productsStore.values());
        items = filterByQuery(items, params.query, (p) =>
          this.productSearchText(p)
        );
        if (params.sortKey === "PRICE") {
          items = sortItems(items, "PRICE", params.reverse, (p, k) =>
            this.getProductSortValue(p, k)
          );
        }
        return toConnection(items, params);
      },

      getRecommendations: async ({ productId }) => {
        await this.maybeDelay();
        const product = this.productsStore.get(productId);
        if (!product) return [];

        const allProducts = Array.from(this.productsStore.values());
        const scored = allProducts
          .filter((p) => p.id !== productId)
          .map((p) => {
            let score = 0;
            if (p.productType === product.productType) score += 3;
            const sharedTags = p.tags.filter((t) =>
              product.tags.includes(t)
            );
            score += sharedTags.length;
            if (p.vendor === product.vendor) score += 1;
            return { product: p, score };
          })
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        return scored.map((s) => s.product);
      },
    };
  }

  // ─── Collections Namespace ─────────────────────────────────────────────────

  private createCollectionsNamespace(): CollectionsNamespace {
    return {
      get: async ({ handle }) => {
        await this.maybeDelay();
        const collection = this.collectionsByHandle.get(handle);
        if (!collection)
          throw new DraculaNotFoundError("Collection", handle);
        return collection;
      },

      list: async (params: CollectionListParams = {}) => {
        await this.maybeDelay();
        let items = Array.from(this.collectionsStore.values());
        items = filterByQuery(items, params.query, (c) =>
          `${c.title} ${c.description}`
        );
        items = sortItems(items, params.sortKey, params.reverse, (c, k) => {
          switch (k) {
            case "TITLE":
              return c.title;
            case "UPDATED_AT":
              return new Date(c.updatedAt).getTime();
            case "ID":
              return c.id;
            default:
              return c.title;
          }
        });
        return toConnection(items, params);
      },

      getProducts: async ({ handle, params = {} }) => {
        await this.maybeDelay();
        const collection = this.collectionsByHandle.get(handle);
        if (!collection)
          throw new DraculaNotFoundError("Collection", handle);

        // If the collection has embedded product IDs, use those
        let products: ShopifyProduct[];
        if (collection.products?.edges) {
          products = collection.products.edges
            .map((e) => {
              const id = typeof e.node === "string" ? e.node : e.node.id;
              return this.productsStore.get(id);
            })
            .filter((p): p is ShopifyProduct => p !== undefined);
        } else {
          products = Array.from(this.productsStore.values());
        }

        products = sortItems(
          products,
          params.sortKey,
          params.reverse,
          (p, k) => this.getProductSortValue(p, k)
        );

        return toConnection(products, params);
      },
    };
  }

  // ─── Cart Namespace ────────────────────────────────────────────────────────

  private getCartPath(): string {
    return join(this.dataDir, "cart.json");
  }

  private loadCarts(): Map<string, ShopifyCart> {
    const data = this.readJson<Record<string, ShopifyCart>>(this.getCartPath());
    return new Map(Object.entries(data ?? {}));
  }

  private saveCarts(carts: Map<string, ShopifyCart>): void {
    const obj = Object.fromEntries(carts);
    writeFileSync(this.getCartPath(), JSON.stringify(obj, null, 2));
  }

  private recalculateCart(cart: ShopifyCart): ShopifyCart {
    let totalQuantity = 0;
    let subtotal = 0;

    for (const edge of cart.lines.edges) {
      const line = edge.node;
      totalQuantity += line.quantity;
      subtotal += parseFloat(line.cost.totalAmount.amount);
    }

    const currency = cart.cost.totalAmount.currencyCode;

    return {
      ...cart,
      totalQuantity,
      updatedAt: new Date().toISOString(),
      cost: {
        ...cart.cost,
        subtotalAmount: { amount: subtotal.toFixed(2), currencyCode: currency },
        totalAmount: { amount: subtotal.toFixed(2), currencyCode: currency },
      },
    };
  }

  private createCartNamespace(): CartNamespace {
    return {
      create: async (params: CartCreateInput = {}) => {
        await this.maybeDelay();
        const cartId = `gid://shopify/Cart/local_${Date.now()}`;
        const now = new Date().toISOString();
        const currency = this.shopData?.paymentSettings?.currencyCode ?? "USD";
        const zero = { amount: "0.00", currencyCode: currency };

        const lines: ShopifyEdge<ShopifyCartLineItem>[] = (params.lines ?? []).map(
          (lineInput, i) => {
            const variant = this.findVariant(lineInput.merchandiseId);
            return {
              node: this.createCartLine(lineInput, variant, currency),
              cursor: encodeCursor(i),
            };
          }
        );

        const cart: ShopifyCart = {
          id: cartId,
          checkoutUrl: `https://checkout.local/${cartId}`,
          createdAt: now,
          updatedAt: now,
          totalQuantity: 0,
          note: params.note ?? null,
          attributes: params.attributes ?? [],
          discountCodes: (params.discountCodes ?? []).map((code) => ({
            code,
            applicable: true,
          })),
          buyerIdentity: {
            email: params.buyerIdentity?.email ?? null,
            phone: params.buyerIdentity?.phone ?? null,
            countryCode: params.buyerIdentity?.countryCode ?? null,
          },
          cost: {
            subtotalAmount: { ...zero },
            totalAmount: { ...zero },
            totalTaxAmount: null,
            totalDutyAmount: null,
          },
          lines: {
            edges: lines,
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: lines[0]?.cursor ?? null,
              endCursor: lines[lines.length - 1]?.cursor ?? null,
            },
          },
        };

        const recalculated = this.recalculateCart(cart);
        const carts = this.loadCarts();
        carts.set(cartId, recalculated);
        this.saveCarts(carts);
        return recalculated;
      },

      get: async ({ cartId }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);
        return cart;
      },

      addLines: async ({ cartId, lines }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);

        const currency = cart.cost.totalAmount.currencyCode;

        for (const lineInput of lines) {
          const existing = cart.lines.edges.find(
            (e) => e.node.merchandise.id === lineInput.merchandiseId
          );
          if (existing) {
            existing.node.quantity += lineInput.quantity;
            const price = parseFloat(existing.node.cost.amountPerQuantity.amount);
            existing.node.cost.totalAmount.amount = (
              price * existing.node.quantity
            ).toFixed(2);
          } else {
            const variant = this.findVariant(lineInput.merchandiseId);
            const newLine = this.createCartLine(lineInput, variant, currency);
            cart.lines.edges.push({
              node: newLine,
              cursor: encodeCursor(cart.lines.edges.length),
            });
          }
        }

        const recalculated = this.recalculateCart(cart);
        carts.set(cartId, recalculated);
        this.saveCarts(carts);
        return recalculated;
      },

      updateLines: async ({ cartId, lines }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);

        for (const update of lines) {
          const edge = cart.lines.edges.find((e) => e.node.id === update.id);
          if (!edge) continue;

          if (update.quantity !== undefined) {
            edge.node.quantity = update.quantity;
            const price = parseFloat(edge.node.cost.amountPerQuantity.amount);
            edge.node.cost.totalAmount.amount = (
              price * edge.node.quantity
            ).toFixed(2);
          }
        }

        // Remove lines with quantity 0
        cart.lines.edges = cart.lines.edges.filter(
          (e) => e.node.quantity > 0
        );

        const recalculated = this.recalculateCart(cart);
        carts.set(cartId, recalculated);
        this.saveCarts(carts);
        return recalculated;
      },

      removeLines: async ({ cartId, lineIds }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);

        cart.lines.edges = cart.lines.edges.filter(
          (e) => !lineIds.includes(e.node.id)
        );

        const recalculated = this.recalculateCart(cart);
        carts.set(cartId, recalculated);
        this.saveCarts(carts);
        return recalculated;
      },

      updateDiscountCodes: async ({ cartId, discountCodes }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);

        cart.discountCodes = discountCodes.map((code) => ({
          code,
          applicable: true,
        }));

        const recalculated = this.recalculateCart(cart);
        carts.set(cartId, recalculated);
        this.saveCarts(carts);
        return recalculated;
      },

      updateBuyerIdentity: async ({ cartId, buyerIdentity }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);

        cart.buyerIdentity = {
          ...cart.buyerIdentity,
          ...buyerIdentity,
        } as ShopifyCartBuyerIdentity;

        carts.set(cartId, cart);
        this.saveCarts(carts);
        return cart;
      },

      updateNote: async ({ cartId, note }) => {
        await this.maybeDelay();
        const carts = this.loadCarts();
        const cart = carts.get(cartId);
        if (!cart) throw new DraculaNotFoundError("Cart", cartId);

        cart.note = note;
        carts.set(cartId, cart);
        this.saveCarts(carts);
        return cart;
      },
    };
  }

  private findVariant(merchandiseId: string) {
    for (const product of this.productsStore.values()) {
      const variant = product.variants.edges.find(
        (e) => e.node.id === merchandiseId
      );
      if (variant) return { variant: variant.node, product };
    }
    return null;
  }

  private createCartLine(
    input: CartLineInput,
    found: {
      variant: ShopifyProduct["variants"]["edges"][0]["node"];
      product: ShopifyProduct;
    } | null,
    currency: string
  ): ShopifyCartLineItem {
    const price = found?.variant.price ?? {
      amount: "0.00",
      currencyCode: currency,
    };
    const total = (parseFloat(price.amount) * input.quantity).toFixed(2);

    return {
      id: `gid://shopify/CartLine/local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      quantity: input.quantity,
      attributes: input.attributes ?? [],
      discountAllocations: [],
      cost: {
        totalAmount: { amount: total, currencyCode: price.currencyCode },
        amountPerQuantity: { ...price },
        compareAtAmountPerQuantity: found?.variant.compareAtPrice ?? null,
      },
      merchandise: {
        id: input.merchandiseId,
        title: found?.variant.title ?? "Unknown",
        price: { ...price },
        compareAtPrice: found?.variant.compareAtPrice ?? null,
        image: found?.variant.image ?? null,
        selectedOptions: found?.variant.selectedOptions ?? [],
        requiresShipping: found?.variant.requiresShipping ?? true,
        product: {
          id: found?.product.id ?? "",
          handle: found?.product.handle ?? "",
          title: found?.product.title ?? "Unknown Product",
          featuredImage: found?.product.featuredImage ?? null,
        },
      },
    };
  }

  // ─── Content Namespace ─────────────────────────────────────────────────────

  private createContentNamespace(): ContentNamespace {
    return {
      getPage: async ({ handle }) => {
        await this.maybeDelay();
        const page = this.pagesByHandle.get(handle);
        if (!page) throw new DraculaNotFoundError("Page", handle);
        return page;
      },

      listPages: async (params: PaginationParams = {}) => {
        await this.maybeDelay();
        const items = Array.from(this.pagesStore.values());
        return toConnection(items, params);
      },

      getBlog: async ({ handle }) => {
        await this.maybeDelay();
        const blog = this.blogsByHandle.get(handle);
        if (!blog) throw new DraculaNotFoundError("Blog", handle);
        return blog;
      },

      listBlogs: async (params: PaginationParams = {}) => {
        await this.maybeDelay();
        const items = Array.from(this.blogsStore.values());
        return toConnection(items, params);
      },

      getArticle: async ({ blogHandle, articleHandle }) => {
        await this.maybeDelay();
        const articles = this.articlesStore.get(blogHandle);
        if (!articles)
          throw new DraculaNotFoundError("Blog", blogHandle);
        const article = articles.find((a) => a.handle === articleHandle);
        if (!article)
          throw new DraculaNotFoundError(
            "Article",
            `${blogHandle}/${articleHandle}`
          );
        return article;
      },

      listArticles: async ({ blogHandle, params = {} }) => {
        await this.maybeDelay();
        const articles = this.articlesStore.get(blogHandle);
        if (!articles)
          throw new DraculaNotFoundError("Blog", blogHandle);

        let items = [...articles];
        items = filterByQuery(items, params.query, (a) =>
          `${a.title} ${a.tags.join(" ")}`
        );
        items = sortItems(items, params.sortKey, params.reverse, (a, k) => {
          switch (k) {
            case "TITLE":
              return a.title;
            case "PUBLISHED_AT":
              return new Date(a.publishedAt).getTime();
            case "AUTHOR":
              return a.author.name;
            default:
              return a.title;
          }
        });
        return toConnection(items, params);
      },

      getMenu: async ({ handle }) => {
        await this.maybeDelay();
        const menu = this.menusStore.get(handle);
        if (!menu) throw new DraculaNotFoundError("Menu", handle);
        return menu;
      },
    };
  }

  // ─── Metaobjects Namespace ─────────────────────────────────────────────────

  private createMetaobjectsNamespace(): MetaobjectsNamespace {
    return {
      get: async ({ type, handle }) => {
        await this.maybeDelay();
        const items = this.metaobjectsStore.get(type) ?? [];
        const item = items.find((m) => m.handle === handle);
        if (!item)
          throw new DraculaNotFoundError("Metaobject", `${type}/${handle}`);
        return item;
      },

      list: async ({ type, first, after }) => {
        await this.maybeDelay();
        const items = this.metaobjectsStore.get(type) ?? [];
        return toConnection(items, { first: first ?? 20, after });
      },
    };
  }

  // ─── SEO Namespace ─────────────────────────────────────────────────────────

  private createSEONamespace(): SEONamespace {
    return {
      getShop: async () => {
        await this.maybeDelay();
        if (!this.shopData)
          throw new DraculaValidationError(
            "shop.json not found in blood-bank directory"
          );
        return this.shopData;
      },
    };
  }

  // ─── Search Namespace ──────────────────────────────────────────────────────

  private createSearchNamespace(): SearchNamespace {
    return {
      search: async (params) => {
        await this.maybeDelay();
        let items = Array.from(this.productsStore.values());
        items = filterByQuery(items, params.query, (p) =>
          this.productSearchText(p)
        );
        return toConnection(items, params);
      },

      predictive: async ({ query, limit }) => {
        await this.maybeDelay();
        const maxItems = limit ?? 10;
        const q = query.toLowerCase();

        const products = Array.from(this.productsStore.values())
          .filter((p) => this.productSearchText(p).toLowerCase().includes(q))
          .slice(0, maxItems);

        const collections = Array.from(this.collectionsStore.values())
          .filter((c) => c.title.toLowerCase().includes(q))
          .slice(0, maxItems);

        const pages = Array.from(this.pagesStore.values())
          .filter((p) => p.title.toLowerCase().includes(q))
          .slice(0, maxItems);

        const articles: ShopifyArticle[] = [];
        for (const arts of this.articlesStore.values()) {
          for (const a of arts) {
            if (a.title.toLowerCase().includes(q)) {
              articles.push(a);
              if (articles.length >= maxItems) break;
            }
          }
          if (articles.length >= maxItems) break;
        }

        return {
          products,
          collections,
          pages,
          articles,
          queries: [{ text: query, styledText: query }],
        };
      },
    };
  }
}
