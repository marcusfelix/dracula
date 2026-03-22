import { describe, it, expect } from "vitest";
import { defineConfig } from "../src/config.js";

describe("defineConfig", () => {
  it("returns config with defaults applied", () => {
    const config = defineConfig({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token123",
    });

    expect(config.shop).toBe("test.myshopify.com");
    expect(config.storefrontAccessToken).toBe("token123");
    expect(config.apiVersion).toBe("2025-04");
    expect(config.localDataDir).toBe(".dracula/blood-bank");
    expect(config.locale).toBe("en-US");
  });

  it("allows overriding defaults", () => {
    const config = defineConfig({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token123",
      apiVersion: "2024-10",
      localDataDir: "custom/path",
      locale: "de-DE",
    });

    expect(config.apiVersion).toBe("2024-10");
    expect(config.localDataDir).toBe("custom/path");
    expect(config.locale).toBe("de-DE");
  });

  it("preserves siphon config", () => {
    const config = defineConfig({
      shop: "test.myshopify.com",
      storefrontAccessToken: "token123",
      siphon: {
        metafieldNamespaces: ["custom"],
        metaobjectTypes: ["faq"],
        excludeCollections: ["hidden"],
        productLimit: 50,
      },
    });

    expect(config.siphon?.metafieldNamespaces).toEqual(["custom"]);
    expect(config.siphon?.productLimit).toBe(50);
  });
});
