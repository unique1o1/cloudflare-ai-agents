import type { AgentNamespace } from "agents";
import type { Neo4jCacheDO } from "./do";
import type { Chat } from "./chatagent";

// Environment variables type definition
export type Env = {
  OPENAI_API_KEY: string;
  CLOUDFLARE_AI_GATEWAY_API_KEY: string;
  Chat: AgentNamespace<Chat>;
  NEO4J_CACHE: DurableObjectNamespace<Neo4jCacheDO>;
  xtools: any;
};
export let global_env: Env = undefined as any;

export function setEnv(env: Env) {
  global_env = env;
}
