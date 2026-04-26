import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

export async function OPTIONS() {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  });
}

export async function GET(req: Request) {
  return handleMcpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}

async function handleMcpRequest(req: Request) {
  const server = createTestMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(req);
    return withCors(response);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to handle MCP request",
      },
      {
        headers: corsHeaders,
        status: 500,
      },
    );
  } finally {
    await server.close();
  }
}

function createTestMcpServer() {
  const server = new McpServer({
    name: "next-ai-sdk-http-test-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "echo",
    {
      description: "Echo a message back from the HTTP MCP test server.",
      inputSchema: {
        message: z.string().describe("Message to echo."),
      },
      title: "Echo",
    },
    async ({ message }) => {
      const result = {
        echoed: message,
        source: "next-ai-sdk-http-test-mcp",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "add_numbers",
    {
      description: "Add two numbers on the HTTP MCP test server.",
      inputSchema: {
        a: z.number().describe("First number."),
        b: z.number().describe("Second number."),
      },
      title: "Add Numbers",
    },
    async ({ a, b }) => {
      const result = {
        a,
        b,
        sum: a + b,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_server_status",
    {
      description:
        "Return basic status information for the HTTP MCP test server.",
      inputSchema: {},
      title: "Get Server Status",
    },
    async () => {
      const result = {
        name: "next-ai-sdk-http-test-mcp",
        status: "ok",
        transport: "streamable-http",
        time: new Date().toISOString(),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  return server;
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}
