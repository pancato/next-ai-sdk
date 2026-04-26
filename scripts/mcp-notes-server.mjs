#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "data", "mcp-notes");

const tools = [
  {
    name: "create_note",
    title: "Create Note",
    description:
      "Create a markdown note in the MCP notes directory. Use this when the user wants to save a thought, note, or learning record.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The note title.",
        },
        content: {
          type: "string",
          description: "The markdown note content.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags to write into the note frontmatter.",
        },
      },
      required: ["title", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "list_notes",
    title: "List Notes",
    description: "List markdown notes currently stored by the MCP server.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "read_note",
    title: "Read Note",
    description: "Read one markdown note from the MCP notes directory.",
    inputSchema: {
      type: "object",
      properties: {
        relativePath: {
          type: "string",
          description: "The note path returned by list_notes.",
        },
      },
      required: ["relativePath"],
      additionalProperties: false,
    },
  },
  {
    name: "search_notes",
    title: "Search Notes",
    description:
      "Search markdown notes by a plain text query and return matching snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The text to search for.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;

  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      break;
    }

    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);

    if (line) {
      void handleLine(line);
    }
  }
});

async function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    sendError(null, -32700, "Parse error");
    return;
  }

  if (!("id" in message)) {
    return;
  }

  try {
    switch (message.method) {
      case "initialize":
        sendResult(message.id, {
          protocolVersion: message.params?.protocolVersion ?? "2025-11-25",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "next-ai-sdk-local-notes",
            version: "0.1.0",
          },
        });
        return;

      case "tools/list":
        sendResult(message.id, { tools });
        return;

      case "tools/call":
        sendResult(message.id, await callTool(message.params));
        return;

      default:
        sendError(message.id, -32601, `Unknown method: ${message.method}`);
    }
  } catch (error) {
    sendResult(message.id, {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    });
  }
}

async function callTool(params) {
  const name = params?.name;
  const args = params?.arguments ?? {};

  switch (name) {
    case "create_note":
      return toolResult(await createNote(args));
    case "list_notes":
      return toolResult(await listNotes());
    case "read_note":
      return toolResult(await readNote(args));
    case "search_notes":
      return toolResult(await searchNotes(args));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function createNote(args) {
  const title = requireString(args.title, "title").trim();
  const content = requireString(args.content, "content").trim();
  const tags = Array.isArray(args.tags)
    ? args.tags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];
  const slug = slugify(title);
  const relativePath = `${new Date().toISOString().slice(0, 10)}-${slug}.md`;
  const fullPath = resolveNotePath(relativePath);

  await mkdir(ROOT, { recursive: true });
  await writeFile(
    fullPath,
    [
      "---",
      `title: ${JSON.stringify(title)}`,
      `tags: [${tags.map((tag) => JSON.stringify(tag.trim())).join(", ")}]`,
      "---",
      "",
      content,
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    action: "note-created",
    relativePath,
    absolutePath: fullPath,
    title,
    tags,
  };
}

async function listNotes() {
  await mkdir(ROOT, { recursive: true });
  const entries = await readdir(ROOT, { withFileTypes: true });
  const notes = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const fullPath = path.join(ROOT, entry.name);
        const fileStat = await stat(fullPath);

        return {
          relativePath: entry.name,
          bytes: fileStat.size,
          updatedAt: fileStat.mtime.toISOString(),
        };
      }),
  );

  return {
    action: "notes-listed",
    root: ROOT,
    notes,
  };
}

async function readNote(args) {
  const relativePath = requireString(args.relativePath, "relativePath");
  const fullPath = resolveNotePath(relativePath);
  const content = await readFile(fullPath, "utf8");

  return {
    action: "note-read",
    relativePath: sanitizeRelativePath(relativePath),
    absolutePath: fullPath,
    content,
  };
}

async function searchNotes(args) {
  const query = requireString(args.query, "query").trim().toLowerCase();
  if (!query) {
    throw new Error("query is required.");
  }

  const listed = await listNotes();
  const matches = [];

  for (const note of listed.notes) {
    const fullPath = resolveNotePath(note.relativePath);
    const content = await readFile(fullPath, "utf8");
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(query);

    if (index !== -1) {
      matches.push({
        relativePath: note.relativePath,
        snippet: content.slice(Math.max(0, index - 60), index + query.length + 60),
      });
    }
  }

  return {
    action: "notes-searched",
    query,
    matches,
  };
}

function toolResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value,
  };
}

function sendResult(id, result) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function sendError(id, code, message) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function requireString(value, name) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string.`);
  }

  return value;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "note";
}

function sanitizeRelativePath(relativePath) {
  const normalized = path.normalize(relativePath).replaceAll("\\", "/");

  if (
    !normalized ||
    path.isAbsolute(normalized) ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    !normalized.endsWith(".md")
  ) {
    throw new Error("Note path must stay inside data/mcp-notes and end with .md.");
  }

  return normalized;
}

function resolveNotePath(relativePath) {
  const safeRelativePath = sanitizeRelativePath(relativePath);
  const fullPath = path.join(ROOT, safeRelativePath);
  const relativeToRoot = path.relative(ROOT, fullPath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error("Note path must stay inside data/mcp-notes.");
  }

  return fullPath;
}
