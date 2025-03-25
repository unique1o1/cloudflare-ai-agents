import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

export class Neo4jCacheDO extends DurableObject {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_TTL = 60 * 60 * 1000; // 1 hour cache TTL
  private state: DurableObjectState;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get("relationships");
      if (stored) {
        this.cache = new Map(Object.entries(stored));
      }
    });
  }

  // Get cached relationships or return null if not found/expired
  async getRelationships(): Promise<any | null> {
    const cacheKey = "neo4j-relationships";
    const cachedData = this.cache.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < this.CACHE_TTL) {
      return cachedData.data;
    }

    return null;
  }

  // Store relationships in cache
  async setRelationships(data: any): Promise<void> {
    const cacheKey = "neo4j-relationships";
    const cacheEntry = { data, timestamp: Date.now() };
    this.cache.set(cacheKey, cacheEntry);

    // Persist to storage
    await this.state.storage.put(
      "relationships",
      Object.fromEntries(this.cache)
    );
    return;
  }
}
