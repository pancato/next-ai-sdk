import type { ComponentProps } from "react";

type PromptInputProps = ComponentProps<"form">;
type PromptInputTextareaProps = ComponentProps<"textarea">;
type PromptInputToolbarProps = ComponentProps<"div">;
type PromptInputSubmitProps = ComponentProps<"button"> & {
  status?: "ready" | "submitted" | "streaming" | "error";
};

export function PromptInput({ className = "", ...props }: PromptInputProps) {
  return (
    <form
      className={`rounded-lg border border-zinc-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  );
}

export function PromptInputTextarea({
  className = "",
  ...props
}: PromptInputTextareaProps) {
  return (
    <textarea
      className={`max-h-48 min-h-24 w-full resize-none bg-transparent px-4 py-3 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-400 ${className}`}
      {...props}
    />
  );
}

export function PromptInputToolbar({
  className = "",
  ...props
}: PromptInputToolbarProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 ${className}`}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  className = "",
  status = "ready",
  children,
  ...props
}: PromptInputSubmitProps) {
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <button
      className={`inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 ${className}`}
      disabled={isBusy || props.disabled}
      type="submit"
      {...props}
    >
      {children ?? (isBusy ? "生成中" : "发送")}
    </button>
  );
}

