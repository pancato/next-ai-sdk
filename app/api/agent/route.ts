import {
  ToolLoopAgent,
  convertToModelMessages,
  jsonSchema,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_CHAT_MODEL, getChatModel } from "@/lib/models";

export const maxDuration = 60;
export const runtime = "nodejs";

const WORKSPACE_ROOT = path.join(process.cwd(), "data", "agent-workspace");

type ChatRequest = {
  messages?: UIMessage[];
  model?: string;
};

type ListedFile = {
  relativePath: string;
  bytes: number;
  updatedAt: string;
};

export async function POST(req: Request) {
  try {
    const { messages, model = DEFAULT_CHAT_MODEL }: ChatRequest =
      await req.json();

    if (!Array.isArray(messages)) {
      return Response.json({ error: "Missing messages" }, { status: 400 });
    }

    const agent = new ToolLoopAgent({
      model: getChatModel(model),
      stopWhen: stepCountIs(15),
      instructions: [
        "你是一个代码分析 Agent，运行在 Vercel AI SDK 的 ToolLoopAgent 之上。",
        "你拥有 4 个工具：listFiles、readFile、searchFiles、writeReport。",
        "writeReport 会真实写入 markdown 报告，因此需要用户 approval 后才能执行。",
        "",
        "## 工作流程",
        "",
        "1. 先调用 listFiles 了解项目文件结构",
        "2. 再用 readFile 深入阅读源文件",
        "3. 必要时用 searchFiles 搜索特定模式",
        "4. 如果用户要求生成报告，用 writeReport 输出结构化分析报告，并等待用户 approval",
        "",
        "每次工具调用后，根据之前的结果自主决定下一步做什么。",
        "普通工具调用会在服务端自动循环完成。",
        "遇到需要 approval 的 writeReport 时，暂停循环并等待用户在前端批准或拒绝。",
        "如果用户拒绝 writeReport，不要重复请求同一个写入操作，改为说明报告未写入。",
        "最终回复用中文，先总结你的分析步骤（调用了哪些工具、看到了什么），再给出结论。",
      ].join("\n"),
      tools: {
        listFiles: tool({
          description:
            "List all files in the agent workspace directory, recursively.",
          inputSchema: jsonSchema<Record<string, never>>({
            type: "object",
            properties: {},
            additionalProperties: false,
          }),
          execute: async () => {
            await ensureRoot();
            const files = await listFilesRecursively(WORKSPACE_ROOT, "");

            return {
              action: "files-listed",
              root: WORKSPACE_ROOT,
              files,
            };
          },
        }),

        readFile: tool({
          description:
            "Read the full content of a file from the agent workspace.",
          inputSchema: jsonSchema<{
            path: string;
          }>({
            type: "object",
            properties: {
              path: {
                type: "string",
                description:
                  "Relative path from workspace root, e.g. src/index.ts",
              },
            },
            required: ["path"],
            additionalProperties: false,
          }),
          execute: async ({ path: filePath }) => {
            const safePath = sanitizePath(filePath);
            const fullPath = resolvePath(safePath);
            const content = await readFile(fullPath, "utf8");

            return {
              action: "file-read",
              relativePath: safePath,
              content,
            };
          },
        }),

        searchFiles: tool({
          description:
            "Search for a text pattern across all workspace files. Returns matching file paths and snippets.",
          inputSchema: jsonSchema<{
            pattern: string;
          }>({
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "Case-insensitive text pattern to search for.",
              },
            },
            required: ["pattern"],
            additionalProperties: false,
          }),
          execute: async ({ pattern }) => {
            await ensureRoot();
            const query = pattern.toLowerCase();
            const files = await listFilesRecursively(WORKSPACE_ROOT, "");
            const matches: Array<{
              relativePath: string;
              snippet: string;
            }> = [];

            for (const file of files) {
              const fullPath = resolvePath(file.relativePath);
              const content = await readFile(fullPath, "utf8");
              const lowerContent = content.toLowerCase();
              const index = lowerContent.indexOf(query);

              if (index !== -1) {
                const start = Math.max(0, index - 40);
                const end = Math.min(content.length, index + query.length + 40);
                matches.push({
                  relativePath: file.relativePath,
                  snippet: content.slice(start, end),
                });
              }
            }

            return {
              action: "files-searched",
              pattern,
              matches,
            };
          },
        }),

        writeReport: tool({
          description:
            "Write a structured analysis report as a markdown file in the workspace reports/ directory. This mutates project files and requires user approval before execution.",
          inputSchema: jsonSchema<{
            filename: string;
            content: string;
          }>({
            type: "object",
            properties: {
              filename: {
                type: "string",
                description: "Report filename, must end with .md",
              },
              content: {
                type: "string",
                description: "Markdown content of the report.",
              },
            },
            required: ["filename", "content"],
            additionalProperties: false,
          }),
          needsApproval: true,
          execute: async ({ filename, content }) => {
            if (!filename.endsWith(".md")) {
              throw new Error("Report filename must end with .md");
            }

            const safeFilename = path
              .normalize(filename)
              .replace(/^\.\.(\/|\\)/g, "")
              .replace(/\//g, "_");

            const reportsDir = path.join(WORKSPACE_ROOT, "reports");
            await mkdir(reportsDir, { recursive: true });
            const fullPath = path.join(reportsDir, safeFilename);
            const relativeToRoot = path.relative(WORKSPACE_ROOT, fullPath);

            if (relativeToRoot.startsWith("..")) {
              throw new Error("Report path must stay inside workspace.");
            }

            await writeFile(fullPath, content, "utf8");

            return {
              action: "report-written",
              relativePath: `reports/${safeFilename}`,
              absolutePath: fullPath,
              bytes: Buffer.byteLength(content),
            };
          },
        }),
      },
    });

    const result = await agent.stream({
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent request failed";

    return Response.json({ error: message }, { status: 400 });
  }
}

function sanitizePath(relativePath: string) {
  const normalized = path.normalize(relativePath).replaceAll("\\", "/");

  if (
    !normalized ||
    path.isAbsolute(normalized) ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error("Path must stay inside workspace.");
  }

  return normalized;
}

function resolvePath(relativePath: string) {
  const safe = sanitizePath(relativePath);
  const fullPath = path.join(WORKSPACE_ROOT, safe);
  const relativeToRoot = path.relative(WORKSPACE_ROOT, fullPath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Path must stay inside workspace.");
  }

  return fullPath;
}

async function ensureRoot() {
  await mkdir(WORKSPACE_ROOT, { recursive: true });
}

async function listFilesRecursively(
  directory: string,
  prefix: string,
): Promise<ListedFile[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        if (entry.name === "reports") {
          return [];
        }

        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          return listFilesRecursively(fullPath, relativePath);
        }

        if (entry.isFile()) {
          const fileStat = await stat(fullPath);
          return [
            {
              relativePath,
              bytes: fileStat.size,
              updatedAt: fileStat.mtime.toISOString(),
            },
          ];
        }

        return [];
      }),
    );

    return files.flat();
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
