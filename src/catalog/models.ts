/**
 * The free-model catalog.
 *
 * One entry per model that is currently available on a provider's
 * self-replenishing free tier. This is *data*, exactly like the provider
 * catalog: the Add-Chain picker renders it, and the API only lets a model be
 * selected when its provider has a working key in the pool.
 *
 * Fields mirror what a user actually chooses on:
 *   - `context`        the advertised window (`256K`, `1M`, …)
 *   - `bestFor`        Code | General | Reasoning | Vision | Agent | Fallback
 *   - `latencySeconds` measured time to first token, and therefore how good a
 *                      model is as the *first* entry of a chain
 *
 * Keep this list to models a provider genuinely serves for free. A model that
 * starts costing money does not belong here, even if it still answers.
 */
export interface ModelSpec {
  /** Model id exactly as the provider expects it in a request. */
  id: string;
  /** Advertised context window. */
  context?: string;
  /** What the model is best at. */
  bestFor?: string;
  /** Measured latency to first token, in seconds. */
  latencySeconds?: number;
}

/** Terse constructor so the catalog below stays readable. */
function m(id: string, context?: string, bestFor?: string, latencySeconds?: number): ModelSpec {
  return { id, context, bestFor, latencySeconds };
}

/** Free models per provider id, in the order the catalogue lists them. */
export const MODELS_BY_PROVIDER: Record<string, ModelSpec[]> = {
  // -------------------------------------------------------------------------
  // Low-latency specialists
  // -------------------------------------------------------------------------
  groq: [
    m("allam-2-7b", "131K", "Fallback", 0.2),
    m("groq/compound", "131K", "General", 0.7),
    m("groq/compound-mini", "131K", "General", 0.7),
    m("openai/gpt-oss-120b", "131K", "Code", 0.4),
    m("openai/gpt-oss-20b", "131K", "Code", 0.6),
    m("qwen/qwen3.6-27b", "131K", "Code", 0.2),
    m("qwen/qwen3.8-27b", "262K", "Code", 0.3),
  ],

  // -------------------------------------------------------------------------
  // Unified gateways
  // -------------------------------------------------------------------------
  openrouter: [
    m("cohere/north-mini-code:free", "128K", "Code", 2.1),
    m("dots-studio/dots-3-note-preview:free", "32K", "General", 1.7),
    m("google/gemma-4-26b-a4b-it:free", "32K", "General", 1.5),
    m("inclusionai/ling-3.0-flash-fin:free", "262K", "General", 1.5),
    m("inclusionai/ling-3.0-flash-sante:free", "262K", "General", 1.5),
    m("liquid/lfm-2.5-2.6b:free", "32K", "General", 1.6),
    m("nex-agi/nex-n2.5-mini:free", "32K", "General", 1.5),
    m("nex-agi/nex-n2.5-pro:free", "32K", "General", 1.5),
    m("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "1M", "Reasoning", 0.7),
    m("nvidia/nemotron-3-super-120b-a12b:free", "1M", "General", 2.7),
    m("nvidia/nemotron-3.5-lightning:free", "262K", "General", 1.6),
    m("poolside/laguna-s-2.1:free", "256K", "Code", 2.0),
    m("poolside/laguna-xs-2.1:free", "128K", "Code", 1.9),
  ],
  kilo: [
    m("cohere/north-mini-code:free", "128K", "Code", 1.5),
    m("dots-studio/dots-3-note-preview:free", "32K", "General", 1.6),
    m("inclusionai/ling-3.0-flash-fin:free", "262K", "General", 1.5),
    m("inclusionai/ling-3.0-flash-sante:free", "262K", "General", 1.5),
    m("liquid/lfm-2.5-2.6b:free", "32K", "General", 1.6),
    m("nex-agi/nex-n2.5-mini:free", "32K", "General", 1.5),
    m("nex-agi/nex-n2.5-pro:free", "32K", "General", 1.5),
    m("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "128K", "Reasoning", 2.5),
    m("nvidia/nemotron-3-super-120b-a12b:free", "262K", "General", 0.8),
    m("nvidia/nemotron-3.5-lightning:free", "128K", "General", 1.6),
    m("poolside/laguna-xs-2.1:free", "128K", "Code", 1.9),
    m("stepfun/step-3.7-flash:free", "128K", "General", 2.5),
  ],
  literouter: [
    m("deepseek-r1:free", "128K", "Reasoning", 2.0),
    m("deepseek-v3.2:free", "128K", "Reasoning", 1.77),
    m("deepseek-v4-flash:free", "1M", "Reasoning", 2.63),
    m("gemini-2.5-flash:free", "1M", "General", 4.54),
    m("gemini-2.5-flash-lite:free", "1M", "General", 4.07),
    m("gemma-4-26b-a4b-it:free", "32K", "General", 3.46),
    m("gemma-4-31b-it:free", "32K", "General", 3.46),
    m("glm-4.7:free", "128K", "General", 5.87),
    m("glm-5.2:free", "128K", "General", 5.87),
    m("gpt-oss-120b:free", "128K", "General", 3.41),
    m("gpt-oss-20b:free", "128K", "Code", 1.98),
    m("kimi-k2-thinking:free", "128K", "Reasoning", 3.21),
    m("kimi-k2.7-code:free", "128K", "Code", 3.21),
    m("llama-3.3-70b-instruct-turbo:free", "128K", "General", 2.18),
    m("minimax-m2.7:free", "200K", "General", 6.78),
    m("mistral-large-2512:free", "128K", "General", 3.21),
    m("qwen3.8-27b:free", "128K", "General", 5.36),
  ],
  poixe: [
    m("deepseek-chat:free", "128K", "General", 1.6),
    m("gemini-2.5-flash:free", "1M", "General", 1.5),
    m("gemini-2.5-flash-lite:free", "1M", "General", 1.5),
    m("gpt-4.1-mini:free", "1M", "General", 1.6),
    m("gpt-4.1-nano:free", "1M", "Code", 1.6),
    m("gpt-4o:free", "128K", "General", 1.2),
    m("gpt-4o-mini:free", "128K", "General", 0.9),
    m("gpt-5-mini:free", "400K", "General", 1.6),
    m("gpt-5-nano:free", "400K", "General", 1.6),
    m("gpt-oss-120b:free", "131K", "General", 1.3),
    m("gpt-oss-20b:free", "131K", "Code", 0.8),
    m("grok-3-mini:free", "131K", "Reasoning", 3.4),
    m("o3-mini-2025-01-31:free", "128K", "Reasoning", 3.0),
    m("qwen-long:free", "1M", "General", 1.5),
    m("qwen-plus:free", "128K", "General", 1.3),
    m("qwen-turbo:free", "1M", "General", 1.5),
    m("qwen3-235b-a22b:free", "262K", "General", 1.6),
  ],
  xkiro: [
    m("deepseek/deepseek-chat-v3.1", "128K", "General", 2.18),
    m("deepseek/deepseek-v3.2", "128K", "Reasoning", 2.31),
    m("deepseek/deepseek-v4-flash", "1M", "Reasoning", 1.86),
    m("deepseek/deepseek-v4-pro", "1M", "Reasoning", 7.51),
    m("minimax/minimax-m2.1", "200K", "General", 2.5),
    m("minimax/minimax-m3:free", "1M", "General", 1.93),
    m("minimax/minimax-m2.7", "200K", "General", 5.65),
    m("minimax/minimax-m2.7-highspeed", "200K", "General", 2.71),
    m("mistralai/codestral-2508", "256K", "Code", 0.6),
    m("mistralai/devstral-medium", "128K", "Code", 0.66),
    m("mistralai/ministral-8b", "128K", "General", 0.69),
    m("mistralai/mistral-large-2512", "262K", "Reasoning", 1.6),
    m("mistralai/mistral-medium-3.5", "32K", "General", 0.74),
    m("qwen/qwen-plus-2025-07-28:free", "128K", "General", 2.33),
    m("qwen/qwen3-coder-plus:free", "128K", "Code", 2.81),
    m("qwen/qwen3-max:free", "128K", "General", 4.2),
    m("qwen/qwen3-vl-plus:free", "128K", "Vision", 2.3),
    m("qwen/qwen3.6-27b:free", "256K", "Code", 2.5),
    m("qwen/qwen3.6-35b-a3b:free", "256K", "General", 2.58),
    m("qwen/qwen3.7-plus:free", "262K", "General", 2.63),
    m("qwen/qwen3.8-max:free", "262K", "General", 3.49),
    m("sensenova/sensenova-6.8-flash-lite", "128K", "General", 4.13),
  ],
  voidai: [
    m("deepseek-v3.2", "128K", "Reasoning", 2.0),
    m("deepseek-v4-flash", "128K", "Reasoning", 1.5),
    m("deepseek-v4-pro", "1M", "Reasoning", 1.6),
    m("gemini-2.5-flash", "1M", "General", 1.5),
    m("gemini-2.5-pro", "1M", "General", 1.5),
    m("gemini-3.1-flash-lite", "1M", "General", 0.7),
    m("gemini-3.5-flash", "1M", "Code", 1.7),
    m("gemini-3.6-flash", "1M", "Code", 1.8),
    m("gemma-4-31b-it", "128K", "General", 1.5),
    m("glm-5.2", "128K", "General", 2.0),
    m("glm-5.3", "128K", "General", 2.0),
    m("gpt-4.1", "1M", "General", 1.7),
    m("gpt-4.1-mini", "1M", "General", 1.7),
    m("gpt-4o-mini", "128K", "General", 1.7),
    m("gpt-5.3-codex", "400K", "Code", 1.7),
    m("gpt-5.4-mini", "400K", "General", 1.7),
    m("gpt-oss-120b", "131K", "General", 1.7),
    m("gpt-oss-20b", "131K", "Code", 1.5),
    m("kimi-k2.6", "128K", "Reasoning", 0.8),
    m("kimi-k2.7-code", "128K", "Code", 1.5),
    m("kimi-k3", "128K", "Reasoning", 1.5),
    m("qwen3-235b-a22b-instruct", "256K", "Reasoning", 1.7),
    m("qwen3.8-27b:free", "262K", "General", 1.5),
    m("sonar", "128K", "General", 1.6),
    m("sonar-pro", "128K", "General", 1.6),
    m("sonar-reasoning-pro", "128K", "Reasoning", 1.6),
  ],
  naga: [
    m("dots-3-note-preview:free", "512K", "General", 1.6),
    m("lfm-2.5-2.6b:free", "65K", "General", 1.6),
    m("ling-3.0-flash-fin:free", "262K", "General", 1.5),
    m("ling-3.0-flash-sante:free", "262K", "General", 1.5),
    m("nemotron-3-super-120b-a12b:free", "262K", "General", 3.2),
    m("nemotron-3.5-lightning:free", "1M", "General", 1.6),
    m("sonar:free", "128K", "General", 2.5),
  ],
  tokenreply: [
    m("dots-3-note-preview", "32K", "General", 1.63),
    m("gemini-3.7-flash-default-free", "1M", "General", 2.73),
    m("google/gemma-4-26b-a4b-it", "32K", "General", 2.07),
    m("laguna-s-2.1", "256K", "Code", 1.85),
    m("laguna-xs-2.1", "128K", "Code", 1.17),
    m("ling-3.0-flash-fin-free", "262K", "General", 1.78),
    m("north-mini-code", "128K", "Code", 0.93),
    m("nemotron-3-nano-omni-30b-a3b-reasoning", "1M", "Reasoning", 2.09),
    m("nemotron-3.5-lightning-30b-a3b", "262K", "General", 1.75),
    m("nvidia/nemotron-3-nano-30b-a3b", "1M", "General", 0.96),
    m("nvidia/nemotron-3-super-120b-a12b", "1M", "Reasoning", 1.07),
    m("openai/gpt-oss-20b", "128K", "Code", 0.98),
    m("openai/gpt-oss-120b", "128K", "General", 1.7),
  ],
  orcarouter: [
    m("deepseek/deepseek-v4-flash-free", "1M", "General", 1.38),
    m("orcarouter/free", undefined, "General", 1.31),
    m("qwen/qwen3.8-27b-free", "262K", "General", 0.79),
    m("tencent/hy3-free", "32K", "General", 3.49),
  ],
  zydit: [
    m("big-pickle", "200K", "General", 14.62),
    m("deepseek-r1:latest", "128K", "Reasoning", 7.73),
    m("gemma-4-31b", "32K", "General", 4.18),
    m("mimo-v2.5", "1M", "General", 5.59),
    m("muse-spark-1.2", "1M", "General", 7.24),
    m("nemotron-3-ultra-max", "1M", "General", 4.24),
    m("nemotron-3.5-lightning-max", "262K", "General", 5.5),
  ],
  zylo: [
    m("gpt-oss-20b", "131K", "Code", 0.9),
    m("minimax-m3", "1M", "General", 1.1),
    m("nemotron-3-ultra", "1M", "General", 1.1),
    m("zylo-flash", "128K", "General", 1.2),
    m("zylo-lite", "128K", "General", 1.2),
    m("zylo-pro", "128K", "General", 1.2),
  ],
  electronhub: [
    m("codestral-latest", "256K", "Code", 1.21),
    m("codestral-2508", "256K", "Code", 1.05),
    m("devstral-latest", "262K", "Code", 1.24),
    m("devstral-medium-latest", "262K", "Code", 1.23),
    m("gemini-2.5-flash-lite", "1M", "General", 1.11),
    m("gemini-3.5-flash-lite", "1M", "General", 1.53),
    m("gpt-4.1", "1M", "General", 1.43),
    m("gpt-4.1-mini", "1M", "General", 1.64),
    m("gpt-4.1-nano", "1M", "Code", 2.34),
    m("gpt-4o", "128K", "General", 1.52),
    m("gpt-4o-mini", "128K", "General", 1.95),
    m("gpt-5.4-mini", "400K", "General", 1.57),
    m("gpt-oss-120b", "128K", "General", 3.26),
    m("magistral-medium-latest", "262K", "Reasoning", 1.31),
    m("ministral-14b-2512", "262K", "General", 1.06),
    m("ministral-3b-2512", "131K", "Code", 1.1),
    m("mistral-code-latest", "256K", "Code", 1.09),
    m("mistral-large-2512", "262K", "Reasoning", 4.8),
    m("mistral-medium-2508", "131K", "General", 1.2),
    m("mistral-small-3.2-24b-instruct", "128K", "Code", 1.18),
    m("o3-mini", "200K", "Reasoning", 3.02),
    m("o4-mini", "200K", "Reasoning", 2.33),
    m("phi-4", "16K", "General", 1.19),
    m("qwen-2.5-coder-32b-instruct", "33K", "Code", 0.76),
    m("qwen3-coder-30-a3b-instruct", "262K", "Code", 1.07),
    m("qwen3.8-27b", "262K", "General", 1.08),
    m("kimi-k2.7-code", "262K", "Code", 2.05),
    m("minimax-m2.7", "200K", "General", 1.41),
    m("laguna-s-2.1", "262K", "Code", 2.54),
    m("grok-4.5", "500K", "Reasoning", 1.86),
  ],
  huggingface: [
    m("deepseek-ai/DeepSeek-R1", "128K", "Reasoning", 1.9),
    m("deepseek-ai/DeepSeek-V3.2", "128K", "Reasoning", 1.1),
    m("deepseek-ai/DeepSeek-V4-Flash", "128K", "Reasoning", 1.2),
    m("deepseek-ai/DeepSeek-V4-Pro", "128K", "Reasoning", 0.9),
    m("meta-llama/Llama-3.3-70B-Instruct", "128K", "General", 0.6),
    m("meta-llama/Llama-4-Scout-17B-16E-Instruct", "256K", "General", 0.6),
    m("microsoft/phi-4", "128K", "Code", 0.7),
    m("MiniMaxAI/MiniMax-M3", "1M", "General", 1.5),
    m("moonshotai/Kimi-K2.7-Code", "128K", "Code", 0.7),
    m("openai/gpt-oss-120b", "128K", "General", 0.6),
    m("Qwen/Qwen2.5-Coder-32B-Instruct", "128K", "Code", 0.7),
    m("Qwen/Qwen3-235B-A22B-Instruct-2507", "256K", "Code", 0.5),
    m("Qwen/Qwen3-Coder-30B-A3B-Instruct", "256K", "Code", 0.8),
    m("Qwen/Qwen3-Coder-480B-A35B-Instruct", "256K", "Code", 2.1),
    m("Qwen/Qwen3-VL-30B-A3B-Instruct", "128K", "Vision", 1.0),
    m("Qwen/Qwen3.6-35B-A3B", "256K", "Code", 0.6),
    m("zai-org/GLM-4.7", "128K", "General", 4.7),
  ],
  requesty: [
    m("google/gemma-4-31b-it", "32K", "General", 1.48),
    m("nvidia/muse-glimmer-30b", "131K", "General", 4.75),
    m("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "1M", "Reasoning", 1.47),
    m("nvidia/nemotron-3-super-120b-a12b", "1M", "General", 0.87),
    m("nvidia/nemotron-3.5-lightning-30b-a3b", "262K", "General", 0.97),
  ],
  routeway: [
    m("muse-glimmer-30b:free", "131K", "General", 4.05),
    m("gpt-oss-120b:free", "131K", "General", 11.04),
  ],
  bazaarlink: [
    m("auto:free", undefined, "General", 2.56),
    m("qwen/qwen3.7-flash:free", "1M", "General", 3.23),
  ],
  fastrouter: [
    m("openai/gpt-oss-120b:free", "131K", "General", 2.8),
    m("openai/gpt-oss-20b:free", "131K", "Code", 2.8),
    m("sarvam/sarvam-105b:free", "128K", "General", 2.79),
  ],
  "pooled-ai": [
    m("MiniMax-M2.5-Official", "200K", "General", 2.58),
    m("MiniMax-M2.7-Official", "200K", "General", 2.37),
    m("MiniMax-M3-Official", "1M", "General", 1.55),
  ],

  // -------------------------------------------------------------------------
  // First-party labs
  // -------------------------------------------------------------------------
  gemini: [
    m("models/gemini-2.5-flash", "1M", "Fallback", 1.1),
    m("models/gemini-2.5-flash-lite", "1M", "Fallback", 0.9),
    m("models/gemini-3-flash-preview", "1M", "General", 1.5),
    m("models/gemini-3.1-flash-lite", "1M", "General", 0.7),
    m("models/gemini-3.5-flash", "1M", "Code", 1.7),
    m("models/gemini-3.5-flash-lite", "1M", "General", 1.5),
    m("models/gemini-3.6-flash", "1M", "Code", 1.5),
    m("models/gemini-3.7-flash", "1M", "Code", 1.5),
    m("models/gemini-3.8-flash", "1M", "Code", 1.8),
    m("models/gemini-flash-latest", "1M", "Code", 1.7),
    m("models/gemini-flash-lite-latest", "1M", "General", 0.9),
    m("models/gemma-4-26b-a4b-it", "32K", "General", 1.5),
  ],
  mistral: [
    m("codestral-latest", "256K", "Code", 0.4),
    m("codestral-2508", "256K", "Code", 0.4),
    m("devstral-latest", "262K", "Code", 1.24),
    m("devstral-medium-latest", "262K", "Code", 1.23),
    m("ministral-14b-latest", "128K", "General", 0.4),
    m("ministral-8b-latest", "128K", "General", 0.5),
    m("ministral-3b-latest", "128K", "General", 0.4),
    m("mistral-code-latest", "128K", "Code", 0.4),
    m("mistral-medium-2508", "131K", "General", 1.2),
    m("mistral-small-3.2-24b-instruct", "128K", "Code", 1.18),
  ],
  cohere: [
    m("command-a-03-2025", "256K", "Agent", 0.55),
    m("command-r-08-2024", "128K", "General", 0.51),
    m("command-r-plus-08-2024", "128K", "Reasoning", 0.54),
    m("command-r7b-12-2024", "128K", "Code", 0.5),
    m("command-a-reasoning-08-2025", "256K", "Reasoning", 0.66),
    m("c4ai-aya-expanse-32b", "128K", "General", 0.82),
  ],
  nvidia: [
    m("deepseek-ai/deepseek-v4-flash-0731", "262K", "Reasoning"),
    m("deepseek-ai/deepseek-v4-pro-0813", "262K", "Reasoning"),
    m("meta/llama-3.2-11b-vision-instruct", "128K", "Vision", 1.0),
    m("meta/muse-glimmer-30b", "131K", "General", 1.3),
    m("mistralai/mistral-nemotron", "128K", "General", 1.3),
    m("moonshotai/kimi-k3", "128K", "Reasoning", 1.5),
    m("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "1M", "Reasoning", 0.4),
    m("nvidia/nemotron-3-super-120b-a12b", "1M", "Reasoning", 0.7),
    m("nvidia/nemotron-3.5-lightning-30b-a3b", "262K", "General", 1.3),
    m("openai/gpt-oss-20b", "131K", "General", 2.0),
    m("poolside/laguna-xs-2.1", "128K", "Code", 1.5),
  ],
  poolside: [
    m("poolside/laguna-s-2.1", "256K", "Code", 1.3),
    m("poolside/laguna-xs-2.1", "128K", "Code", 0.9),
  ],
  zai: [m("glm-4.7-flash", "128K", "General", 2.4), m("glm-4.5-flash", "128K", "Fallback", 0.7)],
  "intern-ai": [
    m("intern-latest", "256K", "General", 1.0),
    m("intern-s2-preview", "256K", "Reasoning", 1.0),
    m("intern-s2-preview-35b", "256K", "Reasoning", 1.5),
    m("intern-s2-preview-397b", "256K", "Reasoning", 10.5),
    m("internvl-latest", "128K", "Vision", 1.0),
  ],
  "sea-lion": [
    m("aisingapore/Gemma-SEA-LION-v4-27B-IT", "131K", "General", 1.61),
    m("aisingapore/Llama-SEA-LION-v3-70B-IT", "128K", "General", 1.76),
    m("aisingapore/Qwen-SEA-LION-v4-32B-IT", "128K", "General", 1.79),
  ],

  // -------------------------------------------------------------------------
  // Hosted open weights
  // -------------------------------------------------------------------------
  cloudflare: [
    m("@cf/openai/gpt-oss-120b", "128K", "Code", 0.7),
    m("@cf/openai/gpt-oss-20b", "128K", "General", 0.6),
    m("@cf/qwen/qwen3.8-27b", "262K", "General", 0.7),
    m("@cf/qwen/qwen3-30b-a3b-fp8", "32K", "General", 0.9),
    m("@cf/qwen/qwen2.5-coder-32b-instruct", "32K", "Code", 0.7),
    m("@cf/qwen/qwq-32b", "24K", "Reasoning", 0.8),
    m("@cf/meta/llama-4-scout-17b-16e-instruct", "131K", "General", 0.6),
    m("@cf/meta/llama-3.3-70b-instruct-fp8-fast", "24K", "Reasoning", 0.9),
    m("@cf/meta/llama-3.2-11b-vision-instruct", "128K", "Vision", 0.9),
    m("@cf/mistralai/mistral-small-3.1-24b-instruct", "128K", "General", 0.8),
    m("@cf/google/gemma-4-26b-a4b-it", "256K", "General", 0.5),
    m("@cf/zai-org/glm-4.7-flash", "131K", "Agent", 0.5),
    m("@cf/nvidia/nemotron-3-120b-a12b", "256K", "Reasoning", 0.7),
    m("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", "80K", "Reasoning", 0.7),
  ],
  ollama: [
    m("gemma4:31b", "256K", "General", 3.8),
    m("gpt-oss:120b", "128K", "General", 1.3),
    m("gpt-oss:20b", "128K", "Reasoning", 1.3),
    m("nemotron-3-nano:30b", "1M", "Reasoning", 2.1),
    m("nemotron-3-super", "256K", "General", 2.0),
    m("nemotron-3-ultra", "256K", "General", 1.5),
  ],
  evolvex: [
    m("google/diffusiongemma-26b-a4b-it", "262K", "General", 2.56),
    m("meta/llama-3.2-11b-vision-instruct", "128K", "Vision", 1.06),
    m("meta/muse-glimmer-30b", "131K", "General", 5.36),
    m("minimaxai/minimax-m3", "1M", "General", 1.95),
    m("moonshotai/kimi-k3", "128K", "Reasoning", 3.15),
    m("nvidia/nemotron-3-super-120b-a12b", "1M", "General", 2.21),
    m("openai/gpt-oss-20b", "131K", "Code", 2.3),
    m("poolside/laguna-xs-2.1", "128K", "Code", 5.23),
  ],
  "opencode-zen": [
    m("big-pickle", "200K", "Fallback", 2.1),
    m("laguna-s-2.1-free", "256K", "Code", 1.8),
    m("ling-3.0-flash-fin-free", "262K", "General", 1.74),
    m("mimo-v2.5-free", "200K", "Code", 2.8),
    m("muse-spark-1.2-contributor-free", "1M", "Code", 1.6),
    m("muse-spark-1.3-contributor-free", "1M", "Code", 1.5),
    m("nemotron-3-ultra-free", "1M", "Code", 1.7),
    m("nemotron-3.5-lightning-free", "262K", "General", 1.4),
  ],

  // -------------------------------------------------------------------------
  // Smaller hubs
  // -------------------------------------------------------------------------
  "aion-labs": [
    m("aion-labs/aion-3.0", "128K", "Code", 2.2),
    m("aion-labs/aion-3.0-mini", "128K", "General", 2.1),
    m("aion-labs/aion-2.0", "128K", "General", 2.3),
    m("aion-labs/aion-rp-llama-3.1-8b", "32K", "Fallback", 7.3),
  ],
  "agnes-ai": [
    m("agnes-2.0-flash", "512K", "General", 0.65),
    m("agnes-2.5-flash", "512K", "Fallback", 0.7),
    m("agnes-3.0-flash", "512K", "General", 0.69),
  ],
  anyapi: [
    m("dots-studio/dots-3-note-preview:free", "32K", "General", 1.6),
    m("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "128K", "Reasoning", 8.8),
  ],
  auriko: [
    m("glm-4.5-flash", "200K", "General", 2.8),
    m("glm-4.6v-flash", "128K", "General", 3.0),
    m("glm-4.7-flash", "200K", "General", 2.8),
  ],
  freeai: [m("qwen3-8b", "128K", "General", 1.37), m("qwen-vl", "32K", "Vision", 2.31)],
  freeinference: [
    m("deepseek-v4-flash", "1M", "Reasoning", 1.31),
    m("diffusiongemma", "262K", "General", 2.05),
    m("qwen3.6-35b", "262K", "Code", 1.12),
  ],
  "gonka-broker": [
    m("deepseek-ai/DeepSeek-V4-Flash-0731", "400K", "Reasoning", 0.7),
    m("MiniMaxAI/MiniMax-M2.7", "200K", "Reasoning", 0.74),
    m("moonshotai/Kimi-K2.6", "256K", "Reasoning", 0.62),
  ],
  helixmind: [
    m("deepseek-v4-flash-0731-thinking", "128K", "Reasoning", 2.86),
    m("gpt-oss-20b", "128K", "Code", 2.4),
    m("llama-4-scout", "328K", "General", 1.1),
    m("mimo-v2.5", "1M", "Code", 1.1),
    m("qwen3.6-35b-a3b", "262K", "General", 2.1),
  ],
  "llm-kiwi": [m("auto", undefined, "General", 1.0), m("hrLLM", undefined, "General", 2.4)],
  llm7: [
    m("codestral-latest", "32K", "Code", 1.0),
    m("minimax-m2.7", "180K", "Reasoning", 1.8),
    m("mistral-Nemo-Instruct-2407", "128K", "General", 3.1),
  ],
  meganova: [
    m("meganova-ai/manta-flash-1.0", "16K", "General", 1.1),
    m("meganova-ai/manta-mini-1.0", "8K", "General", 1.3),
    m("mistralai/Mistral-Small-3.2-24B-Instruct-2506", "8K", "General", 1.5),
    m("Sao10K/L3-8B-Stheno-v3.2", "8K", "General", 1.0),
  ],
  mixlayer: [m("qwen/qwen3.5-4b-free", "131K", "General", 1.0)],
  odirouter: [
    m("free-claude-haiku-4.5", "200K", "Code", 2.21),
    m("free-gemini-2.5-flash", "1M", "General", 1.8),
    m("free-gemini-2.5-pro", "1M", "Reasoning", 4.4),
    m("free-gpt-5.4-mini", "400K", "General", 1.71),
    m("free-minimax-m2.7", "200K", "Reasoning", 4.0),
    m("free-qwen3.5-plus", "256K", "Reasoning", 2.07),
  ],
  "yolo-auto": [m("qwen3.8-27b", "128K", "General", 4.69)],

  // -------------------------------------------------------------------------
  // Tested free gateways
  // -------------------------------------------------------------------------
  qzz: [
    m("deepseek-v4-flash", "1M", "Reasoning"),
    m("deepseek-v4-flash-0731", "1M", "Reasoning"),
    m("deepseek-v4-pro", "1M", "Reasoning"),
    m("deepseek-v4-pro-0813", "1M", "Reasoning"),
  ],
  ai121628: [m("deepseek-v4-flash-free", "1M", "Reasoning")],
  tokenrouter: [m("z-ai/glm-5.3-free", "128K", "General")],
  tokenharbor: [
    m("deepseek-v4.1-flash:free", "1M", "Reasoning"),
    m("deepseek-v4-flash:free", "1M", "Reasoning"),
    m("mimo-v2.5:free", "1M", "General"),
  ],
  nararouter: [m("laguna-s-2.1", "262K", "Code")],
  aihubmix: [
    m("coding-minimax-m3-free", undefined, "Code"),
    m("coding-glm-4.7-free", undefined, "Code"),
    m("gpt-5.5-free", undefined, "General"),
  ],
  fhrouter: [m("deepseek-v4-flash", undefined, "General"), m("grok-4.6", undefined, "Reasoning")],
  amdradeon: [m("DeepSeek-V4-Flash", "1M", "Reasoning")],
  wusrouter: [
    m("DeepSeek-R1-0528-Qwen3-8B", undefined, "Reasoning"),
    m("qwen3.8-27b", undefined, "General"),
  ],
  pollinations: [
    m("community/Catniti/deepseek-r1-free", undefined, "Reasoning"),
    m("community/AkshayCoder48/poolside-laguna-s-2.1:free", undefined, "Code"),
  ],
  modelscope: [
    m("deepseek-ai/DeepSeek-V3.1", undefined, "Reasoning"),
    m("deepseek-ai/DeepSeek-V3.2-Exp", undefined, "Reasoning"),
    m("deepseek-ai/DeepSeek-V4-Pro", undefined, "Reasoning"),
    m("deepseek-ai/DeepSeek-V4-Pro-0813", undefined, "Reasoning"),
  ],
};

/** Total number of curated free models across every provider. */
export const MODEL_CATALOG_SIZE = Object.values(MODELS_BY_PROVIDER).reduce(
  (total, models) => total + models.length,
  0,
);

/**
 * Look up the curated models for a provider.
 *
 * Duplicate rows for one model id are collapsed: the same model listed twice is
 * one model, and the first row is the curated one.
 */
export function modelsForProvider(providerId: string): ModelSpec[] {
  const models = MODELS_BY_PROVIDER[providerId] ?? [];
  if (models.length <= 1) return models;
  const seen = new Set<string>();
  return models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}
