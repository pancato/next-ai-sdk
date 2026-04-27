import Link from "next/link";

const routeComparison = [
  {
    title: "/tools",
    subtitle: "Chat + tools + approval",
    points: [
      "API route 直接调用 streamText，模型在一次回复里生成 tool call。",
      "工具调用和结果会作为 message parts 流到前端，页面可以展示每个工具状态。",
      "需要下一轮推理时，前端用 sendAutomaticallyWhen 自动把工具结果再发回服务端。",
      "适合把工具过程暴露给用户，特别是需要 approval 的文件删除、写入等操作。",
    ],
  },
  {
    title: "/agent",
    subtitle: "ToolLoopAgent 服务端自动循环",
    points: [
      "API route 创建 ToolLoopAgent，把 instructions、tools、stopWhen 组合成一个 agent。",
      "agent.stream 会在服务端反复执行：模型思考、调用工具、读取结果、决定下一步。",
      "前端只发起一次请求，不负责驱动下一轮工具循环。",
      "适合代码分析、检索、写报告这类需要自主拆解任务的流程。",
    ],
  },
];

const apiComparison = [
  {
    title: "什么时候用 streamText",
    tag: "底层流式生成",
    points: [
      "普通聊天、补全、问答，或者只需要一次模型回复。",
      "你想完全控制 API route、前端工具展示、approval、自动续发策略。",
      "工具调用是聊天体验的一部分，用户需要看到、批准或补充工具结果。",
      "多步逻辑很轻，直接给 streamText 配 tools 和 stopWhen 就够了。",
    ],
    snippet: `const result = streamText({
  model,
  messages: await convertToModelMessages(messages),
  tools,
});

return result.toUIMessageStreamResponse();`,
  },
  {
    title: "什么时候用 ToolLoopAgent",
    tag: "可复用 agent",
    points: [
      "任务需要 agent 自主推进多步工具调用，直到完成或触发停止条件。",
      "你想把 instructions、工具集、循环停止规则封装成一个可复用对象。",
      "工具基本由服务端拥有，不需要每一步都等待前端确认。",
      "任务更像工作流：分析项目、查资料、读写报告、连续检索和汇总。",
    ],
    snippet: `const agent = new ToolLoopAgent({
  model,
  instructions,
  tools,
  stopWhen: stepCountIs(15),
});

const result = await agent.stream({ messages });`,
  },
];

const rules = [
  {
    label: "一句话判断",
    text: "如果需求是“回复这条消息，必要时调用工具”，优先 streamText；如果需求是“自己持续工作直到任务完成”，优先 ToolLoopAgent。",
  },
  {
    label: "是否需要前端参与",
    text: "需要用户确认、展示工具卡片、补充工具结果时，/tools 这种 streamText + useChat 模式更直观。",
  },
  {
    label: "是否需要复用",
    text: "同一套角色设定、工具、停止条件会在多个地方使用时，把它收进 ToolLoopAgent 更清晰。",
  },
  {
    label: "成本和安全",
    text: "两者都应该设置停止条件或明确续发策略；agent 自主循环能力更强，也更需要限制步数和工具权限。",
  },
];

export default function AgentToolsGuidePage() {
  return (
    <main className="min-h-svh bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col border-x border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold">Agent / Tools 指南</h1>
            <Link className="text-sm text-zinc-500 hover:text-zinc-950" href="/">
              首页
            </Link>
            <Link
              className="text-sm text-zinc-500 hover:text-zinc-950"
              href="/tools"
            >
              文件 tools
            </Link>
            <Link
              className="text-sm text-zinc-500 hover:text-zinc-950"
              href="/agent"
            >
              Agent demo
            </Link>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            这页专门解释当前项目里 /tools 和 /agent 的分工，以及在 AI SDK
            里什么时候应该直接使用 streamText，什么时候该升级为
            ToolLoopAgent。
          </p>
        </header>

        <section className="border-b border-zinc-200 px-4 py-8 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Mental model
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Tools 是能力，Agent 是会循环使用能力的角色
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              tool 本身只是一个可被模型调用的函数定义，包含描述、输入 schema
              和可选的 execute。/tools 展示的是“聊天过程中如何调用工具”。
              Agent 则把模型、系统指令、工具集和停止条件封装起来，让服务端自动完成多步工具循环。
            </p>
          </div>
        </section>

        <section className="grid border-b border-zinc-200 lg:grid-cols-2">
          {routeComparison.map((item) => (
            <article
              className="border-b border-zinc-200 p-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 sm:p-6"
              key={item.title}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {item.title}
                </h2>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                  {item.subtitle}
                </span>
              </div>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-600">
                {item.points.map((point) => (
                  <li className="flex gap-3" key={point}>
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-zinc-950" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="border-b border-zinc-200 px-4 py-8 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {apiComparison.map((item) => (
              <article
                className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
                key={item.title}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base font-semibold">{item.title}</h2>
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-500">
                    {item.tag}
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-600">
                  {item.points.map((point) => (
                    <li className="flex gap-3" key={point}>
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <pre className="mt-4 overflow-x-auto rounded-md bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">
                  <code>{item.snippet}</code>
                </pre>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 py-8 sm:px-6">
          <h2 className="text-base font-semibold">选择规则</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {rules.map((rule) => (
              <article
                className="rounded-md border border-zinc-200 bg-white p-4"
                key={rule.label}
              >
                <h3 className="text-sm font-semibold text-zinc-950">
                  {rule.label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {rule.text}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            这个项目里的对应关系很直接：
            <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
              app/api/tools/route.ts
            </code>
            是 streamText 教学样板，
            <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 text-xs">
              app/api/agent/route.ts
            </code>
            是 ToolLoopAgent 教学样板。
          </div>
        </section>
      </section>
    </main>
  );
}
