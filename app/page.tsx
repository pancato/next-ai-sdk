import Link from "next/link";

const examples = [
  {
    href: "/chat",
    title: "基础聊天",
    description: "路由 /chat，API /api/chat，只演示普通多轮对话。",
  },
  {
    href: "/tools",
    title: "文件 Tools",
    description: "路由 /tools，API /api/tools，演示真实文件读写和 approval。",
  },
  {
    href: "/agent",
    title: "Agent",
    description:
      "路由 /agent，API /api/agent，演示 ToolLoopAgent 服务端自动循环。",
  },
  {
    href: "/agent-tools-guide",
    title: "Agent / Tools 指南",
    description:
      "专门解释 /agent、/tools、streamText 和 ToolLoopAgent 的区别。",
  },
  {
    href: "/mcp",
    title: "MCP 示例",
    description: "路由 /mcp，API /api/mcp，连接本地 stdio MCP server。",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-svh bg-zinc-50 px-4 py-10 text-zinc-950">
      <section className="mx-auto flex w-full max-w-3xl flex-col justify-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Next AI SDK 教学示例
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">
            基础聊天和 tools 能力已经分成独立路由，方便按主题学习。
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((example) => (
            <Link
              className="rounded-md border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              href={example.href}
              key={example.href}
            >
              <h2 className="text-base font-semibold">{example.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {example.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
