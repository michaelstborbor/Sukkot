import { handler } from "@/server/http";
import { LIMITS } from "@/server/rate-limit";
import { AppError } from "@/server/errors";
import {
  askAssistant,
  assistantAvailable,
  chatInputSchema,
} from "@/server/assistant";

/** Whether the AI assistant is switched on (an API key is configured). */
export const GET = handler(async () => ({ available: assistantAvailable() }));

/** Answer the latest message in a chat with the site assistant. */
export const POST = handler(async (ctx) => {
  if (!assistantAvailable())
    throw new AppError("NOT_CONFIGURED", "The assistant is not switched on.");
  await ctx.limit("assistant", LIMITS.assistant);
  await ctx.limit("assistant-day", LIMITS.assistantDaily);
  const input = await ctx.body(chatInputSchema);
  return { reply: await askAssistant(input) };
});
