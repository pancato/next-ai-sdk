import {
  convertToModelMessages,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from "ai";

import { DEFAULT_CHAT_MODEL, getChatModel } from "@/lib/models";

export const maxDuration = 30;

type ChatRequest = {
  messages?: UIMessage[];
  model?: string;
};

export async function POST(req: Request) {
  try {
    const { messages, model = DEFAULT_CHAT_MODEL }: ChatRequest =
      await req.json();

    if (!Array.isArray(messages)) {
      return Response.json({ error: "Missing messages" }, { status: 400 });
    }

    const result = streamText({
      model: getChatModel(model),
      system: [
        "你是一个 AI SDK tools 教程助手。",
        "当用户询问天气、位置、确认事项或采购/付款/删除等敏感动作时，优先演示工具调用。",
        "getWeatherInformation 是服务端自动工具；askForConfirmation 和 getBrowserLocation 需要前端按钮确认；createPurchaseOrder 需要工具执行 approval。",
        "工具完成后，用中文简短总结工具输入、用户确认结果和工具输出。",
      ].join("\n"),
      messages: await convertToModelMessages(messages),
      tools: {
        getWeatherInformation: tool({
          description: "Get mock weather information for a city.",
          inputSchema: jsonSchema<{
            city: string;
          }>({
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "The city to get weather information for.",
              },
            },
            required: ["city"],
            additionalProperties: false,
          }),
          execute: async ({ city }) => {
            const weatherByCity = [
              "晴，26°C，微风",
              "多云，22°C，适合散步",
              "小雨，18°C，建议带伞",
              "阴，20°C，湿度偏高",
            ];

            return {
              city,
              forecast:
                weatherByCity[
                  Math.abs(
                    city
                      .split("")
                      .reduce((sum, char) => sum + char.charCodeAt(0), 0),
                  ) % weatherByCity.length
                ],
              source: "mock-weather-service",
            };
          },
        }),
        askForConfirmation: tool({
          description:
            "Ask the user to confirm an action in the frontend before continuing.",
          inputSchema: jsonSchema<{
            message: string;
          }>({
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The confirmation message shown to the user.",
              },
            },
            required: ["message"],
            additionalProperties: false,
          }),
        }),
        getBrowserLocation: tool({
          description:
            "Ask the frontend to confirm access, then return a mock browser location.",
          inputSchema: jsonSchema<{
            reason: string;
          }>({
            type: "object",
            properties: {
              reason: {
                type: "string",
                description: "Why location access is requested.",
              },
            },
            required: ["reason"],
            additionalProperties: false,
          }),
        }),
        createPurchaseOrder: tool({
          description:
            "Create a mock purchase order. This server-side tool always requires user approval before execution.",
          inputSchema: jsonSchema<{
            item: string;
            quantity: number;
            budgetUsd: number;
          }>({
            type: "object",
            properties: {
              item: {
                type: "string",
                description: "The item to purchase.",
              },
              quantity: {
                type: "number",
                description: "How many items to purchase.",
              },
              budgetUsd: {
                type: "number",
                description: "The approved budget in USD.",
              },
            },
            required: ["item", "quantity", "budgetUsd"],
            additionalProperties: false,
          }),
          needsApproval: true,
          execute: async ({ item, quantity, budgetUsd }) => {
            return {
              id: `PO-${Date.now().toString(36).toUpperCase()}`,
              item,
              quantity,
              budgetUsd,
              status: "created",
            };
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stream response";

    return Response.json({ error: message }, { status: 400 });
  }
}
