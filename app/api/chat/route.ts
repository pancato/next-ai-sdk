import { convertToModelMessages, streamText, type UIMessage } from "ai";

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
        "你是一个基础聊天助手。",
        "专注演示 AI SDK 的纯聊天能力，不调用 tools。",
        "用中文自然、简洁地回答用户问题。",
      ].join("\n"),
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stream response";

    return Response.json({ error: message }, { status: 400 });
  }
}
