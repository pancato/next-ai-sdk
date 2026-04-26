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

const MCP_CONFIG_STORAGE_KEY = "next-ai-sdk:mcp-config";

type UserMcpServerConfig = {
  enabled: boolean;
  headersText: string;
  id: string;
  name: string;
  transport: "http" | "sse";
  url: string;
};

export default function McpPage() {
  const [configError, setConfigError] = useState("");
  const [includeLocalNotes, setIncludeLocalNotes] = useState(true);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
  const [serverHeadersText, setServerHeadersText] = useState("");
  const [serverName, setServerName] = useState("");
  const [servers, setServers] = useState<UserMcpServerConfig[]>([]);
  const [serverTransport, setServerTransport] =
    useState<UserMcpServerConfig["transport"]>("http");
  const [serverUrl, setServerUrl] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/mcp" }),
  });
  const isBusy = status === "submitted" || status === "streaming";
  const enabledServerCount =
    servers.filter((server) => server.enabled).length +
    (includeLocalNotes ? 1 : 0);
  const selectedModelLabel = useMemo(
    () => chatModels.find((model) => model.id === selectedModel)?.name,
    [selectedModel],
  );

  // 客户端挂载后从 localStorage 读取持久化配置，避免 SSR/CSR 水合不一致
  useEffect(() => {
    const config = getInitialMcpConfig();
    (() => {
      setIncludeLocalNotes(config.includeLocalNotes);
      setServers(config.servers);
    })();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      MCP_CONFIG_STORAGE_KEY,
      JSON.stringify({ includeLocalNotes, servers }),
    );
  }, [includeLocalNotes, servers]);

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
    setConfigError("");

    const mcpServers = buildRequestServers(servers);
    if (mcpServers instanceof Error) {
      setConfigError(mcpServers.message);
      return;
    }

    setInput("");
    await sendMessage(
      { text },
      {
        body: {
          includeLocalNotes,
          mcpServers,
          model: selectedModel,
        },
      },
    );
  }

  function handleAddServer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfigError("");

    try {
      const url = new URL(serverUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("MCP server URL 必须使用 http 或 https。");
      }

      parseHeadersText(serverHeadersText);

      const name = serverName.trim() || url.hostname;
      setServers((currentServers) => [
        ...currentServers,
        {
          enabled: true,
          headersText: serverHeadersText.trim(),
          id: normalizeServerId(name),
          name,
          transport: serverTransport,
          url: url.toString(),
        },
      ]);
      setServerHeadersText("");
      setServerName("");
      setServerTransport("http");
      setServerUrl("");
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "MCP 配置无效。");
    }
  }

  function toggleServer(id: string) {
    setServers((currentServers) =>
      currentServers.map((server) =>
        server.id === id ? { ...server, enabled: !server.enabled } : server,
      ),
    );
  }

  function removeServer(id: string) {
    setServers((currentServers) =>
      currentServers.filter((server) => server.id !== id),
    );
  }

  function renderMessagePart(part: ChatMessagePart, index: number) {
    if (part.type === "text") {
      return <Fragment key={index}>{part.text}</Fragment>;
    }

    if (isToolUIPart(part)) {
      return <ToolPart key={part.toolCallId} part={part} />;
    }

    return null;
  }

  return (
    <main className="flex min-h-svh bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col border-x border-zinc-200 bg-white">
        <header className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-semibold">AI MCP</h1>
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
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              当前模型：{selectedModelLabel}，已启用 {enabledServerCount} 个 MCP
              server
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

        <section className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-950">
                    MCP Server 配置
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Web 示例支持用户添加 HTTP/SSE MCP server；stdio command
                    仅保留为内置本地教学 server。
                  </p>
                </div>
              </div>

              <label className="mt-4 flex items-start gap-3 text-sm text-zinc-700">
                <input
                  checked={includeLocalNotes}
                  className="mt-1 size-4 rounded border-zinc-300"
                  type="checkbox"
                  onChange={(event) =>
                    setIncludeLocalNotes(event.currentTarget.checked)
                  }
                />
                <span>
                  <span className="font-medium text-zinc-950">
                    启用内置 local_notes MCP server
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">
                    使用 stdio 连接 scripts/mcp-notes-server.mjs，真实读写
                    data/mcp-notes。
                  </span>
                </span>
              </label>

              <div className="mt-4 flex flex-col gap-2">
                {servers.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    还没有外部 MCP server。添加后，聊天请求会把启用的 server
                    配置发送给 /api/mcp。
                  </p>
                ) : (
                  servers.map((server) => (
                    <div
                      className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                      key={server.id}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-zinc-500">
                            {server.transport.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-zinc-950">
                            {server.name}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                            {server.enabled ? "启用" : "停用"}
                          </span>
                        </div>
                        <p className="mt-1 break-all text-xs text-zinc-500">
                          {server.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                          type="button"
                          onClick={() => toggleServer(server.id)}
                        >
                          {server.enabled ? "停用" : "启用"}
                        </button>
                        <button
                          className="h-8 rounded-md border border-red-100 bg-white px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          type="button"
                          onClick={() => removeServer(server.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form className="flex flex-col gap-3" onSubmit={handleAddServer}>
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  名称
                  <input
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-950 outline-none transition-colors focus:border-zinc-500"
                    placeholder="github"
                    value={serverName}
                    onChange={(event) =>
                      setServerName(event.currentTarget.value)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Transport
                  <select
                    className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-950 outline-none transition-colors focus:border-zinc-500"
                    value={serverTransport}
                    onChange={(event) =>
                      setServerTransport(
                        event.currentTarget
                          .value as UserMcpServerConfig["transport"],
                      )
                    }
                  >
                    <option value="http">HTTP</option>
                    <option value="sse">SSE</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                URL
                <input
                  className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-950 outline-none transition-colors focus:border-zinc-500"
                  placeholder="https://example.com/mcp"
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.currentTarget.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                Headers JSON
                <textarea
                  className="min-h-20 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs font-normal leading-5 text-zinc-950 outline-none transition-colors focus:border-zinc-500"
                  placeholder='{"Authorization":"Bearer ..."}'
                  value={serverHeadersText}
                  onChange={(event) =>
                    setServerHeadersText(event.currentTarget.value)
                  }
                />
              </label>

              {configError ? (
                <p className="text-xs leading-5 text-red-600">{configError}</p>
              ) : null}

              <button
                className="h-9 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                type="submit"
              >
                添加 MCP Server
              </button>
            </form>
          </div>
        </section>

        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <div className="max-w-md text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    MCP server 工具发现
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    例如：创建一条关于 MCP 的学习笔记、列出 MCP
                    笔记、读取刚才的笔记、搜索包含 tools
                    的笔记。也可以先添加远程 HTTP/SSE MCP server。
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
                  正在连接 MCP server...
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
              aria-label="MCP 聊天输入"
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
                {isBusy ? "正在生成回复" : "用户可配置 MCP server 示例"}
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
};

function ToolPart({ part }: ToolPartProps) {
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
    </div>
  );
}

const toolLabels: Record<string, string> = {
  create_note: "MCP 创建笔记",
  list_notes: "MCP 列出笔记",
  read_note: "MCP 读取笔记",
  search_notes: "MCP 搜索笔记",
};

const stateLabels: Record<string, string> = {
  "input-streaming": "生成参数",
  "input-available": "等待执行",
  "output-available": "已完成",
  "output-error": "失败",
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

function buildRequestServers(servers: UserMcpServerConfig[]) {
  try {
    return servers
      .filter((server) => server.enabled)
      .map((server) => ({
        enabled: server.enabled,
        headers: parseHeadersText(server.headersText),
        id: server.id,
        name: server.name,
        transport: server.transport,
        url: server.url,
      }));
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error("MCP headers JSON 无效。");
  }
}

function parseHeadersText(value: string) {
  const text = value.trim();
  if (!text) {
    return undefined;
  }

  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers JSON 必须是对象。");
  }

  const headers = Object.fromEntries(
    Object.entries(parsed).map(([key, headerValue]) => {
      if (typeof headerValue !== "string") {
        throw new Error("Headers JSON 的 value 必须是字符串。");
      }

      return [key, headerValue];
    }),
  );

  return headers;
}

function normalizeServerId(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  return normalized || `mcp_${Date.now().toString(36)}`;
}

function getInitialMcpConfig(): {
  includeLocalNotes: boolean;
  servers: UserMcpServerConfig[];
} {
  if (typeof window === "undefined") {
    return { includeLocalNotes: true, servers: [] };
  }

  const storedConfig = window.localStorage.getItem(MCP_CONFIG_STORAGE_KEY);
  if (!storedConfig) {
    return { includeLocalNotes: true, servers: [] };
  }

  try {
    const parsed = JSON.parse(storedConfig) as {
      includeLocalNotes?: boolean;
      servers?: UserMcpServerConfig[];
    };

    return {
      includeLocalNotes: parsed.includeLocalNotes ?? true,
      servers: Array.isArray(parsed.servers) ? parsed.servers : [],
    };
  } catch {
    return { includeLocalNotes: true, servers: [] };
  }
}
