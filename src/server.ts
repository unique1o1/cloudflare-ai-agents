import {
  type AgentNamespace,
  type Connection,
  routeAgentRequest,
  type Agent,
  type Schedule,
} from "agents";

import { type Env } from "./env";
export { Chat } from "./chatagent";
import { experimental_createMCPClient as createMCPClient } from "ai";

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // const mcpClient = await createMCPClient({
    //   transport: {
    //     type: "sse",
    //     url: "https://yrifi-mcp-server.yirifi-ai.workers.dev/sse",
    //   },
    // });

    // const xtools = await mcpClient.tools();
    // console.log(
    //   "asd>",
    //   global_env.xtools.add.execute,
    //   await global_env.xtools.add.execute(
    //     { a: 12, b: 233 },
    //     { messages: [], toolCallId: "1" }
    //   )
    // );
    // console.log("xtools", xtools);
    if (!env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
      return new Response("OPENAI_API_KEY is not set", { status: 500 });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const response = await routeAgentRequest(request, env);
    if (response) {
      if (request.headers.get("upgrade") === "websocket") {
        return response;
      }
      return new Response(response.body, {
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
