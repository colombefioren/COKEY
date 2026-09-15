import type { TokenUsage } from "./adapter.js";
import { openAiUsage } from "./openai-compatible.js";

export interface OpenAiToolCall {
  index?: number;
  id?: string;
  type: "function";
  function: { name?: string; arguments: string };
}

export interface OpenAiUsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export function openAiUsagePayload(usage: TokenUsage | undefined): OpenAiUsagePayload | undefined {
  if (!usage) return undefined;
  const prompt = usage.inputTokens ?? 0;
  const completion = usage.outputTokens ?? 0;
  if (prompt === 0 && completion === 0) return undefined;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  };
}

export interface CompletionOptions {
  id: string;
  model: string;
  created: number;
  content: string;
  finishReason: string;
  toolCalls?: OpenAiToolCall[];
  usage?: TokenUsage;
}

export function openAiCompletion(options: CompletionOptions): Record<string, unknown> {
  const message: Record<string, unknown> = { role: "assistant", content: options.content || null };
  if (options.toolCalls && options.toolCalls.length > 0) {
    message.tool_calls = options.toolCalls.map((call, index) => ({
      index,
      ...call,
      function: { name: call.function.name, arguments: call.function.arguments },
    }));
  }

  return {
    id: options.id,
    object: "chat.completion",
    created: options.created,
    model: options.model,
    choices: [{ index: 0, message, finish_reason: options.finishReason }],
    usage: openAiUsagePayload(options.usage) ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

export interface ChunkOptions {
  id: string;
  model: string;
  created: number;
  delta: Record<string, unknown>;
  finishReason?: string | null;
  usage?: TokenUsage;
}

export function openAiChunk(options: ChunkOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: options.id,
    object: "chat.completion.chunk",
    created: options.created,
    model: options.model,
    choices: [{ index: 0, delta: options.delta, finish_reason: options.finishReason ?? null }],
  };
  const usage = openAiUsagePayload(options.usage);
  if (usage) payload.usage = usage;
  return payload;
}

export function mapFinishReason(reason: string | undefined | null): string {
  if (!reason) return "stop";
  const normalized = reason.toLowerCase();
  if (
    normalized === "max_tokens" ||
    normalized === "length" ||
    normalized === "max_output_tokens"
  ) {
    return "length";
  }
  if (
    normalized === "tool_use" ||
    normalized === "tool_calls" ||
    normalized === "function_call" ||
    normalized === "tool" ||
    normalized === "tool_call"
  ) {
    return "tool_calls";
  }
  if (
    normalized.includes("safety") ||
    normalized.includes("blocklist") ||
    normalized.includes("recitation") ||
    normalized.includes("prohibited") ||
    normalized === "content_filter"
  ) {
    return "content_filter";
  }
  return "stop";
}

export function createStreamUsageSniffer(): {
  onChunk: (chunk: Uint8Array) => void;
  usage: () => TokenUsage | undefined;
} {
  const decoder = new TextDecoder();
  let buffer = "";
  let found: TokenUsage | undefined;

  return {
    onChunk(chunk: Uint8Array) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const usage = openAiUsage(parsed);
        if (usage.inputTokens || usage.outputTokens) found = usage;
      }
    },
    usage: () => found,
  };
}

export function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      parts.push(part);
    } else if (part && typeof part === "object") {
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") parts.push(p.text);
    }
  }
  return parts.join("");
}
