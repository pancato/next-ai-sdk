import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import {
  convertToModelMessages,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai";

import { DEFAULT_CHAT_MODEL, getChatModel } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 30;

type ChatRequest = {
  includeLocalNotes?: boolean;
  mcpServers?: UserMcpServerConfig[];
  messages?: UIMessage[];
  model?: string;
};

type UserMcpServerConfig = {
  enabled?: boolean;
  headers?: Record<string, string>;
  id?: string;
  name?: string;
  transport?: "http" | "sse";
  url?: string;
};

export async function POST(req: Request) {
  const mcpClients: Awaited<ReturnType<typeof createMCPClient>>[] = [];

  try {
    const {
      includeLocalNotes = true,
      mcpServers = [],
      messages,
      model = DEFAULT_CHAT_MODEL,
    }: ChatRequest = await req.json();

    if (!Array.isArray(messages)) {
      return Response.json({ error: "Missing messages" }, { status: 400 });
    }

    const mcpTools: ToolSet = {};

    if (includeLocalNotes) {
      const localClient = await createMCPClient({
        name: "next-ai-sdk-mcp-demo-client",
        transport: new Experimental_StdioMCPTransport({
          command: process.execPath,
          args: ["scripts/mcp-notes-server.mjs"],
          cwd: process.cwd(),
          stderr: "pipe",
        }),
      });

      mcpClients.push(localClient);
      Object.assign(
        mcpTools,
        namespaceTools("local_notes", await localClient.tools()),
      );
    }

    for (const server of validateUserMcpServers(mcpServers)) {
      const client = await createMCPClient({
        name: "next-ai-sdk-user-mcp-client",
        transport: {
          type: server.transport,
          url: server.url,
          headers: server.headers,
          redirect: "error",
        },
      });

      mcpClients.push(client);
      Object.assign(
        mcpTools,
        namespaceTools(normalizeToolPrefix(server.id), await client.tools()),
      );
    }

    const connectedServerNames = [
      ...(includeLocalNotes ? ["local_notes"] : []),
      ...validateUserMcpServers(mcpServers).map((server) => server.id),
    ];

    const result = streamText({
      model: getChatModel(model),
      system: [
        "你是一个 AI SDK MCP 教程助手。",
        "你的 tools 不是在 Next API route 里直接定义的，而是由用户配置的 MCP server 或内置本地 MCP server 暴露，再由 createMCPClient().tools() 转换成 AI SDK tools。",
        `当前已连接 MCP server：${connectedServerNames.length > 0 ? connectedServerNames.join(", ") : "无"}`,
        "工具名会加 server 前缀以避免冲突，例如 local_notes__create_note。",
        "优先通过 MCP tools 完成用户请求。回答时说明调用的是 MCP tool、来自哪个 server，并简短总结 server 返回的结果。",
        "如果当前没有可用 MCP server 或没有合适工具，请指导用户先在页面里启用内置 notes server，或添加 HTTP/SSE MCP server。",
      ].join("\n"),
      messages: await convertToModelMessages(messages),
      tools: mcpTools,
      onFinish: async () => {
        await closeMcpClients(mcpClients);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    await closeMcpClients(mcpClients);

    const message =
      error instanceof Error ? error.message : "Failed to stream response";

    return Response.json({ error: message }, { status: 400 });
  }
}

function namespaceTools(prefix: string, tools: ToolSet) {
  return Object.fromEntries(
    Object.entries(tools).map(([toolName, tool]) => [
      `${prefix}__${toolName}`,
      tool,
    ]),
  ) satisfies ToolSet;
}

function validateUserMcpServers(servers: UserMcpServerConfig[]) {
  if (!Array.isArray(servers)) {
    return [];
  }

  return servers
    .filter((server) => server.enabled !== false)
    .slice(0, 5)
    .map((server, index) => {
      const transport: "http" | "sse" =
        server.transport === "sse" ? "sse" : "http";
      const url = validateServerUrl(server.url);
      const id = normalizeToolPrefix(
        server.id || server.name || `server_${index + 1}`,
      );

      return {
        headers: validateHeaders(server.headers),
        id,
        transport,
        url,
      };
    });
}

function validateServerUrl(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("MCP server URL is required.");
  }

  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MCP server URL must use http or https.");
  }

  return url.toString();
}

function validateHeaders(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((item): item is [string, string] => {
        const [key, headerValue] = item;
        return Boolean(key.trim()) && typeof headerValue === "string";
      })
      .slice(0, 20),
  );
}

function normalizeToolPrefix(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  return normalized || "mcp_server";
}

async function closeMcpClients(
  clients: Awaited<ReturnType<typeof createMCPClient>>[],
) {
  await Promise.allSettled(clients.map((client) => client.close()));
}
