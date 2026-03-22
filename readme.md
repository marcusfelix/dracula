# Dracula SDK

High-fidelity mocking layer and data abstraction for the Shopify Storefront API.

Dracula gives you sovereign control over the data your components consume. In **development**, it resolves all Storefront API calls from a local JSON snapshot with zero latency. In **production**, it becomes a zero-overhead passthrough to Shopify's live API. Your components never change — only the runtime does.

## Install

```bash
npm install dracula-sdk
```

## Quick Start

### 1. Configure

```ts
// dracula.config.ts
import { defineConfig } from "dracula-sdk/config";

export default defineConfig({
  shop: process.env.SHOPIFY_STORE_DOMAIN!,
  storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
});
```

### 2. Create Client

```ts
// lib/dracula.ts
import { DraculaClient } from "dracula-sdk";

export const dracula = new DraculaClient({
  shop: process.env.SHOPIFY_STORE_DOMAIN!,
  storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
});
```

The client automatically selects the provider based on `NODE_ENV`:
- **`development`** — `LocalProvider` reads from `.dracula/blood-bank/` JSON files
- **`production`** — `RemoteProvider` calls Shopify Storefront GraphQL API

### 3. Siphon Your Store

Download a snapshot of your store's data:

```bash
npx dracula siphon
```

This creates `.dracula/blood-bank/` with JSON files for all products, collections, pages, blogs, menus, and shop metadata. Commit this directory to version control — every developer shares the same data.

### 4. Use in Components

```tsx
// app/products/[handle]/page.tsx
import { dracula } from "@/lib/dracula";
import type { ShopifyProduct } from "dracula-sdk/types";

export default async function ProductPage({ params }: { params: { handle: string } }) {
  const product: ShopifyProduct = await dracula.products.get({ handle: params.handle });

  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
    </main>
  );
}
```

No conditional logic. No environment checks. The component is pure.

## API Reference

### Products

```ts
dracula.products.get({ handle })              // Get product by handle
dracula.products.getById({ id })              // Get product by Shopify ID
dracula.products.list({ first, after, sortKey, reverse, query })  // List/filter products
dracula.products.search({ query, first })     // Search products
dracula.products.getRecommendations({ productId })  // Get related products
```

**Sort keys:** `TITLE`, `PRICE`, `CREATED_AT`, `BEST_SELLING`, `RELEVANCE`, `UPDATED_AT`, `ID`, `PRODUCT_TYPE`, `VENDOR`

### Collections

```ts
dracula.collections.get({ handle })           // Get collection by handle
dracula.collections.list({ first, sortKey })  // List collections
dracula.collections.getProducts({ handle, params: { first, sortKey, reverse } })
```

### Cart

```ts
dracula.cart.create({ lines, note, discountCodes, buyerIdentity })
dracula.cart.get({ cartId })
dracula.cart.addLines({ cartId, lines: [{ merchandiseId, quantity }] })
dracula.cart.updateLines({ cartId, lines: [{ id, quantity }] })
dracula.cart.removeLines({ cartId, lineIds })
dracula.cart.updateDiscountCodes({ cartId, discountCodes })
dracula.cart.updateBuyerIdentity({ cartId, buyerIdentity: { email } })
dracula.cart.updateNote({ cartId, note })
```

In development, cart state persists to `cart.json` between server restarts.

### Content

```ts
dracula.content.getPage({ handle })
dracula.content.listPages({ first })
dracula.content.getBlog({ handle })
dracula.content.listBlogs({ first })
dracula.content.getArticle({ blogHandle, articleHandle })
dracula.content.listArticles({ blogHandle, params: { sortKey, reverse } })
dracula.content.getMenu({ handle })
```

### Metaobjects

```ts
dracula.metaobjects.get({ type, handle })
dracula.metaobjects.list({ type, first })
```

### Search

```ts
dracula.search.search({ query, first, types, sortKey })
dracula.search.predictive({ query, limit, types })
```

### SEO / Shop

```ts
dracula.seo.getShop()  // Returns shop name, domain, brand, policies, payment settings
```

## Configuration

```ts
// dracula.config.ts
import { defineConfig } from "dracula-sdk/config";

export default defineConfig({
  // Required
  shop: "your-store.myshopify.com",
  storefrontAccessToken: "xxxx",

  // Optional
  apiVersion: "2025-04",              // Storefront API version
  localDataDir: ".dracula/blood-bank", // Path to local JSON store
  locale: "en-US",
  currency: "USD",

  siphon: {
    metafieldNamespaces: ["custom"],   // Metafield namespaces to pull
    metaobjectTypes: ["faq_item"],     // Metaobject types to pull
    excludeCollections: ["internal"],  // Collections to skip
    productLimit: 100,                 // Max products (default: all)
    includeArticleBody: true,
  },

  localProvider: {
    artificialDelay: 0,   // Simulate latency (ms)
    strictMode: false,    // Throw on missing data vs. empty result
  },
});
```

## CLI

```bash
npx dracula siphon    # Download store data to blood-bank
npx dracula status    # Show blood-bank record counts
```

## Directory Structure

```
.dracula/
├── blood-bank/
│   ├── products/
│   │   ├── nomad-backpack.json
│   │   └── _index.json          # handle → id lookup
│   ├── collections/
│   ├── pages/
│   ├── menus/
│   ├── blogs/
│   │   └── journal/
│   │       ├── _blog.json
│   │       └── trail-guide.json
│   ├── metaobjects/
│   ├── shop.json
│   └── cart.json                 # Gitignored, mutable in dev
└── .gitignore
```

Each product/collection file mirrors the Shopify Storefront API schema exactly. Hand-edit any file to create edge-case fixtures for testing.

## Types

All types are exported from `dracula-sdk/types`:

```ts
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
  ShopifyProductVariant,
  ShopifyImage,
  ShopifyMoneyV2,
} from "dracula-sdk/types";
```

These are direct TypeScript representations of Shopify's Storefront API schema — not Dracula-specific abstractions.

## Error Handling

```ts
import {
  DraculaNotFoundError,
  DraculaNetworkError,
  DraculaUserError,
} from "dracula-sdk";

try {
  const product = await dracula.products.get({ handle: "nonexistent" });
} catch (error) {
  if (error instanceof DraculaNotFoundError) {
    // error.resource, error.identifier
  }
  if (error instanceof DraculaNetworkError) {
    // error.status, error.retryable
  }
  if (error instanceof DraculaUserError) {
    // error.code, error.field (from Shopify userErrors)
  }
}
```

## How It Works

```
┌──────────────────────────────────────┐
│         Your Application             │
│  client.products.get({ handle })     │
└─────────────────┬────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │       DraculaClient       │
    │  Selects provider by      │
    │  NODE_ENV at init time    │
    └─────┬───────────┬─────────┘
          │           │
    development    production
          │           │
    ┌─────┴──┐  ┌─────┴────────┐
    │ Local  │  │   Remote     │
    │Provider│  │  Provider    │
    │        │  │              │
    │ Reads  │  │ Calls        │
    │ JSON   │  │ Shopify      │
    │ files  │  │ GraphQL API  │
    └────────┘  └──────────────┘
```

## Local Provider Limitations

The `LocalProvider` simulates most Shopify Storefront API behavior, but there are known differences:

**Query filter syntax is not supported.** The `query` parameter on `products.list()`, `collections.list()`, and `search.search()` performs simple keyword matching — it splits the query into words and checks if all words appear in the item's searchable text (title, description, tags, vendor, product type). Shopify's structured filter syntax (`product_type:Apparel`, `tag:sale`, `available_for_sale:true`, `price:>50`) is **not parsed**. If you pass a structured filter string, a console warning will be emitted and the query will be matched as plain text, which may return incorrect results.

**Supported locally:**
- Keyword search across product text fields
- `sortKey` + `reverse` ordering (TITLE, PRICE, CREATED_AT, UPDATED_AT, VENDOR, PRODUCT_TYPE, ID)
- `first`/`after` cursor pagination
- Cart mutations with JSON persistence

**Not supported locally (works in production via RemoteProvider):**
- Structured filter strings (`product_type:X`, `tag:X`, `price:>N`, boolean filters)
- `BEST_SELLING` and `RELEVANCE` sort keys (falls back to title sort)
- Discount code validation (codes are always marked as applicable)

## License

MIT
