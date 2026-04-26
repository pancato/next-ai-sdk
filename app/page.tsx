import Link from "next/link";

const examples = [
  {
    href: "/chat",
    title: "基础聊天",
    description: "路由 /chat，API /api/chat，只演示普通多轮对话。",
  },
  {
    href: "/tools",
    title: "Tools 示例",
    description: "路由 /tools，API /api/tools，演示 tools、前端确认和 approval。",
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

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
