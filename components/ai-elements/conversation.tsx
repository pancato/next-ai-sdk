import type { ComponentProps } from "react";

type ConversationProps = ComponentProps<"section">;
type ConversationContentProps = ComponentProps<"div">;

export function Conversation({ className = "", ...props }: ConversationProps) {
  return (
    <section
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}
      {...props}
    />
  );
}

export function ConversationContent({
  className = "",
  ...props
}: ConversationContentProps) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6 ${className}`}
      {...props}
    />
  );
}

