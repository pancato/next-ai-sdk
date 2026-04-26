"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import { DEFAULT_CHAT_MODEL, chatModels } from "@/lib/models/catalog";

const modelsByProvider = Object.entries(
  chatModels.reduce<Record<string, (typeof chatModels)[number][]>>(
    (groups, model) => {
      groups[model.provider] = [...(groups[model.provider] ?? []), model];
      return groups;
    },
    {},
  ),
);

type ChatMessagePart = UIMessage["parts"][number];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const isBusy = status === "submitted" || status === "streaming";
  const selectedModelLabel = useMemo(
    () => chatModels.find((model) => model.id === selectedModel)?.name,
    [selectedModel],
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isBusy) {
      return;
    }

    clearError();
    setInput("");
    await sendMessage({ text }, { body: { model: selectedModel } });
  }

  function renderMessagePart(part: ChatMessagePart, index: number) {
    if (part.type === "text") {
      return <Fragment key={index}>{part.text}</Fragment>;
    }

    return null;
  }

  return (
    <main className="flex min-h-svh bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col border-x border-zinc-200 bg-white">
        <header className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">AI Chat</h1>
              <Link className="text-sm text-zinc-500 hover:text-zinc-950" href="/tools">
                Tools 示例
              </Link>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              当前模型：{selectedModelLabel}
            </p>
          </div>

          <label className="flex min-w-0 flex-col gap-1 text-sm text-zinc-600 sm:w-80">
            <span className="font-medium text-zinc-800">模型</span>
            <select
              className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition-colors hover:border-zinc-300 focus:border-zinc-500"
              disabled={isBusy}
              value={selectedModel}
              onChange={(event) =>
                setSelectedModel(
                  event.currentTarget.value as typeof selectedModel,
                )
              }
            >
              {modelsByProvider.map(([provider, models]) => (
                <optgroup key={provider} label={provider}>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </header>

        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="max-w-md text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    基础聊天
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    这里只演示普通对话流，不包含 tools、approval 或前端工具确认。
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent
                    className={
                      message.role === "user"
                        ? "max-w-[82%] bg-zinc-950 text-white"
                        : "max-w-[88%] bg-zinc-100 text-zinc-950"
                    }
                    isStreaming={
                      status === "streaming" &&
                      message.id === messages.at(-1)?.id
                    }
                  >
                    <div className="flex flex-col gap-3">
                      {message.parts.map(renderMessagePart)}
                    </div>
                  </MessageContent>
                </Message>
              ))
            )}

            {status === "submitted" ? (
              <Message from="assistant">
                <MessageContent className="bg-zinc-100 text-zinc-500">
                  正在连接模型...
                </MessageContent>
              </Message>
            ) : null}

            <div ref={scrollAnchorRef} />
          </ConversationContent>
        </Conversation>

        {error ? (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6">
            {error.message}
          </div>
        ) : null}

        <div className="border-t border-zinc-200 bg-zinc-50 p-4 sm:p-6">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              aria-label="聊天输入"
              disabled={isBusy}
              placeholder="输入消息，按 Enter 发送，Shift + Enter 换行"
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <PromptInputToolbar>
              <span className="text-xs text-zinc-500">
                {isBusy ? "正在生成回复" : "基础聊天示例"}
              </span>
              <div className="flex items-center gap-2">
                {isBusy ? (
                  <button
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                    type="button"
                    onClick={stop}
                  >
                    停止
                  </button>
                ) : null}
                <PromptInputSubmit disabled={!input.trim()} status={status} />
              </div>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </section>
    </main>
  );
}
