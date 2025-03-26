import {
  type AgentNamespace,
  type Connection,
  routeAgentRequest,
  type Agent,
  type Schedule,
} from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";
import "node:util";
import * as util from "util";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  createDataStreamResponse,
  generateId,
  type Message,
  streamText,
  type StreamTextOnFinishCallback,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { processToolCallss } from "./utils";
import { executions, tools } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import { type Env } from "./env";
// we use ALS to expose the agent context to the tools
export const agentContext = new AsyncLocalStorage<Chat>();
/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   * @param onFinish - Callback function executed when streaming completes
   */
  public dataStream: any;
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  async onChatMessage(onFinish: StreamTextOnFinishCallback<{}>) {
    // Create a streaming response that handles both text and tool outputs

    return agentContext.run(this, async () => {
      const dataStreamResponse = createDataStreamResponse({
        execute: async (dataStream) => {
          this.dataStream = dataStream;
          // Process any pending tool calls from previous messages
          // This handles human-in-the-loop confirmations for tools

          const processedMessages = await processToolCallss({
            messages: this.messages,
            dataStream,
            // tools: global_env.xtools,
            tools,
            executions,
          });
          console.log("xxxxxxx");
          console.log("Processed Messages", processedMessages);
          // Initialize OpenAI client with API key from environment
          // const openai = createOpenAI({
          //   apiKey: this.env.OPENAI_API_KEY,
          // });

          // Cloudflare AI Gateway
          const openai = createOpenAI({
            apiKey: this.env.OPENAI_API_KEY,
            baseURL:
              "https://gateway.ai.cloudflare.com/v1/bed83008c8ec30d6a8fd791e41191d90/yirifi-ai-agent/openai",
            headers: {
              "cf-aig-authorization": `Bearer ${this.env.CLOUDFLARE_AI_GATEWAY_API_KEY}`,
            },
          });
          // Stream the AI response using GPT-4
          const result = streamText({
            model: openai("gpt-4o"),
            system: `You are an intelligent agent with the ability to interact with a Neo4j graph database using Cypher query language. Your purpose is to help users retrieve and analyze data stored in Neo4j by formulating appropriate Cypher queries. 

            Capabilities
            1. Interpret user requests about data stored in a Neo4j database.
            2. Get the relationship types and counts in the Neo4j database using "getNeo4jRelaitonship" tool and use exact character casin(as returned by getNeo4jRelaitonship tol)  for the relationship types.
              example:
              MATCH (N)-[R:DEALS_WITH]->(M) RETURN N, M, R // always return relationship types
              MATCH (N)-[R:BELONGS_TO]->(M)-[W:SHIPS]->(B) RETURN N, M, R,B,W // always return relationship types

            3. Formulate syntactically correct Cypher queries based on user questions and call the neo4j tool.
             3.5. Make sure to use the correct Cypher syntax and logic against users query  before querying the Neo4j database
             4. Execute queries against the Neo4j database and remember to always return relationship types.

            5. Present query results in a clear, structured format

             6.Explain query results in natural language`,
            messages: processedMessages,
            // tools: global_env.xtools,
            tools: tools,

            onFinish: (x: any) => {
              // console.log("=======>Finished streaming:", x.steps);
              console.log(
                "=======>Finished streaming:",
                x.steps.map((s: any) => {
                  return {
                    text: s.text,
                    tr: s.toolResults[0],
                    tc: s.toolCalls[0],
                  };
                })
              );

              onFinish(x);
            },
            onError: (error) => {
              console.error(`error happenedx ${error.toString()}`);
              console.error(util.inspect(error));
            },
            maxSteps: 10,
          });

          // Merge the AI response stream with tool execution outputs
          result.mergeIntoDataStream(dataStream, {
            sendUsage: true,
            sendReasoning: true,
          });
          // await new Promise((resolve) => {
          //   setTimeout(() => {
          //     resolve(); // @ts-ignore
          //   }, 6000);
          // });
          console.log("........", dataStream);
        },
      });

      return dataStreamResponse;
    });
  }
  async executeTask(description: string, task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        content: `Running scheduled task: ${description}`,
        createdAt: new Date(),
      },
    ]);
  }
}
