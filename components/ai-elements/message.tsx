"use client";

import type { ComponentProps, ReactNode } from "react";
import { Streamdown } from "streamdown";

type MessageProps = ComponentProps<"article"> & {
  from: "user" | "assistant" | "system";
};

type MessageContentProps = ComponentProps<"div"> & {
  children: ReactNode;
  isStreaming?: boolean;
};

export function Message({ className = "", from, ...props }: MessageProps) {
  const alignment = from === "user" ? "items-end" : "items-start";

  return (
    <article
      data-from={from}
      className={`flex w-full flex-col ${alignment} ${className}`}
      {...props}
    />
  );
}

export function MessageContent({
  children,
  className = "",
  isStreaming = false,
  ...props
}: MessageContentProps) {
  if (typeof children === "string") {
    return (
      <div className={`message-content ${className}`} {...props}>
        <Streamdown animated isAnimating={isStreaming}>
          {children}
        </Streamdown>
      </div>
    );
  }

  return (
    <div className={`message-content ${className}`} {...props}>
      {children}
    </div>
  );
}

