import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve } from "node:path";
import { DraculaClient } from "../src/client.js";

const FIXTURES_DIR = resolve(__dirname, "fixtures/.dracula/blood-bank");

describe("DraculaClient", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("uses LocalProvider in development mode", () => {
    process.env.NODE_ENV = "development";

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const client = new DraculaClient({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token",
      localDataDir: FIXTURES_DIR,
    });

    expect(client.mode).toBe("local");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("LocalProvider active")
    );
    consoleSpy.mockRestore();
  });

  it("uses RemoteProvider in production mode", () => {
    process.env.NODE_ENV = "production";

    const client = new DraculaClient({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token",
    });

    expect(client.mode).toBe("remote");
  });

  it("exposes all namespace properties", () => {
    process.env.NODE_ENV = "development";

    vi.spyOn(console, "log").mockImplementation(() => {});
    const client = new DraculaClient({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token",
      localDataDir: FIXTURES_DIR,
    });

    expect(client.products).toBeDefined();
    expect(client.collections).toBeDefined();
    expect(client.cart).toBeDefined();
    expect(client.content).toBeDefined();
    expect(client.metaobjects).toBeDefined();
    expect(client.seo).toBeDefined();
    expect(client.search).toBeDefined();
    vi.restoreAllMocks();
  });

  it("works end-to-end in local mode", async () => {
    process.env.NODE_ENV = "development";
    vi.spyOn(console, "log").mockImplementation(() => {});

    const client = new DraculaClient({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token",
      localDataDir: FIXTURES_DIR,
    });

    const product = await client.products.get({ handle: "nomad-backpack" });
    expect(product.title).toBe("Nomad Backpack");

    const collection = await client.collections.get({
      handle: "outdoor-gear",
    });
    expect(collection.title).toBe("Outdoor Gear");

    const shop = await client.seo.getShop();
    expect(shop.name).toBe("Test Outdoor Store");

    vi.restoreAllMocks();
  });
});
