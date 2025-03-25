import {
  type AgentNamespace,
  type Connection,
  routeAgentRequest,
  type Agent,
  type Schedule,
} from "agents";

import { unstable_getSchedulePrompt } from "agents/schedule";

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
import { executions } from "./tools";
import { AsyncLocalStorage } from "node:async_hooks";
import { global_env, type Env } from "./env";

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
          console.log("asdx>>>");
          this.ctx.waitUntil(
            global_env.xtools.add.execute(
              { a: 1231, b: 233 },
              { messages: [], toolCallId: "1" }
            )
          );
          const processedMessages = await processToolCallss({
            messages: this.messages,
            dataStream,
            tools: global_env.xtools,
            // executions,
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
            call tool according to users prompt`,
            messages: processedMessages,
            tools: global_env.xtools,

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
              console.error("Error while streaming:", error);
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
