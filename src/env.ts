import type { AgentNamespace } from "agents";
import type { Chat } from "./chatagent";

// Environment variables type definition
export type Env = {
  OPENAI_API_KEY: string;
  CLOUDFLARE_AI_GATEWAY_API_KEY: string;
  Chat: AgentNamespace<Chat>;
};
