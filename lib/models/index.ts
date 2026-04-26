import type { LanguageModel } from "ai";

import deepseek from "./deepseek";
import minimax from "./minimax";
import moonshot from "./moonshot";
import {
  DEFAULT_CHAT_MODEL,
  chatModels,
  getChatModelMetadata,
  type ChatModel,
  type ChatModelId,
} from "./catalog";

export {
  DEFAULT_CHAT_MODEL,
  chatModels,
  getChatModelMetadata,
  type ChatModel,
  type ChatModelId,
};

export function getChatModel(id: string | undefined = DEFAULT_CHAT_MODEL): LanguageModel {
  const metadata = getChatModelMetadata(id);

  if (!metadata) {
    throw new Error(`Unsupported model: ${id}`);
  }

  if (!process.env[metadata.apiKeyEnv]) {
    throw new Error(`Missing ${metadata.apiKeyEnv} for ${metadata.name}`);
  }

  if (metadata.id.startsWith("deepseek:")) {
    return deepseek(metadata.modelId);
  }

  if (metadata.id.startsWith("moonshot:")) {
    return moonshot(metadata.modelId);
  }

  if (metadata.id.startsWith("minimax:")) {
    return minimax(metadata.modelId);
  }

  throw new Error(`Unsupported model provider: ${metadata.provider}`);
}
