"use server";
import { createMinimaxOpenAI } from "vercel-minimax-ai-provider";

const minimax = createMinimaxOpenAI({
  apiKey: process.env["MINIMAX_API_KEY"],
  // 指定中国区 url
  baseURL: "https://api.minimaxi.com/v1",
});

export default minimax;
