"use server";
import { createMoonshotAI } from "@ai-sdk/moonshotai";

const moonshot = createMoonshotAI({
  apiKey: process.env["MOONSHOT_API_KEY"],
  baseURL: "https://api.moonshot.cn/v1",
});

export default moonshot;
