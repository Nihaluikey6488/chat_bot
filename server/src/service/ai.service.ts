import { ChatMistralAI } from "@langchain/mistralai";
import { createAgent, HumanMessage, AIMessage, ToolMessage } from "langchain";
import { env } from "../config/env.js";
import * as z from "zod";
import { model } from "mongoose";
import { MongoMessage } from "../types/chat";
import {
  getMemoryTool,
  updateMemoryTool,
  getWebResultTool,
  generateImageTool,
} from "./ai/tools.js";

const smallModel = new ChatMistralAI({
  model: "open-mistral-nemo",
  apiKey: env.mistralApiKey,
});
const mediumModel = new ChatMistralAI({
  model: "open-mistral-nemo",
  apiKey: env.mistralApiKey,
});

export async function getConversationTitle({
  message,
}: {
  message: string;
}): Promise<string> {
  const agent = createAgent({
    model: smallModel,
    responseFormat: z.object({
      title: z
        .string()
        .max(30)
        .describe("The title of the conversation, max 30 characters"),
    }),
    systemPrompt: `You are an assistant that generates a concise title for a conversation based on the user's first message.`,
  });

  const response = await agent.invoke({
    messages: [new HumanMessage(message)],
  });

  return response.structuredResponse.title;
}

export async function getStream({
  messages,
  userId,
}: {
  messages: MongoMessage[];
  userId: string;
}): Promise<ReadableStream> {
  const agent = createAgent({
    model: smallModel,
    tools: [
      getMemoryTool,
      updateMemoryTool,
      getWebResultTool,
      generateImageTool,
    ],
    systemPrompt: `
        You are a helpful AI assistant.

        MEMORY:
        - Read memory context to personalize conversations.
        - Update memory when you learn relevant long-term facts.

        WEB:
        - Use the web search tool when current or unknown information
          requires external verification.

IMAGE GENERATION:
- When the user explicitly requests an image, call generateImage.
- Wait for the tool result before describing the generated image.
- After successful generation, provide exactly five concise lines:
  1. Subject: What is shown in the image.
  2. Environment: The surroundings and background.
  3. Colors: The dominant colors and color palette.
  4. Lighting: The lighting, shadows, and atmosphere.
  5. Style: The artistic or visual style.
- Do not claim the image was generated if the tool fails.

        Current Date: ${new Date().toISOString().split("T")[0]}
    `,
  });

  const stream = await agent.stream(
    {
      messages: messages.map((message) => {
        if (message.author === "user") {
          return new HumanMessage(message.content);
        } else if (message.author === "ai") {
          return new AIMessage({
            content: message.content,
            tool_calls: message.toolCalls?.map((toolCall) => ({
              name: toolCall.name || "",
              args: toolCall.arguments || {},
              id: toolCall.id || "",
            })),
          });
        } else {
          return new ToolMessage({
            content: message.content,
            tool_call_id: message.toolCallId || "",
          });
        }
      }),
    },
    {
      streamMode: ["messages", "values"],
      configurable: {
        userId: userId,
      },
    },
  );
  return stream;
}
