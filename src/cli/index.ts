import { resolve, join } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";

const API_VERSION = "2025-04";

interface SiphonConfig {
  shop: string;
  storefrontAccessToken: string;
  apiVersion?: string;
  localDataDir?: string;
  siphon?: {
    metafieldNamespaces?: string[];
    metaobjectTypes?: string[];
    excludeCollections?: string[];
    productLimit?: number;
    includeArticleBody?: boolean;
  };
}

// ─── GraphQL Helper ──────────────────────────────────────────────────────────

async function shopifyFetch(
  config: SiphonConfig,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<unknown> {
  const domain = config.shop.includes(".")
    ? config.shop
    : `${config.shop}.myshopify.com`;
  const version = config.apiVersion ?? API_VERSION;
  const url = `https://${domain}/api/${version}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": config.storefrontAccessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: unknown; errors?: unknown[] };
  if (json.errors) {
    throw new Error(
      `GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`
    );
  }

  return json.data;
}

// ─── Paginated Fetch ─────────────────────────────────────────────────────────

async function fetchAll<T>(
  config: SiphonConfig,
  query: string,
  rootKey: string,
  variables: Record<string, unknown> = {},
  limit?: number
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const batchSize = limit ? Math.min(250, limit - items.length) : 250;
    if (batchSize <= 0) break;

    const data = (await shopifyFetch(config, query, {
      ...variables,
      first: batchSize,
      after: cursor,
    })) as Record<string, { edges: { node: T; cursor: string }[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }>;

    const connection = data[rootKey];
    if (!connection?.edges) break;

    for (const edge of connection.edges) {
      items.push(edge.node);
    }

    hasNext = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor ?? null;

    process.stdout.write(`\r  Fetched ${items.length} ${rootKey}...`);
  }

  if (items.length > 0) console.log();
  return items;
}

// ─── Siphon Queries ──────────────────────────────────────────────────────────

const SIPHON_PRODUCTS_QUERY = `
  query SiphonProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id handle title description descriptionHtml
          productType vendor tags availableForSale
          createdAt updatedAt publishedAt isGiftCard totalInventory
          priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
          compareAtPriceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
          featuredImage { id url altText width height }
          images(first: 250) {
            edges { node { id url altText width height } cursor }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
          variants(first: 250) {
            edges {
              node {
                id title sku availableForSale quantityAvailable
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                image { id url altText width height }
                selectedOptions { name value }
                requiresShipping weight weightUnit barcode currentlyNotInStock
              }
              cursor
            }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
          options { id name optionValues { name swatch { color } } }
          seo { title description }
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SIPHON_COLLECTIONS_QUERY = `
  query SiphonCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id handle title description descriptionHtml
          image { id url altText width height }
          seo { title description }
          updatedAt
          products(first: 250) {
            edges { node { id } cursor }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SIPHON_PAGES_QUERY = `
  query SiphonPages($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      edges {
        node {
          id handle title body bodySummary
          seo { title description }
          createdAt updatedAt
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SIPHON_BLOGS_QUERY = `
  query SiphonBlogs($first: Int!, $after: String) {
    blogs(first: $first, after: $after) {
      edges {
        node {
          id handle title
          seo { title description }
          articles(first: 250) {
            edges {
              node {
                id handle title content contentHtml excerpt excerptHtml
                image { id url altText width height }
                author: authorV2 { name }
                publishedAt tags
                seo { title description }
              }
              cursor
            }
            pageInfo { hasNextPage endCursor }
          }
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const SIPHON_MENUS_QUERY = `
  query SiphonMenu($handle: String!) {
    menu(handle: $handle) {
      id handle title itemsCount
      items {
        id title url type resourceId tags
        items {
          id title url type resourceId tags
          items { id title url type resourceId tags }
        }
      }
    }
  }
`;

const SIPHON_SHOP_QUERY = `
  query SiphonShop {
    shop {
      id name description
      primaryDomain { url host }
      brand {
        logo { id url altText width height }
        squareLogo { id url altText width height }
        colors { primary { background foreground } secondary { background foreground } }
        coverImage { id url altText width height }
      }
      paymentSettings {
        currencyCode acceptedCardBrands enabledPresentmentCurrencies
      }
      privacyPolicy { id title handle body url }
      refundPolicy { id title handle body url }
      shippingPolicy { id title handle body url }
      termsOfService { id title handle body url }
    }
  }
`;

const SIPHON_METAOBJECTS_QUERY = `
  query SiphonMetaobjects($type: String!, $first: Int!, $after: String) {
    metaobjects(type: $type, first: $first, after: $after) {
      edges {
        node {
          id handle type
          fields { key value type }
          updatedAt
        }
        cursor
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ─── Write Helpers ───────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function writeIndex(
  dir: string,
  items: Array<{ handle: string; id: string }>
): void {
  const index: Record<string, string> = {};
  for (const item of items) {
    index[item.handle] = item.id;
  }
  writeJson(join(dir, "_index.json"), index);
}

// ─── Config Loader ───────────────────────────────────────────────────────────

// Candidate files where a DraculaClient instance is likely exported
const CLIENT_CANDIDATES = [
  "lib/dracula.ts",
  "lib/dracula.js",
  "utils/dracula.ts",
  "utils/dracula.js",
  "src/lib/dracula.ts",
  "src/lib/dracula.js",
  "dracula.config.ts",
  "dracula.config.js",
];

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const contents = readFileSync(filePath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function loadConfig(): Promise<SiphonConfig> {
  loadEnvFile(resolve(".env.local"));
  loadEnvFile(resolve(".env"));

  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url);

  for (const candidate of CLIENT_CANDIDATES) {
    const filePath = resolve(candidate);
    if (!existsSync(filePath)) continue;

    const mod = await jiti.import(filePath) as Record<string, unknown>;

    // Look for a DraculaClient instance in any named export or default
    const exports = Object.values(mod);
    for (const value of exports) {
      if (value && typeof value === "object" && "config" in value) {
        return (value as { config: SiphonConfig }).config;
      }
    }

    // Also handle defineConfig default export (dracula.config.ts style)
    if (mod.default && typeof mod.default === "object" && "shop" in mod.default) {
      return mod.default as SiphonConfig;
    }
  }

  throw new Error(
    "No DraculaClient found. Create lib/dracula.ts with a DraculaClient export, or add a dracula.config.ts."
  );
}

// ─── Siphon Command ─────────────────────────────────────────────────────────

async function siphon(): Promise<void> {
  console.log("[Dracula] Starting siphon...\n");

  const config = await loadConfig();
  const baseDir = resolve(config.localDataDir ?? ".dracula/blood-bank");
  const excludeCollections = new Set(
    config.siphon?.excludeCollections ?? []
  );

  // Shop
  console.log("Fetching shop metadata...");
  const shopData = (await shopifyFetch(config, SIPHON_SHOP_QUERY)) as {
    shop: unknown;
  };
  ensureDir(baseDir);
  writeJson(join(baseDir, "shop.json"), shopData.shop);
  console.log("  Done.\n");

  // Products
  console.log("Fetching products...");
  const productsDir = join(baseDir, "products");
  ensureDir(productsDir);

  const products = await fetchAll<{ handle: string; id: string }>(
    config,
    SIPHON_PRODUCTS_QUERY,
    "products",
    {},
    config.siphon?.productLimit
  );

  for (const product of products) {
    writeJson(join(productsDir, `${product.handle}.json`), product);
  }
  writeIndex(productsDir, products);
  console.log(`  Wrote ${products.length} products.\n`);

  // Collections
  console.log("Fetching collections...");
  const collectionsDir = join(baseDir, "collections");
  ensureDir(collectionsDir);

  const allCollections = await fetchAll<{ handle: string; id: string }>(
    config,
    SIPHON_COLLECTIONS_QUERY,
    "collections"
  );

  const collections = allCollections.filter(
    (c) => !excludeCollections.has(c.handle)
  );

  for (const collection of collections) {
    writeJson(
      join(collectionsDir, `${collection.handle}.json`),
      collection
    );
  }
  writeIndex(collectionsDir, collections);
  console.log(`  Wrote ${collections.length} collections.\n`);

  // Pages
  console.log("Fetching pages...");
  const pagesDir = join(baseDir, "pages");
  ensureDir(pagesDir);

  const pages = await fetchAll<{ handle: string; id: string }>(
    config,
    SIPHON_PAGES_QUERY,
    "pages"
  );

  for (const page of pages) {
    writeJson(join(pagesDir, `${page.handle}.json`), page);
  }
  console.log(`  Wrote ${pages.length} pages.\n`);

  // Blogs + Articles
  console.log("Fetching blogs and articles...");
  const blogsDir = join(baseDir, "blogs");
  ensureDir(blogsDir);

  const blogs = await fetchAll<{
    handle: string;
    id: string;
    title: string;
    seo: unknown;
    articles: { edges: { node: { handle: string } }[] };
  }>(config, SIPHON_BLOGS_QUERY, "blogs");

  for (const blog of blogs) {
    const blogDir = join(blogsDir, blog.handle);
    ensureDir(blogDir);

    const { articles, ...blogMeta } = blog;
    writeJson(join(blogDir, "_blog.json"), blogMeta);

    if (articles?.edges) {
      for (const edge of articles.edges) {
        const article = edge.node;
        writeJson(
          join(blogDir, `${article.handle}.json`),
          { ...article, blog: { id: blog.id, handle: blog.handle, title: blog.title } }
        );
      }
      console.log(
        `  Blog "${blog.handle}": ${articles.edges.length} articles.`
      );
    }
  }
  console.log();

  // Menus
  console.log("Fetching menus...");
  const menusDir = join(baseDir, "menus");
  ensureDir(menusDir);

  for (const handle of ["main-menu", "footer"]) {
    try {
      const data = (await shopifyFetch(config, SIPHON_MENUS_QUERY, {
        handle,
      })) as { menu: unknown };
      if (data.menu) {
        writeJson(join(menusDir, `${handle}.json`), data.menu);
        console.log(`  Menu "${handle}": fetched.`);
      }
    } catch {
      console.log(`  Menu "${handle}": not found, skipping.`);
    }
  }
  console.log();

  // Metaobjects
  const metaobjectTypes = config.siphon?.metaobjectTypes ?? [];
  if (metaobjectTypes.length > 0) {
    console.log("Fetching metaobjects...");
    const metaDir = join(baseDir, "metaobjects");
    ensureDir(metaDir);

    for (const type of metaobjectTypes) {
      const typeDir = join(metaDir, type);
      ensureDir(typeDir);

      const items = await fetchAll<{ handle: string; id: string }>(
        config,
        SIPHON_METAOBJECTS_QUERY,
        "metaobjects",
        { type }
      );

      for (const item of items) {
        writeJson(join(typeDir, `${item.handle}.json`), item);
      }
      console.log(`  Type "${type}": ${items.length} objects.`);
    }
    console.log();
  }

  // .gitignore
  const gitignorePath = join(resolve(config.localDataDir ?? ".dracula"), ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, "blood-bank/cart.json\n");
    console.log("Created .gitignore (ignoring cart.json).");
  }

  console.log("\n[Dracula] Siphon complete.");
}

// ─── Status Command ──────────────────────────────────────────────────────────

async function status(): Promise<void> {
  const config = await loadConfig();
  const baseDir = resolve(config.localDataDir ?? ".dracula/blood-bank");

  if (!existsSync(baseDir)) {
    console.log("[Dracula] No blood-bank directory found. Run `dracula siphon` first.");
    return;
  }

  console.log("[Dracula] Blood bank status:\n");
  console.log(`  Directory: ${baseDir}`);

  const countFiles = (dir: string): number => {
    if (!existsSync(dir)) return 0;
    const { readdirSync } = require("node:fs");
    return readdirSync(dir).filter(
      (f: string) => f.endsWith(".json") && !f.startsWith("_")
    ).length;
  };

  console.log(`  Products:    ${countFiles(join(baseDir, "products"))}`);
  console.log(`  Collections: ${countFiles(join(baseDir, "collections"))}`);
  console.log(`  Pages:       ${countFiles(join(baseDir, "pages"))}`);

  const blogsPath = join(baseDir, "blogs");
  if (existsSync(blogsPath)) {
    const { readdirSync } = require("node:fs");
    const blogDirs = readdirSync(blogsPath);
    console.log(`  Blogs:       ${blogDirs.length}`);
  }

  console.log(`  Shop:        ${existsSync(join(baseDir, "shop.json")) ? "yes" : "no"}`);
}

// ─── CLI Entry ───────────────────────────────────────────────────────────────

const command = process.argv[2];

switch (command) {
  case "siphon":
    siphon().catch((err) => {
      console.error(`\n[Dracula] Error: ${err.message}`);
      process.exit(1);
    });
    break;
  case "status":
    status().catch((err) => {
      console.error(`\n[Dracula] Error: ${err.message}`);
      process.exit(1);
    });
    break;
  default:
    console.log(`
Dracula SDK CLI

Commands:
  dracula siphon   Download store data to local blood-bank
  dracula status   Show blood-bank status and record counts

Usage:
  npx dracula siphon
  npx dracula status
`);
}
