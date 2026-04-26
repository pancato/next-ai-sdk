"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
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

export default function ToolsPage() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    addToolApprovalResponse,
  } = useChat({
    transport: new DefaultChatTransport({ api: "/api/tools" }),
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
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

  function continueOptions() {
    return { body: { model: selectedModel } };
  }

  function renderMessagePart(part: ChatMessagePart, index: number) {
    if (part.type === "text") {
      return <Fragment key={index}>{part.text}</Fragment>;
    }

    if (isToolUIPart(part)) {
      return (
        <ToolPart
          key={part.toolCallId}
          part={part}
          onApprove={(id, reason) =>
            addToolApprovalResponse({
              id,
              approved: true,
              reason,
              options: continueOptions(),
            })
          }
          onDeny={(id, reason) =>
            addToolApprovalResponse({
              id,
              approved: false,
              reason,
              options: continueOptions(),
            })
          }
        />
      );
    }

    return null;
  }

  return (
    <main className="flex min-h-svh bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col border-x border-zinc-200 bg-white">
        <header className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">AI Tools</h1>
              <Link
                className="text-sm text-zinc-500 hover:text-zinc-950"
                href="/chat"
              >
                基础聊天
              </Link>
              <Link
                className="text-sm text-zinc-500 hover:text-zinc-950"
                href="/mcp"
              >
                MCP 示例
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
                    Tools 和 approval
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    例如：写入今日待办、读取今日待办、把想法保存到 notes/idea.md、列出文件、删除第 1 条待办、删除 notes/idea.md。
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
                {isBusy ? "正在生成回复" : "Tools 与 approval 示例已启用"}
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

type ToolPartProps = {
  part: ToolUIPart | DynamicToolUIPart;
  onApprove: (approvalId: string, reason: string) => void;
  onDeny: (approvalId: string, reason: string) => void;
};

function ToolPart({
  part,
  onApprove,
  onDeny,
}: ToolPartProps) {
  const toolName = getToolName(part);
  const title = toolLabels[toolName] ?? toolName;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-zinc-950">{title}</span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {stateLabels[part.state] ?? part.state}
        </span>
      </div>

      <div className="mt-2 rounded-md bg-zinc-50 p-2 font-mono text-xs leading-5 text-zinc-600">
        {formatValue(part.input)}
      </div>

      {part.state === "approval-requested" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            type="button"
            onClick={() => onApprove(part.approval.id, "用户在前端批准执行")}
          >
            批准执行
          </button>
          <button
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
            type="button"
            onClick={() => onDeny(part.approval.id, "用户在前端拒绝执行")}
          >
            拒绝
          </button>
        </div>
      ) : null}

      {part.state === "approval-responded" ? (
        <p className="mt-3 text-xs text-zinc-500">
          {part.approval.approved ? "已批准，等待服务端执行。" : "已拒绝执行。"}
        </p>
      ) : null}

      {part.state === "output-available" ? (
        <div className="mt-3 rounded-md bg-emerald-50 p-2 font-mono text-xs leading-5 text-emerald-800">
          {formatValue(part.output)}
        </div>
      ) : null}

      {part.state === "output-error" ? (
        <div className="mt-3 rounded-md bg-red-50 p-2 text-xs leading-5 text-red-700">
          {part.errorText}
        </div>
      ) : null}

      {part.state === "output-denied" ? (
        <p className="mt-3 text-xs text-zinc-500">工具执行已被拒绝。</p>
      ) : null}
    </div>
  );
}

const toolLabels: Record<string, string> = {
  addTodayTodo: "写入今日待办",
  readTodayTodos: "读取今日待办",
  deleteTodayTodo: "删除今日待办",
  writeTextFile: "写入文件",
  readTextFile: "读取文件",
  listFiles: "列出文件",
  deleteFile: "删除文件",
};

const stateLabels: Record<string, string> = {
  "input-streaming": "生成参数",
  "input-available": "等待前端确认",
  "approval-requested": "等待 approval",
  "approval-responded": "approval 已确认",
  "output-available": "已完成",
  "output-error": "失败",
  "output-denied": "已拒绝",
};

function formatValue(value: unknown) {
  if (value === undefined) {
    return "等待参数...";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
