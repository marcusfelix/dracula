import type { DraculaConfig } from "./config.js";
import type {
  DraculaProvider,
  ProductsNamespace,
  CollectionsNamespace,
  CartNamespace,
  ContentNamespace,
  MetaobjectsNamespace,
  SEONamespace,
  SearchNamespace,
} from "./providers/provider.js";
import { RemoteProvider } from "./providers/remote.js";
import { LocalProvider } from "./providers/local.js";

export class DraculaClient implements DraculaProvider {
  public readonly products: ProductsNamespace;
  public readonly collections: CollectionsNamespace;
  public readonly cart: CartNamespace;
  public readonly content: ContentNamespace;
  public readonly metaobjects: MetaobjectsNamespace;
  public readonly seo: SEONamespace;
  public readonly search: SearchNamespace;

  private readonly provider: DraculaProvider;
  public readonly mode: "local" | "remote";
  public readonly config: DraculaConfig;

  constructor(config: DraculaConfig) {
    this.config = config;
    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      this.provider = new LocalProvider(config);
      this.mode = "local";
      console.log(
        `[Dracula] LocalProvider active — resolving from ${config.localDataDir ?? ".dracula/blood-bank"}`
      );
    } else {
      this.provider = new RemoteProvider(config);
      this.mode = "remote";
    }

    this.products = this.provider.products;
    this.collections = this.provider.collections;
    this.cart = this.provider.cart;
    this.content = this.provider.content;
    this.metaobjects = this.provider.metaobjects;
    this.seo = this.provider.seo;
    this.search = this.provider.search;
  }
}
