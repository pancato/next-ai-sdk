export const chatModels = [
  {
    id: "deepseek:deepseek-chat",
    provider: "DeepSeek",
    name: "DeepSeek Chat",
    modelId: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  {
    id: "deepseek:deepseek-reasoner",
    provider: "DeepSeek",
    name: "DeepSeek Reasoner",
    modelId: "deepseek-reasoner",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  {
    id: "deepseek:deepseek-v4-flash",
    provider: "DeepSeek",
    name: "DeepSeek V4 Flash",
    modelId: "deepseek-v4-flash",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  {
    id: "deepseek:deepseek-v4-pro",
    provider: "DeepSeek",
    name: "DeepSeek V4 Pro",
    modelId: "deepseek-v4-pro",
    apiKeyEnv: "DEEPSEEK_API_KEY",
  },
  {
    id: "moonshot:kimi-k2",
    provider: "Moonshot",
    name: "Kimi K2",
    modelId: "kimi-k2",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:kimi-k2-0905",
    provider: "Moonshot",
    name: "Kimi K2 0905",
    modelId: "kimi-k2-0905",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:kimi-k2-thinking",
    provider: "Moonshot",
    name: "Kimi K2 Thinking",
    modelId: "kimi-k2-thinking",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:kimi-k2-thinking-turbo",
    provider: "Moonshot",
    name: "Kimi K2 Thinking Turbo",
    modelId: "kimi-k2-thinking-turbo",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:kimi-k2-turbo",
    provider: "Moonshot",
    name: "Kimi K2 Turbo",
    modelId: "kimi-k2-turbo",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:kimi-k2.5",
    provider: "Moonshot",
    name: "Kimi K2.5",
    modelId: "kimi-k2.5",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:moonshot-v1-8k",
    provider: "Moonshot",
    name: "Moonshot v1 8K",
    modelId: "moonshot-v1-8k",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:moonshot-v1-32k",
    provider: "Moonshot",
    name: "Moonshot v1 32K",
    modelId: "moonshot-v1-32k",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "moonshot:moonshot-v1-128k",
    provider: "Moonshot",
    name: "Moonshot v1 128K",
    modelId: "moonshot-v1-128k",
    apiKeyEnv: "MOONSHOT_API_KEY",
  },
  {
    id: "minimax:MiniMax-M2.1",
    provider: "MiniMax",
    name: "MiniMax M2.1",
    modelId: "MiniMax-M2.1",
    apiKeyEnv: "MINIMAX_API_KEY",
  },
  {
    id: "minimax:MiniMax-M2.1-lightning",
    provider: "MiniMax",
    name: "MiniMax M2.1 Lightning",
    modelId: "MiniMax-M2.1-lightning",
    apiKeyEnv: "MINIMAX_API_KEY",
  },
  {
    id: "minimax:MiniMax-M2",
    provider: "MiniMax",
    name: "MiniMax M2",
    modelId: "MiniMax-M2",
    apiKeyEnv: "MINIMAX_API_KEY",
  },
] as const;

export type ChatModel = (typeof chatModels)[number];
export type ChatModelId = ChatModel["id"];

export const DEFAULT_CHAT_MODEL: ChatModelId = "deepseek:deepseek-chat";

export function getChatModelMetadata(id: string | undefined): ChatModel | null {
  return chatModels.find((model) => model.id === id) ?? null;
}
