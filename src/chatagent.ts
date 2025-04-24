import {
	type AgentNamespace,
	type Connection,
	routeAgentRequest,
	type Agent,
	type Schedule,
} from "agents";
import { experimental_createMCPClient as createMCPClient } from "ai";
import "node:util";
import * as util from "node:util";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
	createDataStreamResponse,
	generateId,
	type Message,
	streamText,
	type StreamTextOnFinishCallback,
} from "ai";
import { processToolCallss } from "./utils";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Env } from "./env";
import { createOpenAI } from "@ai-sdk/openai";
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
			const mcpClient = await createMCPClient({
				transport: {
					type: "sse",
					url: "https://xyz.yirifi-ai.workers.dev/sse",
				},
			});

			const xtools = await mcpClient.tools();
			const dataStreamResponse = createDataStreamResponse({
				execute: async (dataStream) => {
					this.dataStream = dataStream;
					// Process any pending tool calls from previous messages
					// This handles human-in-the-loop confirmations for tools

					const processedMessages = await processToolCallss({
						messages: this.messages,
						dataStream,
						// tools: global_env.xtools,
						xtools,
						// executions,
					});
					console.log(
						"Processed Messages",
						processedMessages.slice(-1)[0].parts
					);
					// Initialize OpenAI client with API key from environment
					const openai = createOpenAI({
						apiKey: this.env.OPENAI_API_KEY,
						baseURL:
							"https://gateway.ai.cloudflare.com/v1/bed83008c8ec30d6a8ff291e41191d90/myagent/openai",
						headers: {
							"cf-aig-authorization": `Bearer ${this.env.CLOUDFLARE_AI_GATEWAY_API_KEY}`,
						},
					});

					// Stream the AI response using GPT-4
					const result = streamText({
						// model: openai("anthropic/claude-3.7-sonnet"),
						model: openai("gpt-4o"),
						system: `
            ......
          `,
						messages: processedMessages,
						// tools: global_env.xtools,
						tools: Object.fromEntries(
							Object.entries(xtools).map(([name, tool]) => {
								// set execute as undefined to avoid executing the tool

								return [
									name,
									{
										...tool,
										execute: undefined,
									},
								];
							})
						),
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						onFinish: (x: any) => {
							// console.log("=======>Finished streaming:", x.steps);
							onFinish(x);
							console.log(
								"=======>Finished streaming:",
								// biome-ignore lint/suspicious/noExplicitAny: <explanation>
								x.steps.map((s: any) => {
									return {
										text: s.text,
										tr: s.toolResults[0],
										tc: s.toolCalls[0],
									};
								})
							);
						},
						onError: (error) => {
							console.error(`error: ${error.toString()}`);
							console.error(util.inspect(error));
						},
						maxSteps: 10,
					});

					// Merge the AI response stream with tool execution outputs
					result.mergeIntoDataStream(dataStream, {
						sendUsage: true,
						sendReasoning: true,
					});

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
