"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
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

const DEMO_TASKS = [
  "分析这个项目的结构和代码质量",
  "找出所有 TODO 和 FIXME 注释",
  "读取所有源文件并写一份分析报告",
  "这个项目有什么潜在问题？",
];

export default function AgentPage() {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent" }),
  });
  const isBusy = status === "submitted" || status === "streaming";
  const selectedModelLabel = useMemo(
    () => chatModels.find((model) => model.id === selectedModel)?.name,
    [selectedModel],
  );
  const toolCallCount = useMemo(
    () =>
      messages
        .flatMap((m) => m.parts)
        .filter((p) => isToolUIPart(p) && p.state === "output-available")
        .filter((p) => p.type === "tool-invocation").length,
    [messages],
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

    if (isToolUIPart(part)) {
      return (
        <ToolPart
          key={part.toolCallId}
          part={part}
          isLatestAgentMessage={
            status === "streaming" &&
            messages.length > 0 &&
            part === messages.at(-1)?.parts.at(-1)
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
              <h1 className="text-lg font-semibold">AI Agent</h1>
              <Link
                className="text-sm text-zinc-500 hover:text-zinc-950"
                href="/agent-tools-guide"
              >
                概念指南
              </Link>
              <Link
                className="text-sm text-zinc-500 hover:text-zinc-950"
                href="/chat"
              >
                基础聊天
              </Link>
              <Link
                className="text-sm text-zinc-500 hover:text-zinc-950"
                href="/tools"
              >
                文件 tools
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
              {toolCallCount > 0
                ? ` · 本轮已自动调用 ${toolCallCount} 次工具`
                : ""}
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

        {/* 教学说明条 */}
        <div className="border-b border-zinc-200 bg-amber-50 px-4 py-3 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
              教学重点
            </span>
            <div className="text-sm leading-6 text-amber-800">
              <p>
                <strong>ToolLoopAgent</strong> 在服务端自动执行 &ldquo;思考 →
                调工具 → 看结果 → 再思考&rdquo; 循环，无需前端介入。
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
                  maxSteps
                </code>
                控制最大循环次数。下方是 data/agent-workspace/
                里的示例项目，你可以让 Agent 去分析它。
              </p>
            </div>
          </div>
        </div>

        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="max-w-md text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    ToolLoopAgent 教学示例
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    Agent 会自动探索 workspace、读取文件、搜索代码模式，按需调用工具，
                    最终给出分析结论。整个过程在服务端一步完成。
                  </p>
                  <div className="mt-6 flex flex-col gap-2">
                    <p className="text-xs font-medium text-zinc-600">
                      试试以下任务：
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {DEMO_TASKS.map((task) => (
                        <button
                          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                          key={task}
                          type="button"
                          onClick={() => {
                            clearError();
                            setInput(task);
                          }}
                        >
                          {task}
                        </button>
                      ))}
                    </div>
                  </div>

                  <details className="mt-8 text-left text-sm text-zinc-500">
                    <summary className="cursor-pointer font-medium text-zinc-600">
                      和 /tools 有什么区别？
                    </summary>
                    <div className="mt-2 rounded-md border border-zinc-200 bg-white p-4 leading-6">
                      <ul className="list-inside list-disc space-y-1">
                        <li>
                          <strong>/tools</strong>：后端每次只执行一轮 tool
                          call，前端通过{" "}
                          <code className="rounded bg-zinc-100 px-1 text-xs">
                            sendAutomaticallyWhen
                          </code>{" "}
                          重新发送消息来触发下一轮，往返多次
                        </li>
                        <li>
                          <strong>/agent</strong>：后端用 ToolLoopAgent
                          自动循环，一次请求完成所有 tool 调用后返回最终结果
                        </li>
                        <li>
                          Agent 的 tool 调用在服务端日志可见，前端只看到最终流
                        </li>
                      </ul>
                    </div>
                  </details>
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
              placeholder="例如：分析这个项目的代码质量"
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
                {isBusy
                  ? "Agent 正在服务端自动循环..."
                  : "ToolLoopAgent 教学示例"}
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
  isLatestAgentMessage?: boolean;
};

function ToolPart({ part, isLatestAgentMessage }: ToolPartProps) {
  const toolName = getToolName(part);
  const title = toolLabels[toolName] ?? toolName;

  return (
    <div
      className={`rounded-md border p-3 text-sm text-zinc-800 ${
        part.state === "output-available"
          ? "border-emerald-200 bg-emerald-50"
          : part.state === "output-error"
            ? "border-red-200 bg-red-50"
            : isLatestAgentMessage
              ? "border-sky-200 bg-sky-50"
              : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-zinc-950">{title}</span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {stateLabels[part.state] ?? part.state}
        </span>
      </div>

      {part.type === "tool-invocation" ? (
        <div className="mt-2 rounded-md bg-white/80 p-2 font-mono text-xs leading-5 text-zinc-600">
          {formatToolInput(part)}
        </div>
      ) : null}

      {part.state === "output-available" ? (
        <div className="mt-3 rounded-md bg-white p-2 font-mono text-xs leading-5 text-emerald-800">
          {formatToolOutput(part)}
        </div>
      ) : null}

      {part.state === "output-error" ? (
        <div className="mt-3 rounded-md bg-white p-2 text-xs leading-5 text-red-700">
          {part.errorText}
        </div>
      ) : null}
    </div>
  );
}

const toolLabels: Record<string, string> = {
  listFiles: "📂 列出文件",
  readFile: "📖 读取文件",
  searchFiles: "🔍 搜索文件",
  writeReport: "📝 写入报告",
};

const stateLabels: Record<string, string> = {
  "input-streaming": "Agent 正在思考...",
  "input-available": "Agent 已决策",
  "output-available": "✅ 已完成",
  "output-error": "❌ 失败",
};

function formatToolInput(
  part: ToolUIPart | DynamicToolUIPart,
): string {
  if (part.type !== "tool-invocation") {
    return JSON.stringify(part.input, null, 2);
  }

  const input = part.input;
  if (!input || typeof input !== "object") {
    return String(input ?? "");
  }

  const inputObj = input as Record<string, unknown>;
  if ("path" in inputObj) {
    return `path: ${String(inputObj.path)}`;
  }
  if ("pattern" in inputObj) {
    return `pattern: ${String(inputObj.pattern)}`;
  }
  if ("filename" in inputObj) {
    return `filename: ${String(inputObj.filename)}`;
  }

  return JSON.stringify(input, null, 2);
}

function formatToolOutput(part: ToolUIPart | DynamicToolUIPart) {
  if (part.type !== "tool-invocation") {
    if ("output" in part) {
      return formatValue(part.output);
    }
    return "";
  }

  const output = part.output;
  if (!output || typeof output !== "object") {
    return String(output ?? "");
  }

  const outputObj = output as Record<string, unknown>;

  if ("files" in outputObj && Array.isArray(outputObj.files)) {
    const files = outputObj.files as Array<Record<string, unknown>>;
    return files
      .map(
        (f) =>
          `${String(f.relativePath)} (${String(f.bytes)} bytes)`,
      )
      .join("\n");
  }

  if ("matches" in outputObj && Array.isArray(outputObj.matches)) {
    const matches = outputObj.matches as Array<Record<string, unknown>>;
    return matches
      .map(
        (m) =>
          `${String(m.relativePath)}:\n  ${String(m.snippet).trim()}`,
      )
      .join("\n\n");
  }

  if ("content" in outputObj) {
    const content = String(outputObj.content);
    return content.length > 200
      ? `${content.slice(0, 200)}...`
      : content;
  }

  return formatValue(output);
}

function formatValue(value: unknown) {
  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
