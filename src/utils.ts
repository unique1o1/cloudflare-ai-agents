// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import { formatDataStreamPart, type Message } from "@ai-sdk/ui-utils";
import {
  convertToCoreMessages,
  type DataStreamWriter,
  type ToolExecutionOptions,
  type ToolSet,
} from "ai";
import { APPROVAL } from "./shared";
function isValidToolName<K extends PropertyKey, T extends object>(
  key: K,
  obj: T
): key is K & keyof T {
  return key in obj;
}

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 *
 * @param options - The function options
 * @param options.tools - Map of tool names to Tool instances that may expose execute functions
 * @param options.dataStream - Data stream for sending results back to the client
 * @param options.messages - Array of messages to process
 * @param executionFunctions - Map of tool names to execute functions
 * @returns Promise resolving to the processed messages
 */
export async function processToolCallss({
  dataStream,
  messages,

  xtools,
}: {
  // tools: Tools; // used for type inference
  dataStream: DataStreamWriter;
  messages: Message[];
  xtools: any;
}): Promise<Message[]> {
  const lastMessage = messages[messages.length - 1];
  const part =
    // lastMessage.parts?.[lastMessage.parts.length - 1];
    // biome-ignore lint/complexity/useOptionalChain: <explanation>
    lastMessage.parts && lastMessage.parts[lastMessage.parts.length - 1];
  if (!part) return messages;
  const processedpart = await (async () => {
    console.log("parttype-", part.type);
    if (part.type !== "tool-invocation") return part;

    const { toolInvocation } = part;
    const toolName = toolInvocation.toolName;

    // Only continue if we have an execute function for the tool (meaning it requires confirmation) and it's in a 'result' state
    if (!(toolName in xtools) || toolInvocation.state !== "result") {
      return part;
    }
    let result: unknown;

    if (toolInvocation.result === APPROVAL.YES) {
      // Get the tool and check if the tool has an execute function.

      const tool = xtools[toolName]!;
      if (tool) {
        result = await tool.execute(toolInvocation.args, {
          messages: convertToCoreMessages(messages),
          toolCallId: toolInvocation.toolCallId,
        });
      } else {
        result = "Error: No execute function found on tool";
      }
    } else if (toolInvocation.result === APPROVAL.NO) {
      result = "Error: User denied access to tool execution";
    } else {
      // For any unhandled responses, return the original part.
      return part;
    }
    console.log("tool result>", toolInvocation.toolCallId, result);
    dataStream.write(
      formatDataStreamPart("tool_result", {
        toolCallId: toolInvocation.toolCallId,
        result: result,
      })
    );
    return {
      ...part,
      toolInvocation: {
        ...toolInvocation,
        result,
      },
    };
  })();
  // Finally return the processed messages
  console.log("processedpart", processedpart);
  return [
    ...messages.slice(0, -1),
    {
      ...lastMessage,
      parts: [
        // @ts-ignore
        ...lastMessage.parts.slice(0, -1),
        processedpart,
      ],
    },
  ];
}
