# Dracula SDK

> **"Technology is the servant. Human intent is the master."**

---

## Manifesto

Every developer who has built a headless Shopify storefront knows the feeling:
you're iterating on a UI component — a product carousel, a filter panel, a cart
drawer — and you need to test a specific edge case. A product with six variants
and no images. A collection with exactly one item. A cart with a line-item
discount applied alongside a free-shipping threshold.

You can't manufacture these states from a staging environment without either
polluting your production catalog or maintaining a fragile, manually-curated dev
store that drifts from reality within weeks. So you do what everyone does: you
hardcode a fixture, write a one-off mock, or — worst of all — you test against
live production data and pray.

**Dracula SDK** is the structural answer to this problem.

It is not a testing framework. It is not a CMS abstraction. It is a
**High-Fidelity Mocking Layer and Data Abstraction Layer (DAL)** for the Shopify
Storefront API. Its purpose is singular: give the frontend developer sovereign
control over the data their components consume, without touching a single live
record.

The mechanism is simple. Dracula "siphons" a real store's data into a local
directory — a snapshot of truth — and then intercepts all Storefront API calls
in development, resolving them from that local state with zero network latency,
zero rate-limit risk, and zero infrastructure overhead. In production, the layer
dissolves completely. The client becomes a direct, zero-overhead passthrough to
Shopify's own API.

The frontend component never changes. The query never changes. The types never
change. Only the runtime changes.

That is the servant pattern. The technology disappears. The developer's intent
is what remains.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Provider System](#provider-system)
3. [The Siphon CLI](#the-siphon-cli)
4. [API Coverage](#api-coverage)
5. [Directory Blueprint](#directory-blueprint)
6. [TypeScript Interface System](#typescript-interface-system)
7. [Usage: Next.js App Router](#usage-nextjs-app-router)
8. [Configuration Reference](#configuration-reference)
9. [Development Roadmap](#development-roadmap)
10. [Design Constraints & Non-Goals](#design-constraints--non-goals)

---

## Core Architecture

At runtime, there is a single entry point: `DraculaClient`. The client's
behavior is entirely determined by the environment it runs in. It does not
expose dual APIs. It does not require conditional imports. It does not leak
environment logic into the consumer's code.

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Frontend                   │
│          (Server Components, Route Handlers)        │
└──────────────────────────┬──────────────────────────┘
                           │  Calls e.g.
                           │  client.products.get({ handle: 'nomad-pack' })
                           ▼
┌─────────────────────────────────────────────────────┐
│                   DraculaClient                     │
│             (Unified Public Interface)              │
│                                                     │
│   Reads NODE_ENV at initialization. Selects and     │
│   instantiates one provider. Consumer code is       │
│   never aware of which one is active.               │
└────────────┬──────────────────────────┬─────────────┘
             │                          │
     NODE_ENV=development       NODE_ENV=production
             │                          │
             ▼                          ▼
┌────────────────────┐      ┌────────────────────────┐
│   LocalProvider    │      │    RemoteProvider       │
│                    │      │                         │
│  Reads from local  │      │  Thin wrapper around    │
│  /.dracula/        │      │  Shopify Storefront     │
│  blood-bank/ JSON  │      │  GraphQL API            │
│  files. Simulates  │      │  (2026-01 schema).      │
│  filtering, pagi-  │      │  Adds auth headers,     │
│  nation, sorting   │      │  handles errors,        │
│  in-process.       │      │  normalizes responses.  │
└────────────────────┘      └────────────────────────┘
             │
             ▼
┌────────────────────┐
│  /.dracula/        │
│  blood-bank/       │
│  (Local JSON Store)│
│                    │
│  products/         │
│  collections/      │
│  menus/            │
│  pages/            │
│  blogs/            │
│  metafields/       │
│  cart.json         │
└────────────────────┘
```

The architecture enforces a hard constraint: **the shape of the data returned by
`LocalProvider` and `RemoteProvider` must be byte-for-byte identical** at the
TypeScript type level. This is guaranteed by the shared interface layer (see
[TypeScript Interface System](#typescript-interface-system)), and any deviation
is a breaking bug, not a feature flag.

---

## Provider System

### `RemoteProvider`

The `RemoteProvider` is the production-mode implementation. It is a disciplined,
opinionated wrapper around Shopify's Storefront GraphQL API at the **2026-01 API
version**.

Its responsibilities are:

- Maintaining the authenticated `fetch` context (Storefront API access token,
  API version, shop domain).
- Translating Dracula's method calls into the correct GraphQL queries/mutations.
- Normalizing Shopify's response envelope (stripping `data.{root}`, handling
  `edges`/`node` connection patterns, surfacing `userErrors` as typed
  exceptions).
- Implementing retry logic with exponential backoff for transient `429` and
  `5xx` responses.

The `RemoteProvider` adds **zero business logic**. It does not filter. It does
not sort. It delegates everything to Shopify and returns the normalized result.

### `LocalProvider`

The `LocalProvider` is the development-mode implementation. It loads the local
JSON data store into memory on initialization and resolves all queries against
that in-memory state.

Its responsibilities are:

- Loading and indexing the `blood-bank/` JSON files on startup (by `id`,
  `handle`, and relevant relational keys).
- Implementing Shopify's own query semantics: `first`/`after` cursor pagination,
  `sortKey` + `reverse` ordering, `query` filter strings (e.g.,
  `product_type:Apparel tag:sale`).
- Persisting cart state to `/.dracula/blood-bank/cart.json` for cross-request
  durability in dev mode.
- Returning data in the **exact same normalized shape** as `RemoteProvider`.

The `LocalProvider` is, in effect, a partial in-process reimplementation of
Shopify's backend query engine, scoped to the operations the SDK exposes. It is
not a general-purpose GraphQL engine. It resolves only the calls Dracula knows
about.

### Provider Interface Contract

Both providers implement the same internal `DraculaProvider` interface:

```typescript
interface DraculaProvider {
  products: ProductsNamespace;
  collections: CollectionsNamespace;
  cart: CartNamespace;
  content: ContentNamespace;
  seo: SEONamespace;
}
```

The `DraculaClient` class satisfies this interface by delegating to whichever
provider was resolved at init time. There is no abstraction at the method level
beyond this interface.

---

## The Siphon CLI

The `siphon` command is the bootstrapping tool. It connects to a live Shopify
store and downloads a snapshot of its data into the local `blood-bank/`
directory.

```bash
npx dracula siphon
```

### What It Fetches

The siphon performs a paginated, recursive traversal of the following Storefront
API endpoints:

| Resource             | Siphon Behavior                                                                      |
| -------------------- | ------------------------------------------------------------------------------------ |
| `products`           | All products, all variants, all images, all metafields matching configured namespace |
| `collections`        | All collections + their product associations (IDs only, not full product data)       |
| `menus`              | All menus by handle, full item tree                                                  |
| `pages`              | All pages, full body HTML + SEO fields                                               |
| `blogs` + `articles` | All blogs, all articles, full content                                                |
| `metaobjects`        | All metaobjects matching configured types                                            |

The siphon handles Shopify's connection-based pagination automatically, issuing
as many requests as necessary to exhaust each cursor until all data is local.

### Siphon Configuration

The CLI reads from `dracula.config.ts` in the project root:

```typescript
// dracula.config.ts
import { defineConfig } from "dracula-sdk/config";

export default defineConfig({
  shop: process.env.SHOPIFY_STORE_DOMAIN!,
  storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: "2026-01",
  siphon: {
    metafieldNamespaces: ["custom", "accentuate", "my_app"],
    metaobjectTypes: ["faq_item", "brand_story"],
    excludeCollections: ["internal-test", "wholesale-hidden"],
  },
});
```

### Output Behavior

Each resource type is written to a separate file or directory. Products, for
example, are written to individual files (`{handle}.json`) under
`blood-bank/products/` rather than a single monolithic array. This makes diffs
meaningful in version control and allows surgical edits to individual records
without touching the entire dataset.

**The `blood-bank/` directory is intended to be committed to version control.**
This is a deliberate design decision: it means every developer on the team
shares the same data snapshot, and changes to that snapshot are tracked,
reviewable, and reversible — just like any other fixture.

---

## API Coverage

### Products

```typescript
client.products.get({ handle: string }): Promise<ShopifyProduct>
client.products.list(params: ProductListParams): Promise<ShopifyProductConnection>
client.products.search(params: ProductSearchParams): Promise<ShopifyProductConnection>
client.products.getRecommendations({ productId: string }): Promise<ShopifyProduct[]>
client.products.getByIds({ ids: string[] }): Promise<ShopifyProduct[]>
```

**`ProductListParams`** supports: `first`, `after` (cursor), `sortKey`
(`TITLE | PRICE | CREATED_AT | BEST_SELLING | RELEVANCE`), `reverse`, `query`
(Shopify filter string).

In `LocalProvider`, `getRecommendations` resolves by shared tags and product
type — a deterministic heuristic, not ML. In `RemoteProvider`, it delegates to
Shopify's native recommendation endpoint.

### Collections

```typescript
client.collections.get({ handle: string }): Promise<ShopifyCollection>
client.collections.list(params: CollectionListParams): Promise<ShopifyCollectionConnection>
client.collections.getProducts({ handle: string, params: ProductListParams }): Promise<ShopifyProductConnection>
```

### Cart / Checkout

Cart operations are stateful. In `RemoteProvider`, they map 1:1 to Shopify's
Storefront Cart API mutations. In `LocalProvider`, the cart state is persisted
to `/.dracula/blood-bank/cart.json` and mutations are applied in-memory then
flushed to disk, providing a durable local checkout flow.

```typescript
client.cart.create(params: CartCreateParams): Promise<ShopifyCart>
client.cart.get({ cartId: string }): Promise<ShopifyCart>
client.cart.addLines({ cartId: string, lines: CartLineInput[] }): Promise<ShopifyCart>
client.cart.updateLines({ cartId: string, lines: CartLineUpdateInput[] }): Promise<ShopifyCart>
client.cart.removeLines({ cartId: string, lineIds: string[] }): Promise<ShopifyCart>
client.cart.applyDiscountCode({ cartId: string, discountCode: string }): Promise<ShopifyCart>
client.cart.updateBuyerIdentity({ cartId: string, buyerIdentity: CartBuyerIdentityInput }): Promise<ShopifyCart>
```

The cart `LocalProvider` does not simulate actual discount validation — it
applies the code and marks it as "applied." This is intentional and documented.
Discount logic is Shopify's domain.

### Content & SEO

```typescript
client.content.getPage({ handle: string }): Promise<ShopifyPage>
client.content.listPages(): Promise<ShopifyPage[]>
client.content.getBlog({ handle: string }): Promise<ShopifyBlog>
client.content.getArticle({ blogHandle: string, articleHandle: string }): Promise<ShopifyArticle>
client.content.listArticles({ blogHandle: string, params: ArticleListParams }): Promise<ShopifyArticleConnection>
client.content.getMenu({ handle: string }): Promise<ShopifyMenu>
client.seo.getShop(): Promise<ShopifyShop>
```

---

## Directory Blueprint

```
your-project/
├── dracula.config.ts
│
└── .dracula/
    │
    ├── blood-bank/                  # Committed to version control
    │   │
    │   ├── products/
    │   │   ├── nomad-backpack.json
    │   │   ├── trail-vest.json
    │   │   └── _index.json          # { handle → id } lookup map, auto-generated
    │   │
    │   ├── collections/
    │   │   ├── mens-apparel.json
    │   │   ├── new-arrivals.json
    │   │   └── _index.json
    │   │
    │   ├── menus/
    │   │   ├── main-menu.json
    │   │   └── footer-menu.json
    │   │
    │   ├── pages/
    │   │   ├── about-us.json
    │   │   └── sustainability.json
    │   │
    │   ├── blogs/
    │   │   └── journal/
    │   │       ├── _blog.json       # Blog metadata
    │   │       ├── winter-prep.json
    │   │       └── trail-guide.json
    │   │
    │   ├── metaobjects/
    │   │   └── faq_item/
    │   │       ├── returns-policy.json
    │   │       └── sizing-guide.json
    │   │
    │   ├── cart.json                # Mutable in dev. Gitignored by default.
    │   └── shop.json                # Store-level metadata (name, currency, SEO)
    │
    └── .gitignore                   # Auto-generated: ignores cart.json
```

### Anatomy of a Product File

Each product JSON file mirrors the normalized Shopify `Product` node exactly.
There is no Dracula-specific schema — it is a serialized `ShopifyProduct`
interface. This means:

1. The file is human-readable and human-editable.
2. You can manufacture edge-case data (a product with no images, a variant with
   `availableForSale: false`) by hand-editing the JSON.
3. TypeScript knows the shape. If you edit a file into an invalid state, the
   `LocalProvider` will surface a typed validation error on startup.

---

## TypeScript Interface System

All interfaces are exported from `dracula-sdk/types` and are designed to be used
globally across the consuming application. They are **not** Dracula-specific
abstractions — they are direct TypeScript representations of the Shopify
Storefront API 2026-01 schema.

```typescript
// dracula-sdk/types

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
  createdAt: string; // ISO 8601
  updatedAt: string;
  publishedAt: string;
  priceRange: ShopifyPriceRange;
  compareAtPriceRange: ShopifyPriceRange;
  images: ShopifyImageConnection;
  variants: ShopifyProductVariantConnection;
  options: ShopifyProductOption[];
  collections: ShopifyCollectionConnection;
  metafields: ShopifyMetafieldConnection;
  seo: ShopifySEO;
  featuredImage: ShopifyImage | null;
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
  metafields: ShopifyMetafieldConnection;
  requiresShipping: boolean;
  weight: number | null;
  weightUnit: "KILOGRAMS" | "GRAMS" | "POUNDS" | "OUNCES";
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  createdAt: string;
  updatedAt: string;
  totalQuantity: number;
  lines: ShopifyCartLineConnection;
  cost: ShopifyCartCost;
  discountCodes: ShopifyCartDiscountCode[];
  buyerIdentity: ShopifyCartBuyerIdentity;
  note: string | null;
  attributes: ShopifyAttribute[];
}

// Connection + Edge pattern mirrors the Storefront API exactly
export interface ShopifyConnection<T> {
  edges: Array<{
    node: T;
    cursor: string;
  }>;
  pageInfo: ShopifyPageInfo;
}

export interface ShopifyPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

// Type aliases for common connections
export type ShopifyProductConnection = ShopifyConnection<ShopifyProduct>;
export type ShopifyProductVariantConnection = ShopifyConnection<
  ShopifyProductVariant
>;
export type ShopifyCollectionConnection = ShopifyConnection<ShopifyCollection>;
export type ShopifyCartLineConnection = ShopifyConnection<ShopifyCartLine>;
export type ShopifyImageConnection = ShopifyConnection<ShopifyImage>;
export type ShopifyMetafieldConnection = ShopifyConnection<ShopifyMetafield>;
export type ShopifyArticleConnection = ShopifyConnection<ShopifyArticle>;
```

The intent is that these types are imported once — ideally via a global
`types.d.ts` or `tsconfig.json` path alias — and used throughout the application
without re-importing from Dracula. The developer's components reference
`ShopifyProduct`, not `DraculaProduct`.

---

## Usage: Next.js App Router

### 1. Install and Configure

```bash
npm install dracula-sdk
```

```typescript
// lib/dracula.ts
import { DraculaClient } from "dracula-sdk";

export const dracula = new DraculaClient({
  shop: process.env.SHOPIFY_STORE_DOMAIN!,
  storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN!,
  apiVersion: "2026-01",
});
```

The client resolves its provider once, at instantiation. In `development`, it
will print a single log line to stdout:
`[Dracula] LocalProvider active — resolving from /.dracula/blood-bank`. In
`production`, it is silent.

### 2. Fetch a Product in a Server Component

```typescript
// app/products/[handle]/page.tsx
import { dracula } from "@/lib/dracula";
import { notFound } from "next/navigation";
import type { ShopifyProduct } from "dracula-sdk/types";

interface Props {
  params: { handle: string };
}

export default async function ProductPage({ params }: Props) {
  const product: ShopifyProduct = await dracula.products.get({
    handle: params.handle,
  });

  if (!product) notFound();

  return (
    <main>
      <h1>{product.title}</h1>
      <p>{product.description}</p>
      {/* product.variants, product.images, etc. are all typed */}
    </main>
  );
}

export async function generateStaticParams() {
  const { edges } = await dracula.products.list({ first: 250 });
  return edges.map(({ node }) => ({ handle: node.handle }));
}
```

There is no conditional logic in the component. No
`if (process.env.NODE_ENV === 'development')`. The component is pure. The
environment is Dracula's concern.

### 3. Product Listing with Filtering

```typescript
// app/collections/[handle]/page.tsx
import { dracula } from "@/lib/dracula";
import type { ShopifyProductConnection } from "dracula-sdk/types";

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: { handle: string };
  searchParams: { sort?: string; after?: string };
}) {
  const products: ShopifyProductConnection = await dracula.collections
    .getProducts({
      handle: params.handle,
      params: {
        first: 24,
        after: searchParams.after,
        sortKey: (searchParams.sort as any) ?? "BEST_SELLING",
      },
    });

  return (
    <section>
      {products.edges.map(({ node }) => (
        <ProductCard key={node.id} product={node} />
      ))}
      {products.pageInfo.hasNextPage && (
        <LoadMoreButton cursor={products.pageInfo.endCursor} />
      )}
    </section>
  );
}
```

In development, `LocalProvider` will parse the `sortKey` and apply it in-memory.
In production, `RemoteProvider` passes it directly to Shopify's collection
query.

### 4. Cart Operations in a Server Action

```typescript
// app/actions/cart.ts
"use server";

import { dracula } from "@/lib/dracula";
import { cookies } from "next/headers";

export async function addToCart(variantId: string, quantity: number) {
  const cookieStore = cookies();
  let cartId = cookieStore.get("cartId")?.value;

  if (!cartId) {
    const cart = await dracula.cart.create({
      lines: [{ merchandiseId: variantId, quantity }],
    });
    cookieStore.set("cartId", cart.id, { httpOnly: true, sameSite: "lax" });
    return cart;
  }

  return dracula.cart.addLines({
    cartId,
    lines: [{ merchandiseId: variantId, quantity }],
  });
}
```

In development, this cart state will persist to `/.dracula/blood-bank/cart.json`
between server restarts, giving you a durable local checkout flow.

---

## Configuration Reference

```typescript
// dracula.config.ts (full reference)
import { defineConfig } from "dracula-sdk/config";

export default defineConfig({
  // Required
  shop: "your-store.myshopify.com",
  storefrontAccessToken: "xxxx",
  apiVersion: "2026-01",

  // Optional
  localDataDir: ".dracula/blood-bank", // Default shown
  locale: "en-US", // Default: 'en-US'
  currency: "USD", // Default: from shop.json after siphon

  siphon: {
    // Metafield namespaces to pull during `npx dracula siphon`
    metafieldNamespaces: ["custom"],

    // Metaobject types to pull
    metaobjectTypes: [],

    // Collection handles to exclude from siphon (e.g., hidden/internal)
    excludeCollections: [],

    // Max products to siphon (default: all)
    productLimit: undefined,

    // Whether to pull article body HTML (can be large; default: true)
    includeArticleBody: true,
  },

  localProvider: {
    // Simulate network latency in local mode (ms). Useful for UX testing.
    artificialDelay: 0,

    // Strict mode: throw on any query that has no matching local data
    // vs. returning an empty result. Default: false
    strictMode: false,
  },
});
```

---

## Development Roadmap

### Phase 1 — Interface Layer & Remote Provider (v0.1.x)

The goal of Phase 1 is to ship a production-usable `RemoteProvider` with a
complete TypeScript interface suite. At this stage, Dracula functions as a
well-typed, opinionated Shopify Storefront API client — valuable on its own,
before any mocking capability is added.

**Deliverables:**

- [ ] Full `ShopifyProduct`, `ShopifyCollection`, `ShopifyCart`,
      `ShopifyContent` TypeScript interfaces at 2026-01 parity
- [ ] `RemoteProvider` implementation for all covered API namespaces
- [ ] `DraculaClient` instantiation and provider resolution
- [ ] Error type system: `DraculaNetworkError`, `DraculaNotFoundError`,
      `DraculaUserError`
- [ ] `dracula.config.ts` schema and `defineConfig` helper
- [ ] README, JSDoc coverage on all public APIs
- [ ] Unit tests for response normalization logic

### Phase 2 — Siphon CLI (v0.2.x)

Phase 2 ships the `npx dracula siphon` command and the file system conventions
of the `blood-bank/` directory. At the end of this phase, a developer can
snapshot their store and inspect the local JSON — but the `LocalProvider` is not
yet active.

**Deliverables:**

- [ ] `dracula siphon` CLI command with progress reporting
- [ ] Paginated, cursor-exhausting fetcher for all resource types
- [ ] `_index.json` generation for O(1) handle/id lookups
- [ ] `dracula status` command: shows siphon date, record counts, API version
      drift detection
- [ ] `dracula diff` command: re-siphons and shows what has changed since last
      snapshot
- [ ] `.dracula/.gitignore` auto-generation (ignores `cart.json`)
- [ ] Integration tests against Shopify's mock API

### Phase 3 — Local Query Engine & Full Mocking (v0.3.x)

Phase 3 completes the core promise: the `LocalProvider` becomes fully
operational. All API calls in `development` resolve from local state. This is
the release that delivers the zero-latency, zero-risk development experience.

**Deliverables:**

- [ ] `LocalProvider` in-memory index builder with startup validation
- [ ] Filter/sort/pagination engine for Products and Collections (Shopify query
      string parser)
- [ ] Local cart state engine with JSON persistence
- [ ] `getRecommendations` heuristic resolver (tag + type overlap scoring)
- [ ] `artificialDelay` config option for latency simulation
- [ ] `strictMode` option for catching missing local fixtures early
- [ ] End-to-end integration test suite: same query, both providers, assert
      output parity

### Post-v1.0 Considerations (Unscheduled)

- **`dracula studio`**: A local web UI for browsing, editing, and crafting
  edge-case fixtures in the `blood-bank/` without touching JSON by hand.
- **Webhook simulation**: `dracula webhooks emit product.updated` — fires a mock
  Shopify webhook at a local endpoint for testing real-time update handlers.
- **Multi-locale support**: Siphon and resolve in multiple `Accept-Language`
  contexts.
- **Admin API read layer**: Siphon inventory levels and fulfillment data that
  the Storefront API does not expose.
- **Plugin system**: Allow third-party packages to register custom namespace
  resolvers (e.g., a Reviews provider that resolves from a local `judgeme.json`
  fixture).

---

## Design Constraints & Non-Goals

**Dracula is not a GraphQL client.** It does not accept raw GraphQL strings. It
exposes a typed method API. This is deliberate: the abstraction boundary has to
hold at the type level, and a passthrough GraphQL interface would make
`LocalProvider` impossible to implement reliably.

**Dracula does not mock the Admin API.** The Storefront API is the correct
scope. Admin API interactions (inventory management, order creation,
fulfillment) carry real business consequences and are outside the UI development
workflow this tool targets.

**Dracula does not manage secrets.** Environment variables are the consumer's
responsibility. The SDK reads them from configuration; it does not provide a
secrets vault or `.env` management.

**Dracula does not replace `msw` or `jest` fixtures for unit testing.** It is a
runtime development tool, not a test double library. You can use the
`blood-bank/` JSON as input to your own test fixtures, but Dracula itself is not
a test framework.

**The `LocalProvider` is not eventually consistent.** The data is a snapshot. It
does not poll for updates. Run `npx dracula siphon` when you need a fresher
snapshot. This is a feature: consistency and predictability are the point.

---

## Contributing

This project is in pre-release specification phase. The interfaces and
conventions described in this document are considered stable for the purposes of
implementation planning. Breaking changes to the public API surface will be
tracked in `CHANGELOG.md` with full migration notes.

To contribute, open an issue with the `[RFC]` prefix before submitting a pull
request for any change that affects the public API surface, provider contract,
or `blood-bank/` directory structure.

---

## License

MIT — See `LICENSE` for full terms.

---

_Built for developers who are tired of begging production for permission to do
their job._
