import {
  convertToModelMessages,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_CHAT_MODEL, getChatModel } from "@/lib/models";

export const maxDuration = 30;

const FILE_ROOT = path.join(process.cwd(), "data", "tool-files");

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

    const result = streamText({
      model: getChatModel(model),
      system: [
        "你是一个 AI SDK 文件工具教程助手。",
        "你可以通过 tools 真实读写项目里的教学文件目录 data/tool-files。",
        "添加今日待办、写文件、读文件、列文件可以直接执行。",
        "删除今日待办项或删除文件必须使用需要 approval 的工具。",
        "工具完成后，用中文简短总结工具输入、是否经过 approval、实际文件路径和工具输出。",
      ].join("\n"),
      messages: await convertToModelMessages(messages),
      tools: {
        addTodayTodo: tool({
          description:
            "Append a task to today's real todo file under data/tool-files/todos.",
          inputSchema: jsonSchema<{
            task: string;
            note?: string;
          }>({
            type: "object",
            properties: {
              task: {
                type: "string",
                description: "The todo task text to append.",
              },
              note: {
                type: "string",
                description: "Optional detail written below the task.",
              },
            },
            required: ["task"],
            additionalProperties: false,
          }),
          execute: async ({ task, note }) => {
            const relativePath = todayTodoRelativePath();
            const fullPath = resolveFilePath(relativePath);
            await ensureRoot();

            const line = `- [ ] ${task.trim()}`;
            const content = note?.trim()
              ? `${line}\n  - ${note.trim()}\n`
              : `${line}\n`;
            await appendFileContent(fullPath, content);

            const savedContent = await readFile(fullPath, "utf8");
            return {
              action: "todo-appended",
              relativePath,
              absolutePath: fullPath,
              content: savedContent,
            };
          },
        }),
        readTodayTodos: tool({
          description:
            "Read today's real todo file from data/tool-files/todos.",
          inputSchema: jsonSchema<Record<string, never>>({
            type: "object",
            properties: {},
            additionalProperties: false,
          }),
          execute: async () => {
            const relativePath = todayTodoRelativePath();
            const fullPath = resolveFilePath(relativePath);
            const content = await readExistingFile(fullPath);

            return {
              action: "todo-read",
              relativePath,
              absolutePath: fullPath,
              content,
            };
          },
        }),
        deleteTodayTodo: tool({
          description:
            "Delete one task block from today's todo file. This destructive tool requires user approval before execution.",
          inputSchema: jsonSchema<{
            itemNumber: number;
            reason?: string;
          }>({
            type: "object",
            properties: {
              itemNumber: {
                type: "number",
                description:
                  "The 1-based todo item number to delete from today's todo file.",
              },
              reason: {
                type: "string",
                description: "Why this todo item should be deleted.",
              },
            },
            required: ["itemNumber"],
            additionalProperties: false,
          }),
          needsApproval: true,
          execute: async ({ itemNumber, reason }) => {
            const relativePath = todayTodoRelativePath();
            const fullPath = resolveFilePath(relativePath);
            const content = await readExistingFile(fullPath);
            const lines = content.split("\n");
            const todoIndexes = lines
              .map((line, index) => ({ index, line }))
              .filter(({ line }) => /^- \[[ xX]\] /.test(line));
            const target = todoIndexes[itemNumber - 1];

            if (!target) {
              throw new Error(`Todo item ${itemNumber} does not exist.`);
            }

            const deleteIndexes = new Set([target.index]);
            for (let index = target.index + 1; index < lines.length; index++) {
              const line = lines[index];

              if (/^- \[[ xX]\] /.test(line)) {
                break;
              }

              if (line.trim() === "" || /^\s+/.test(line)) {
                deleteIndexes.add(index);
                continue;
              }

              break;
            }

            const deletedBlock = lines.filter((_, index) =>
              deleteIndexes.has(index),
            );
            const nextLines = lines.filter(
              (_, index) => !deleteIndexes.has(index),
            );
            await writeFile(fullPath, nextLines.join("\n"), "utf8");

            return {
              action: "todo-deleted",
              relativePath,
              absolutePath: fullPath,
              deletedItem: deletedBlock.join("\n"),
              reason: reason ?? "",
              content: nextLines.join("\n"),
            };
          },
        }),
        writeTextFile: tool({
          description:
            "Write or append a real text file inside data/tool-files. Use relative paths such as notes/idea.md.",
          inputSchema: jsonSchema<{
            relativePath: string;
            content: string;
            mode?: "append" | "overwrite";
          }>({
            type: "object",
            properties: {
              relativePath: {
                type: "string",
                description:
                  "Path relative to data/tool-files, for example notes/idea.md.",
              },
              content: {
                type: "string",
                description: "Text content to write.",
              },
              mode: {
                type: "string",
                enum: ["append", "overwrite"],
                description: "Append to the file or overwrite it.",
              },
            },
            required: ["relativePath", "content"],
            additionalProperties: false,
          }),
          execute: async ({ relativePath, content, mode = "overwrite" }) => {
            const safeRelativePath = sanitizeRelativePath(relativePath);
            const fullPath = resolveFilePath(safeRelativePath);
            await mkdir(path.dirname(fullPath), { recursive: true });

            if (mode === "append") {
              await appendFileContent(fullPath, content);
            } else {
              await writeFile(fullPath, content, "utf8");
            }

            return {
              action: mode === "append" ? "file-appended" : "file-written",
              relativePath: safeRelativePath,
              absolutePath: fullPath,
              bytes: Buffer.byteLength(content),
            };
          },
        }),
        readTextFile: tool({
          description:
            "Read a real text file inside data/tool-files by relative path.",
          inputSchema: jsonSchema<{
            relativePath: string;
          }>({
            type: "object",
            properties: {
              relativePath: {
                type: "string",
                description:
                  "Path relative to data/tool-files, for example notes/idea.md.",
              },
            },
            required: ["relativePath"],
            additionalProperties: false,
          }),
          execute: async ({ relativePath }) => {
            const safeRelativePath = sanitizeRelativePath(relativePath);
            const fullPath = resolveFilePath(safeRelativePath);
            const content = await readExistingFile(fullPath);

            return {
              action: "file-read",
              relativePath: safeRelativePath,
              absolutePath: fullPath,
              content,
            };
          },
        }),
        listFiles: tool({
          description:
            "List files that currently exist inside data/tool-files.",
          inputSchema: jsonSchema<{
            directory?: string;
          }>({
            type: "object",
            properties: {
              directory: {
                type: "string",
                description:
                  "Optional directory relative to data/tool-files. Leave empty for root.",
              },
            },
            additionalProperties: false,
          }),
          execute: async ({ directory = "" }) => {
            const safeDirectory = directory
              ? sanitizeRelativePath(directory)
              : "";
            const fullPath = safeDirectory
              ? resolveFilePath(safeDirectory)
              : FILE_ROOT;
            const files = await listFilesRecursively(fullPath, safeDirectory);

            return {
              action: "files-listed",
              root: FILE_ROOT,
              directory: safeDirectory,
              files,
            };
          },
        }),
        deleteFile: tool({
          description:
            "Delete a real file inside data/tool-files. This destructive tool requires user approval before execution.",
          inputSchema: jsonSchema<{
            relativePath: string;
            reason?: string;
          }>({
            type: "object",
            properties: {
              relativePath: {
                type: "string",
                description:
                  "Path relative to data/tool-files, for example notes/idea.md.",
              },
              reason: {
                type: "string",
                description: "Why this file should be deleted.",
              },
            },
            required: ["relativePath"],
            additionalProperties: false,
          }),
          needsApproval: true,
          execute: async ({ relativePath, reason }) => {
            const safeRelativePath = sanitizeRelativePath(relativePath);
            const fullPath = resolveFilePath(safeRelativePath);
            const fileStat = await stat(fullPath);

            if (!fileStat.isFile()) {
              throw new Error(`${safeRelativePath} is not a file.`);
            }

            await rm(fullPath);

            return {
              action: "file-deleted",
              relativePath: safeRelativePath,
              absolutePath: fullPath,
              reason: reason ?? "",
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

function todayTodoRelativePath() {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `todos/${date}.md`;
}

function sanitizeRelativePath(relativePath: string) {
  const normalized = path.normalize(relativePath).replaceAll("\\", "/");

  if (
    !normalized ||
    path.isAbsolute(normalized) ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error("Path must stay inside data/tool-files.");
  }

  return normalized;
}

function resolveFilePath(relativePath: string) {
  const safeRelativePath = sanitizeRelativePath(relativePath);
  const fullPath = path.join(FILE_ROOT, safeRelativePath);
  const relativeToRoot = path.relative(FILE_ROOT, fullPath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Path must stay inside data/tool-files.");
  }

  return fullPath;
}

async function ensureRoot() {
  await mkdir(FILE_ROOT, { recursive: true });
}

async function appendFileContent(fullPath: string, content: string) {
  await mkdir(path.dirname(fullPath), { recursive: true });

  let prefix = "";
  try {
    const existing = await readFile(fullPath, "utf8");
    prefix = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(fullPath, `${prefix}${content}`, {
    encoding: "utf8",
    flag: "a",
  });
}

async function readExistingFile(fullPath: string) {
  try {
    return await readFile(fullPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error("File does not exist yet.");
    }

    throw error;
  }
}

async function listFilesRecursively(
  directory: string,
  prefix = "",
): Promise<ListedFile[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const relativePath = prefix
          ? `${prefix}/${entry.name}`
          : entry.name;
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
