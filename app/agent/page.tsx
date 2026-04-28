"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
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
  "读取所有源文件并写一份分析报告，等我批准后再保存",
  "这个项目有什么潜在问题？",
];

export default function AgentPage() {
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
    transport: new DefaultChatTransport({ api: "/api/agent" }),
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
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
                调工具 → 看结果 → 再思考&rdquo; 循环。普通工具无需前端介入，
                但
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
                  needsApproval
                </code>
                工具会暂停循环，等待用户批准后再执行。
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
                  stopWhen
                </code>
                控制最大循环次数。每张工具卡都会展示 toolCallId、状态流、
                input、output、approval 和原始 UI part，方便看清楚工具调用全过程。
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
                    最终给出分析结论。工具调用会展开显示完整输入、输出、状态和
                    approval 信息；保存报告的 writeReport 工具需要先经过你的 approval。
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
                          自动循环；遇到需要 approval 的工具会暂停，批准后继续同一个任务
                        </li>
                        <li>
                          这个页面把 approval 状态也展示出来，方便观察 agent loop
                          如何被人工确认打断再恢复
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
  onApprove: (approvalId: string, reason: string) => void;
  onDeny: (approvalId: string, reason: string) => void;
};

function ToolPart({
  part,
  isLatestAgentMessage,
  onApprove,
  onDeny,
}: ToolPartProps) {
  const toolName = getToolName(part);
  const title = toolLabels[toolName] ?? toolName;
  const approval = part.approval;
  const providerMetadataSections = getProviderMetadataSections(part);
  const rawInput = "rawInput" in part ? part.rawInput : undefined;
  const toneClassName = getToolPartToneClassName(
    part.state,
    isLatestAgentMessage,
  );
  const outputSummary =
    part.state === "output-available"
      ? summarizeToolOutput(toolName, part.output)
      : getNoOutputText(part.state);

  return (
    <div
      className={`rounded-md border p-3 text-sm text-zinc-800 ${toneClassName}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-zinc-950">{title}</span>
              <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs text-zinc-600">
                {toolName}
              </code>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              {toolDescriptions[toolName] ??
                "模型正在调用一个工具。下面会展示这次调用的输入、状态和返回数据。"}
            </p>
          </div>
          <span className="w-fit rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {stateLabels[part.state] ?? part.state}
          </span>
        </div>

        <ToolStateTimeline part={part} />

        <div className="grid gap-2 sm:grid-cols-2">
          <ToolFact label="工具名" mono value={toolName} />
          <ToolFact label="UI part 类型" mono value={part.type} />
          <ToolFact label="toolCallId" mono value={part.toolCallId} />
          <ToolFact label="当前状态" value={part.state} mono />
          <ToolFact
            label="状态含义"
            value={stateDescriptions[part.state] ?? "等待更多流式事件。"}
          />
          <ToolFact
            label="执行位置"
            value={
              part.providerExecuted
                ? "Provider 执行"
                : "应用服务端 execute 执行"
            }
          />
          {part.title ? <ToolFact label="标题" value={part.title} /> : null}
          {"preliminary" in part && part.preliminary !== undefined ? (
            <ToolFact
              label="preliminary"
              value={part.preliminary ? "是，可能还会更新" : "否"}
            />
          ) : null}
          {approval ? (
            <ToolFact label="approvalId" mono value={approval.id} />
          ) : null}
          {approval?.approved !== undefined ? (
            <ToolFact
              label="approval 决策"
              value={approval.approved ? "已批准" : "已拒绝"}
            />
          ) : null}
          {approval?.reason ? (
            <ToolFact label="approval 原因" value={approval.reason} />
          ) : null}
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <ToolInsight
            title="调用意图"
            text={summarizeToolIntent(toolName, part.input)}
          />
          <ToolInsight title="输出摘要" text={outputSummary} />
        </div>
      </div>

      <ToolSection
        badge={getValueSizeLabel(part.input)}
        title="输入参数 input"
      >
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white/80 p-3 font-mono text-xs leading-5 text-zinc-700">
          {formatJson(part.input)}
        </pre>
      </ToolSection>

      {rawInput !== undefined ? (
        <ToolSection
          badge={getValueSizeLabel(rawInput)}
          title="原始输入 rawInput"
        >
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white/80 p-3 font-mono text-xs leading-5 text-zinc-700">
            {formatJson(rawInput)}
          </pre>
        </ToolSection>
      ) : null}

      {part.state === "approval-requested" ? (
        <ToolSection badge="需要用户决策" title="approval 请求">
          <div className="rounded-md border border-amber-200 bg-white p-3">
            <p className="text-xs leading-5 text-amber-900">
              {toolName} 请求执行一个带副作用的服务端工具。批准后，前端会把
              approval response 追加到消息里并自动续发，ToolLoopAgent 再继续执行。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <ToolFact label="approvalId" mono value={part.approval.id} />
              <ToolFact label="默认动作" value="等待用户批准或拒绝" />
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                type="button"
                onClick={() =>
                  onApprove(part.approval.id, "用户批准 Agent 写入分析报告")
                }
              >
                批准写入报告
              </button>
              <button
                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                type="button"
                onClick={() =>
                  onDeny(part.approval.id, "用户拒绝 Agent 写入分析报告")
                }
              >
                拒绝
              </button>
            </div>
          </div>
        </ToolSection>
      ) : null}

      {part.state === "approval-responded" ? (
        <ToolSection
          badge={part.approval.approved ? "approved=true" : "approved=false"}
          title="approval 响应"
        >
          <div className="rounded-md bg-white/80 p-3 text-xs leading-5 text-zinc-700">
            <p>
              {part.approval.approved
                ? "用户已批准。前端会自动续发消息，服务端继续执行 Agent loop。"
                : "用户已拒绝。Agent 会收到拒绝原因并停止写入。"}
            </p>
            {part.approval.reason ? (
              <p className="mt-2">原因：{part.approval.reason}</p>
            ) : null}
          </div>
        </ToolSection>
      ) : null}

      {part.state === "output-available" ? (
        <ToolSection
          badge={getValueSizeLabel(part.output)}
          title="工具输出 output"
        >
          <div className="mb-2 rounded-md bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
            {summarizeToolOutput(toolName, part.output)}
          </div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-3 font-mono text-xs leading-5 text-emerald-900">
            {formatJson(part.output)}
          </pre>
        </ToolSection>
      ) : null}

      {part.state === "output-error" ? (
        <ToolSection badge="error" title="工具错误">
          <div className="rounded-md bg-white p-3 text-xs leading-5 text-red-700">
            {part.errorText}
          </div>
        </ToolSection>
      ) : null}

      {part.state === "output-denied" ? (
        <ToolSection badge="denied" title="工具未执行">
          <div className="rounded-md bg-white/80 p-3 text-xs leading-5 text-zinc-700">
            工具执行已被用户拒绝，因此没有 output。拒绝原因会进入下一次模型调用上下文。
          </div>
        </ToolSection>
      ) : null}

      {providerMetadataSections.length > 0 ? (
        <ToolSection badge={`${providerMetadataSections.length} 项`} title="provider metadata">
          <div className="space-y-2">
            {providerMetadataSections.map((section) => (
              <div key={section.label}>
                <p className="mb-1 text-xs font-medium text-zinc-700">
                  {section.label}
                </p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white/80 p-3 font-mono text-xs leading-5 text-zinc-700">
                  {formatJson(section.value)}
                </pre>
              </div>
            ))}
          </div>
        </ToolSection>
      ) : null}

      <ToolSection
        badge="raw"
        defaultOpen={false}
        title="完整 UI tool part 原始结构"
      >
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100">
          {formatJson(part)}
        </pre>
      </ToolSection>
    </div>
  );
}

const toolLabels: Record<string, string> = {
  listFiles: "📂 列出文件",
  readFile: "📖 读取文件",
  searchFiles: "🔍 搜索文件",
  writeReport: "📝 写入报告",
};

const toolDescriptions: Record<string, string> = {
  listFiles: "递归列出 data/agent-workspace 中的教学项目文件，帮助 Agent 建立项目地图。",
  readFile: "读取 workspace 内指定文件的完整文本内容，供 Agent 做代码分析。",
  searchFiles: "在 workspace 文件中搜索关键词，返回命中文件路径和上下文片段。",
  writeReport:
    "把分析报告写入 data/agent-workspace/reports/。这是有副作用的文件写入工具，所以需要 approval。",
};

const stateLabels: Record<string, string> = {
  "input-streaming": "Agent 正在思考...",
  "input-available": "Agent 已决策",
  "approval-requested": "等待 approval",
  "approval-responded": "approval 已确认",
  "output-available": "✅ 已完成",
  "output-error": "❌ 失败",
  "output-denied": "已拒绝",
};

const stateDescriptions: Record<string, string> = {
  "input-streaming": "模型还在流式生成工具参数，input 可能是不完整的。",
  "input-available": "工具参数已经生成完毕，接下来会执行工具或请求 approval。",
  "approval-requested": "工具需要用户批准。此时 ToolLoopAgent 暂停，不会执行 execute。",
  "approval-responded": "前端已记录用户批准或拒绝，下一次请求会带着这个决定继续。",
  "output-available": "工具已经执行完毕，output 是服务端 execute 返回的真实结果。",
  "output-error": "工具执行失败，errorText 是前端能看到的错误文本。",
  "output-denied": "用户拒绝执行，工具没有运行，也不会产生 output。",
};

function getToolPartToneClassName(
  state: string,
  isLatestAgentMessage?: boolean,
) {
  if (state === "output-available") {
    return "border-emerald-200 bg-emerald-50";
  }

  if (state === "output-error") {
    return "border-red-200 bg-red-50";
  }

  if (state === "approval-requested") {
    return "border-amber-200 bg-amber-50";
  }

  if (state === "approval-responded") {
    return "border-sky-200 bg-sky-50";
  }

  if (isLatestAgentMessage) {
    return "border-sky-200 bg-sky-50";
  }

  return "border-zinc-200 bg-white";
}

function ToolStateTimeline({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const states = getTimelineStates(part);
  const currentIndex = states.indexOf(part.state);

  return (
    <div className="flex flex-wrap gap-1.5">
      {states.map((state, index) => {
        const isCurrent = state === part.state;
        const isPast = currentIndex !== -1 && index < currentIndex;

        return (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              isCurrent
                ? "bg-zinc-950 text-white"
                : isPast
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-white/80 text-zinc-500"
            }`}
            key={state}
          >
            {stateLabels[state] ?? state}
          </span>
        );
      })}
    </div>
  );
}

function ToolFact({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md bg-white/80 p-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 break-words text-xs leading-5 text-zinc-800 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "无"}
      </div>
    </div>
  );
}

function ToolInsight({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white/80 p-3">
      <div className="text-xs font-semibold text-zinc-950">{title}</div>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{text}</p>
    </div>
  );
}

function ToolSection({
  badge,
  children,
  defaultOpen = true,
  title,
}: {
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  return (
    <details
      className="mt-3 rounded-md border border-zinc-200 bg-white/60"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-zinc-900">
        <span>{title}</span>
        {badge ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-normal text-zinc-500">
            {badge}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-zinc-200 p-3">{children}</div>
    </details>
  );
}

function getTimelineStates(part: ToolUIPart | DynamicToolUIPart) {
  const hasApproval = part.approval != null;

  if (part.state === "output-error") {
    return hasApproval
      ? [
          "input-streaming",
          "input-available",
          "approval-requested",
          "approval-responded",
          "output-error",
        ]
      : ["input-streaming", "input-available", "output-error"];
  }

  if (part.state === "output-denied") {
    return [
      "input-streaming",
      "input-available",
      "approval-requested",
      "output-denied",
    ];
  }

  if (hasApproval) {
    return [
      "input-streaming",
      "input-available",
      "approval-requested",
      "approval-responded",
      "output-available",
    ];
  }

  return ["input-streaming", "input-available", "output-available"];
}

function summarizeToolIntent(toolName: string, input: unknown) {
  const inputObj = asRecord(input);

  if (toolName === "listFiles") {
    return "列出示例 workspace 的文件结构，帮助 Agent 决定后续该读取哪些文件。";
  }

  if (toolName === "readFile") {
    return `读取文件 ${formatInlineValue(inputObj?.path)} 的完整内容。`;
  }

  if (toolName === "searchFiles") {
    return `搜索关键词 ${formatInlineValue(inputObj?.pattern)}，返回命中文件和上下文片段。`;
  }

  if (toolName === "writeReport") {
    const content = typeof inputObj?.content === "string" ? inputObj.content : "";
    return `准备把 ${content.length} 个字符的 Markdown 报告写入 reports/${formatInlineValue(
      inputObj?.filename,
    )}。因为会改写文件，所以需要 approval。`;
  }

  return "模型决定调用这个工具。完整参数见 input 区块。";
}

function summarizeToolOutput(toolName: string, output: unknown) {
  const outputObj = asRecord(output);

  if (!outputObj) {
    return `工具返回：${formatValue(output)}`;
  }

  if (toolName === "listFiles" && Array.isArray(outputObj.files)) {
    const files = outputObj.files as Array<Record<string, unknown>>;
    const fileNames = files
      .slice(0, 8)
      .map((file) => String(file.relativePath))
      .join("、");
    const suffix = files.length > 8 ? ` 等 ${files.length} 个文件` : "";
    return `列出了 ${files.length} 个文件。根目录：${formatInlineValue(
      outputObj.root,
    )}。文件：${fileNames}${suffix}`;
  }

  if (toolName === "readFile" && typeof outputObj.content === "string") {
    return `读取了 ${formatInlineValue(outputObj.relativePath)}，内容长度 ${
      outputObj.content.length
    } 个字符。`;
  }

  if (toolName === "searchFiles" && Array.isArray(outputObj.matches)) {
    const matches = outputObj.matches as Array<Record<string, unknown>>;
    const paths = matches
      .slice(0, 6)
      .map((match) => String(match.relativePath))
      .join("、");
    return `搜索 ${formatInlineValue(outputObj.pattern)}，命中 ${
      matches.length
    } 处。命中文件：${paths || "无"}`;
  }

  if (toolName === "writeReport") {
    return `报告已写入 ${formatInlineValue(
      outputObj.relativePath,
    )}，字节数 ${formatInlineValue(outputObj.bytes)}。绝对路径：${formatInlineValue(
      outputObj.absolutePath,
    )}`;
  }

  if (typeof outputObj.action === "string") {
    return `工具完成，action=${outputObj.action}。完整返回见 output JSON。`;
  }

  return "工具已返回结构化结果，完整内容见 output JSON。";
}

function getNoOutputText(state: string) {
  if (state === "input-streaming") {
    return "暂时没有 output。模型还在生成工具参数。";
  }

  if (state === "input-available") {
    return "暂时没有 output。参数已生成，等待执行工具或请求 approval。";
  }

  if (state === "approval-requested") {
    return "暂时没有 output。工具需要用户 approval，批准前不会执行 execute。";
  }

  if (state === "approval-responded") {
    return "暂时没有 output。前端已写入 approval response，等待自动续发后继续。";
  }

  if (state === "output-denied") {
    return "没有 output。用户拒绝了这次工具执行。";
  }

  if (state === "output-error") {
    return "没有 output。工具执行失败，错误信息见工具错误区块。";
  }

  return "暂时没有 output。";
}

function getProviderMetadataSections(part: ToolUIPart | DynamicToolUIPart) {
  const sections: Array<{ label: string; value: unknown }> = [];

  if (part.callProviderMetadata) {
    sections.push({
      label: "callProviderMetadata",
      value: part.callProviderMetadata,
    });
  }

  if ("resultProviderMetadata" in part && part.resultProviderMetadata) {
    sections.push({
      label: "resultProviderMetadata",
      value: part.resultProviderMetadata,
    });
  }

  return sections;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getValueSizeLabel(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return `${value.length} chars`;
  }

  if (Array.isArray(value)) {
    return `${value.length} items`;
  }

  if (typeof value === "object") {
    return `${Object.keys(value).length} keys`;
  }

  return typeof value;
}

function formatInlineValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "未提供";
  }

  return String(value);
}

function formatJson(value: unknown) {
  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function formatValue(value: unknown) {
  if (value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
