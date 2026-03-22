import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { resolve } from "node:path";
import { existsSync, rmSync, utimesSync } from "node:fs";
import { LocalProvider } from "../src/providers/local.js";
import { DraculaNotFoundError, DraculaValidationError } from "../src/errors.js";
import type { DraculaConfig } from "../src/config.js";

const FIXTURES_DIR = resolve(__dirname, "fixtures/.dracula/blood-bank");
const CART_PATH = resolve(FIXTURES_DIR, "cart.json");

function createProvider(overrides: Partial<DraculaConfig> = {}): LocalProvider {
  return new LocalProvider({
    shop: "test.myshopify.com",
    storefrontAccessToken: "test-token",
    localDataDir: FIXTURES_DIR,
    ...overrides,
  });
}

describe("LocalProvider", () => {
  let provider: LocalProvider;

  beforeAll(() => {
    provider = createProvider();
  });

  beforeEach(() => {
    // Clean up cart state between tests
    if (existsSync(CART_PATH)) rmSync(CART_PATH);
  });

  // ─── Products ────────────────────────────────────────────────────────

  describe("products", () => {
    it("gets a product by handle", async () => {
      const product = await provider.products.get({
        handle: "nomad-backpack",
      });
      expect(product.id).toBe("gid://shopify/Product/1");
      expect(product.title).toBe("Nomad Backpack");
      expect(product.handle).toBe("nomad-backpack");
      expect(product.variants.edges).toHaveLength(2);
      expect(product.tags).toContain("travel");
    });

    it("gets a product by ID", async () => {
      const product = await provider.products.getById({
        id: "gid://shopify/Product/1",
      });
      expect(product.handle).toBe("nomad-backpack");
    });

    it("throws DraculaNotFoundError for unknown handle", async () => {
      await expect(
        provider.products.get({ handle: "nonexistent" })
      ).rejects.toThrow(DraculaNotFoundError);
    });

    it("lists all products", async () => {
      const result = await provider.products.list();
      expect(result.edges.length).toBeGreaterThanOrEqual(3);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it("paginates products with first/after", async () => {
      const page1 = await provider.products.list({ first: 2 });
      expect(page1.edges).toHaveLength(2);
      expect(page1.pageInfo.hasNextPage).toBe(true);

      const page2 = await provider.products.list({
        first: 2,
        after: page1.pageInfo.endCursor!,
      });
      expect(page2.edges.length).toBeGreaterThanOrEqual(1);
      expect(page2.pageInfo.hasPreviousPage).toBe(true);
    });

    it("sorts products by TITLE", async () => {
      const result = await provider.products.list({ sortKey: "TITLE" });
      const titles = result.edges.map((e) => e.node.title);
      const sorted = [...titles].sort();
      expect(titles).toEqual(sorted);
    });

    it("sorts products by PRICE", async () => {
      const result = await provider.products.list({ sortKey: "PRICE" });
      const prices = result.edges.map((e) =>
        parseFloat(e.node.priceRange.minVariantPrice.amount)
      );
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it("reverses sort order", async () => {
      const result = await provider.products.list({
        sortKey: "TITLE",
        reverse: true,
      });
      const titles = result.edges.map((e) => e.node.title);
      const sorted = [...titles].sort().reverse();
      expect(titles).toEqual(sorted);
    });

    it("filters products by query string", async () => {
      const result = await provider.products.list({ query: "backpack" });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node.handle).toBe("nomad-backpack");
    });

    it("returns product recommendations by shared tags", async () => {
      const recs = await provider.products.getRecommendations({
        productId: "gid://shopify/Product/1",
      });
      expect(recs.length).toBeGreaterThan(0);
      // All recommended products should share at least one tag with the source
      const sourceTags = ["travel", "outdoor", "backpack"];
      for (const rec of recs) {
        const shared = rec.tags.filter((t) => sourceTags.includes(t));
        expect(shared.length).toBeGreaterThan(0);
      }
    });

    it("returns empty recommendations for unknown product", async () => {
      const recs = await provider.products.getRecommendations({
        productId: "gid://shopify/Product/999",
      });
      expect(recs).toEqual([]);
    });

    it("searches products", async () => {
      const result = await provider.products.search({ query: "vest" });
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node.handle).toBe("trail-vest");
    });
  });

  // ─── Collections ─────────────────────────────────────────────────────

  describe("collections", () => {
    it("gets a collection by handle", async () => {
      const col = await provider.collections.get({
        handle: "outdoor-gear",
      });
      expect(col.title).toBe("Outdoor Gear");
    });

    it("throws for unknown collection", async () => {
      await expect(
        provider.collections.get({ handle: "nonexistent" })
      ).rejects.toThrow(DraculaNotFoundError);
    });

    it("lists collections", async () => {
      const result = await provider.collections.list();
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("gets products in a collection", async () => {
      const result = await provider.collections.getProducts({
        handle: "outdoor-gear",
      });
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("paginates collection products", async () => {
      const page1 = await provider.collections.getProducts({
        handle: "outdoor-gear",
        params: { first: 1 },
      });
      expect(page1.edges).toHaveLength(1);
      expect(page1.pageInfo.hasNextPage).toBe(true);
    });
  });

  // ─── Cart ────────────────────────────────────────────────────────────

  describe("cart", () => {
    it("creates an empty cart", async () => {
      const cart = await provider.cart.create();
      expect(cart.id).toBeTruthy();
      expect(cart.totalQuantity).toBe(0);
      expect(cart.lines.edges).toHaveLength(0);
      expect(cart.cost.totalAmount.currencyCode).toBe("USD");
    });

    it("creates a cart with lines", async () => {
      const cart = await provider.cart.create({
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 2,
          },
        ],
      });
      expect(cart.totalQuantity).toBe(2);
      expect(cart.lines.edges).toHaveLength(1);
      expect(cart.lines.edges[0].node.quantity).toBe(2);
      expect(parseFloat(cart.cost.totalAmount.amount)).toBe(198.0);
    });

    it("gets a cart by ID", async () => {
      const created = await provider.cart.create();
      const fetched = await provider.cart.get({ cartId: created.id });
      expect(fetched.id).toBe(created.id);
    });

    it("throws for unknown cart", async () => {
      await expect(
        provider.cart.get({ cartId: "nonexistent" })
      ).rejects.toThrow(DraculaNotFoundError);
    });

    it("adds lines to a cart", async () => {
      const cart = await provider.cart.create();
      const updated = await provider.cart.addLines({
        cartId: cart.id,
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
        ],
      });
      expect(updated.totalQuantity).toBe(1);
      expect(updated.lines.edges).toHaveLength(1);
    });

    it("increments quantity when adding existing variant", async () => {
      const cart = await provider.cart.create({
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
        ],
      });
      const updated = await provider.cart.addLines({
        cartId: cart.id,
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 2,
          },
        ],
      });
      expect(updated.totalQuantity).toBe(3);
      expect(updated.lines.edges).toHaveLength(1);
      expect(updated.lines.edges[0].node.quantity).toBe(3);
    });

    it("updates line quantities", async () => {
      const cart = await provider.cart.create({
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 3,
          },
        ],
      });
      const lineId = cart.lines.edges[0].node.id;
      const updated = await provider.cart.updateLines({
        cartId: cart.id,
        lines: [{ id: lineId, quantity: 1 }],
      });
      expect(updated.totalQuantity).toBe(1);
    });

    it("removes line when quantity set to 0", async () => {
      const cart = await provider.cart.create({
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
        ],
      });
      const lineId = cart.lines.edges[0].node.id;
      const updated = await provider.cart.updateLines({
        cartId: cart.id,
        lines: [{ id: lineId, quantity: 0 }],
      });
      expect(updated.totalQuantity).toBe(0);
      expect(updated.lines.edges).toHaveLength(0);
    });

    it("removes lines by ID", async () => {
      const cart = await provider.cart.create({
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
          {
            merchandiseId: "gid://shopify/ProductVariant/3",
            quantity: 2,
          },
        ],
      });
      const lineId = cart.lines.edges[0].node.id;
      const updated = await provider.cart.removeLines({
        cartId: cart.id,
        lineIds: [lineId],
      });
      expect(updated.lines.edges).toHaveLength(1);
    });

    it("updates discount codes", async () => {
      const cart = await provider.cart.create();
      const updated = await provider.cart.updateDiscountCodes({
        cartId: cart.id,
        discountCodes: ["SAVE10"],
      });
      expect(updated.discountCodes).toHaveLength(1);
      expect(updated.discountCodes[0].code).toBe("SAVE10");
      expect(updated.discountCodes[0].applicable).toBe(true);
    });

    it("updates buyer identity", async () => {
      const cart = await provider.cart.create();
      const updated = await provider.cart.updateBuyerIdentity({
        cartId: cart.id,
        buyerIdentity: { email: "test@example.com" },
      });
      expect(updated.buyerIdentity.email).toBe("test@example.com");
    });

    it("updates cart note", async () => {
      const cart = await provider.cart.create();
      const updated = await provider.cart.updateNote({
        cartId: cart.id,
        note: "Please gift wrap",
      });
      expect(updated.note).toBe("Please gift wrap");
    });

    it("persists cart state to disk", async () => {
      const cart = await provider.cart.create({
        lines: [
          {
            merchandiseId: "gid://shopify/ProductVariant/1",
            quantity: 1,
          },
        ],
      });

      // Create a new provider to verify disk persistence
      const newProvider = createProvider();
      const fetched = await newProvider.cart.get({ cartId: cart.id });
      expect(fetched.totalQuantity).toBe(1);
    });
  });

  // ─── Content ─────────────────────────────────────────────────────────

  describe("content", () => {
    it("gets a page by handle", async () => {
      const page = await provider.content.getPage({ handle: "about-us" });
      expect(page.title).toBe("About Us");
      expect(page.body).toContain("About Us");
    });

    it("throws for unknown page", async () => {
      await expect(
        provider.content.getPage({ handle: "nonexistent" })
      ).rejects.toThrow(DraculaNotFoundError);
    });

    it("lists pages", async () => {
      const result = await provider.content.listPages();
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("gets a blog by handle", async () => {
      const blog = await provider.content.getBlog({ handle: "journal" });
      expect(blog.title).toBe("Journal");
    });

    it("gets an article by blog and article handle", async () => {
      const article = await provider.content.getArticle({
        blogHandle: "journal",
        articleHandle: "trail-guide",
      });
      expect(article.title).toBe("Trail Guide: Pacific Crest");
      expect(article.blog.handle).toBe("journal");
    });

    it("lists articles for a blog", async () => {
      const result = await provider.content.listArticles({
        blogHandle: "journal",
      });
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("gets a menu by handle", async () => {
      const menu = await provider.content.getMenu({ handle: "main-menu" });
      expect(menu.title).toBe("Main Menu");
      expect(menu.items).toHaveLength(2);
    });
  });

  // ─── Metaobjects ────────────────────────────────────────────────────

  describe("metaobjects", () => {
    it("gets a metaobject by type and handle", async () => {
      const obj = await provider.metaobjects.get({
        type: "faq_item",
        handle: "returns-policy",
      });
      expect(obj.type).toBe("faq_item");
      expect(obj.fields.length).toBeGreaterThan(0);
    });

    it("lists metaobjects by type", async () => {
      const result = await provider.metaobjects.list({
        type: "faq_item",
      });
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("throws for unknown metaobject", async () => {
      await expect(
        provider.metaobjects.get({ type: "faq_item", handle: "nope" })
      ).rejects.toThrow(DraculaNotFoundError);
    });
  });

  // ─── SEO / Shop ─────────────────────────────────────────────────────

  describe("seo", () => {
    it("returns shop data", async () => {
      const shop = await provider.seo.getShop();
      expect(shop.name).toBe("Test Outdoor Store");
      expect(shop.primaryDomain.host).toBeTruthy();
    });
  });

  // ─── Search ──────────────────────────────────────────────────────────

  describe("search", () => {
    it("searches products by query", async () => {
      const result = await provider.search.search({ query: "outdoor" });
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it("returns predictive search results", async () => {
      const result = await provider.search.predictive({
        query: "nomad",
      });
      expect(result.products.length).toBeGreaterThanOrEqual(1);
      expect(result.queries).toBeDefined();
    });
  });

  // ─── Artificial Delay ────────────────────────────────────────────────

  describe("artificialDelay", () => {
    it("delays responses when configured", async () => {
      const slowProvider = createProvider({
        localProvider: { artificialDelay: 50 },
      });
      const start = Date.now();
      await slowProvider.products.list();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow 10ms tolerance
    });
  });

  // ─── Stale Snapshot Warning ───────────────────────────────────────────

  describe("stale snapshot warning", () => {
    it("warns when snapshot is older than maxSnapshotAge", () => {
      const shopPath = resolve(FIXTURES_DIR, "shop.json");
      const originalStat = require("node:fs").statSync(shopPath);

      // Set mtime to 10 days ago
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      utimesSync(shopPath, tenDaysAgo, tenDaysAgo);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      createProvider({ localProvider: { maxSnapshotAge: 7 } });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("blood-bank snapshot is 10 day")
      );
      warnSpy.mockRestore();

      // Restore original mtime
      utimesSync(shopPath, originalStat.atime, originalStat.mtime);
    });

    it("does not warn when snapshot is fresh", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      createProvider({ localProvider: { maxSnapshotAge: 7 } });
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not warn when maxSnapshotAge is 0", () => {
      const shopPath = resolve(FIXTURES_DIR, "shop.json");
      const originalStat = require("node:fs").statSync(shopPath);

      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      utimesSync(shopPath, tenDaysAgo, tenDaysAgo);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      createProvider({ localProvider: { maxSnapshotAge: 0 } });
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();

      utimesSync(shopPath, originalStat.atime, originalStat.mtime);
    });
  });
});
