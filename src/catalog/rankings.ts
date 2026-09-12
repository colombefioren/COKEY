/**
 * Ranking data.
 *
 * Three boards answer three different questions, because "best model" and "best
 * model you can actually call ten thousand times today" are not the same model:
 *
 *   - `skill`    how well a model codes, benchmark first and limits ignored;
 *   - `rateLimit` how much throughput a provider will give away, skill ignored;
 *   - `combined` the shortlist that is both good enough and big enough.
 *
 * Every quota figure below is the operator's own published number, not a
 * measurement. COKEY does not infer limits from traffic: it reports what the
 * provider says and marks the rest `unverified`. Where a number came from a
 * third party rather than the provider's own page, it is flagged so you can
 * check the dashboard before you build on it.
 */

export interface RankingSource {
  label: string;
  url: string;
}

/** Where a quota number came from. */
export type QuotaProvenance =
  /** Published by the operator on its own site. */
  | "operator"
  /** Third-party or community reported; verify it yourself. */
  | "third-party"
  /** Operator publishes nothing; treat the free tier as unknown. */
  | "unpublished";

export interface SkillEntry {
  model: string;
  /** Provider id in this catalog, when the model is reachable through it. */
  providerId?: string;
  tierName: "S" | "A" | "B" | "C";
  /** SWE-bench Verified pass rate, as a percentage. Omitted when unpublished. */
  sweScore?: number;
  reason: string;
}

export interface RateLimitEntry {
  providerId: string;
  provider: string;
  /** 1 is the highest volume band, 4 the lowest. */
  tier: 1 | 2 | 3 | 4;
  quota: string;
  provenance: QuotaProvenance;
  reliability: "solid" | "watch" | "avoid";
  note?: string;
}

export interface CombinedEntry {
  rank: number;
  providerId: string;
  model: string;
  why: string;
  tier: RateLimitEntry["tier"];
}

export interface RedundancyEntry {
  family: string;
  alsoOn: string[];
  keep: string;
  fallback: string;
}

export const RANKING_SOURCES: RankingSource[] = [
  { label: "SWE-bench official leaderboards", url: "https://www.swebench.com/" },
  {
    label: "SWE-bench Verified leaderboard (LLM-Stats)",
    url: "https://llm-stats.com/benchmarks/swe-bench-verified",
  },
  {
    label: "SWE-bench Pro leaderboard 2026 (BenchLM)",
    url: "https://benchlm.ai/benchmarks/swe-bench-pro",
  },
  { label: "Groq pricing and rate limits", url: "https://console.groq.com/docs/rate-limits" },
  {
    label: "Cloudflare Workers AI limits",
    url: "https://developers.cloudflare.com/workers-ai/platform/limits/",
  },
  { label: "NVIDIA NIM (build.nvidia.com)", url: "https://build.nvidia.com/" },
  { label: "Mistral AI platform", url: "https://docs.mistral.ai/deployment/laplateforme/tier/" },
];

export const RANKING_DISCLAIMER =
  "Benchmark scores move every month and vendor-run numbers flatter the vendor. Treat this as a starting shortlist, then use the play button: the only score that matters is the one your own key reproduces.";

export const SKILL_TIERS: Array<{ name: SkillEntry["tierName"]; label: string; blurb: string }> = [
  {
    name: "S",
    label: "Purpose-built coding models",
    blurb: "Trained for agentic software engineering or a dedicated code family. Start here.",
  },
  {
    name: "A",
    label: "Strong generalists",
    blurb: "Not code-specialised, but they code well enough to be your first entry.",
  },
  {
    name: "B",
    label: "Usable, mid-tier",
    blurb: "Fine as a fallback; large context sometimes beats specialisation.",
  },
  {
    name: "C",
    label: "Skip for coding",
    blurb: "Roleplay, translation and vision fine-tunes. Wrong tool for writing code.",
  },
];

export const SKILL_RANKING: SkillEntry[] = [
  // ---- Tier S -------------------------------------------------------------
  {
    model: "Poolside laguna-s-2.1",
    providerId: "poolside",
    tierName: "S",
    sweScore: 62.4,
    reason: "Trained specifically for agentic software engineering.",
  },
  {
    model: "Poolside laguna-xs-2.1",
    providerId: "poolside",
    tierName: "S",
    sweScore: 48.1,
    reason: "Smaller sibling of the same purpose-built coding line.",
  },
  {
    model: "gpt-5.3-codex",
    providerId: "voidai",
    tierName: "S",
    sweScore: 74.9,
    reason: "Codex-branded flagship exposed through Void AI.",
  },
  {
    model: "Mistral codestral-latest",
    providerId: "mistral",
    tierName: "S",
    sweScore: 51.3,
    reason: "Mistral's dedicated completion model.",
  },
  {
    model: "Mistral devstral-latest",
    providerId: "mistral",
    tierName: "S",
    sweScore: 53.6,
    reason: "Dedicated agentic editing model from the same lab.",
  },
  {
    model: "Qwen3-Coder-480B-A35B",
    providerId: "huggingface",
    tierName: "S",
    sweScore: 67.0,
    reason: "Dedicated Qwen coder line, largest variant.",
  },
  {
    model: "Qwen3-Coder-30B-A3B",
    providerId: "huggingface",
    tierName: "S",
    sweScore: 51.6,
    reason: "Mixture-of-experts coder with a small active footprint.",
  },
  {
    model: "Kimi-K2.7-Code",
    providerId: "voidai",
    tierName: "S",
    sweScore: 65.8,
    reason: "Moonshot's dedicated code variant.",
  },
  {
    model: "muse-spark-1.3-contributor-free",
    providerId: "opencode-zen",
    tierName: "S",
    sweScore: 59.2,
    reason: "The whole gateway is curated for coding agents, not general chat.",
  },
  {
    model: "DeepSeek-V4-Pro",
    providerId: "xkiro",
    tierName: "S",
    sweScore: 71.6,
    reason: "DeepSeek's line has led open-weight code benchmarks.",
  },
  {
    model: "DeepSeek-V3.2",
    providerId: "xkiro",
    tierName: "S",
    sweScore: 61.9,
    reason: "Widely reproduced open-weight coding baseline.",
  },

  // ---- Tier A -------------------------------------------------------------
  {
    model: "gpt-oss-120b",
    providerId: "groq",
    tierName: "A",
    sweScore: 41.7,
    reason: "Open-weight generalist that codes well and runs extremely fast on Groq.",
  },
  {
    model: "GLM-5.2",
    providerId: "zai",
    tierName: "A",
    sweScore: 55.4,
    reason: "Strong tool calling and long-context reasoning.",
  },
  {
    model: "GLM-4.7",
    providerId: "zai",
    tierName: "A",
    sweScore: 49.8,
    reason: "Previous GLM generation, still a solid generalist.",
  },
  {
    model: "Qwen3.8-27B",
    providerId: "groq",
    tierName: "A",
    sweScore: 44.3,
    reason: "Code-tagged on Groq, good balance of speed and quality.",
  },
  {
    model: "Nemotron-3-Super-120B",
    providerId: "nvidia",
    tierName: "A",
    sweScore: 42.1,
    reason: "NVIDIA's open generalist, dependable on NIM.",
  },
  {
    model: "MiniMax-M2.7",
    providerId: "zylo",
    tierName: "A",
    sweScore: 50.2,
    reason: "Strong agentic behaviour for its size.",
  },
  {
    model: "command-a-plus",
    providerId: "cohere",
    tierName: "A",
    sweScore: 38.9,
    reason: "Enterprise tool-calling focus.",
  },
  {
    model: "Qwen2.5-Coder-32B",
    providerId: "cloudflare",
    tierName: "A",
    sweScore: 31.4,
    reason: "The classic open coder, served at the edge.",
  },

  // ---- Tier B -------------------------------------------------------------
  {
    model: "gpt-oss-20b",
    providerId: "groq",
    tierName: "B",
    sweScore: 28.6,
    reason: "Fast and cheap; fine as a fallback entry.",
  },
  {
    model: "Ministral 14B",
    providerId: "mistral",
    tierName: "B",
    sweScore: 22.3,
    reason: "Small generalist, useful for classification-shaped work.",
  },
  {
    model: "Gemini 3.x flash",
    providerId: "gemini",
    tierName: "B",
    sweScore: 40.5,
    reason: "Huge context helps on big repositories, but it is not code-specialised.",
  },
  {
    model: "Llama-4-Scout",
    providerId: "groq",
    tierName: "B",
    sweScore: 24.7,
    reason: "Broad model, mid-tier at code.",
  },
  {
    model: "Intern s2-preview",
    providerId: "internai",
    tierName: "B",
    sweScore: 35.8,
    reason: "Strong output, slow enough that it hurts as a first entry.",
  },

  // ---- Tier C -------------------------------------------------------------
  { model: "Sapphira-L3.3-70b", tierName: "C", sweScore: 8.2, reason: "Roleplay fine-tune." },
  { model: "Violet-Lotus-12B", tierName: "C", sweScore: 5.4, reason: "Roleplay fine-tune." },
  { model: "Euryale-v2.1", tierName: "C", sweScore: 6.1, reason: "Roleplay fine-tune." },
  { model: "MythoMax-L2-13B", tierName: "C", sweScore: 4.7, reason: "Roleplay fine-tune." },
  { model: "hermes-4-14b", tierName: "C", sweScore: 9.3, reason: "General chat tuning, not code." },
  { model: "Riva (translate)", tierName: "C", reason: "Translation only." },
  { model: "Llama 3.2 1B / 3B", tierName: "C", reason: "Too small to hold a codebase in context." },
];

export const RATE_LIMIT_RANKING: RateLimitEntry[] = [
  {
    providerId: "cloudflare",
    provider: "Cloudflare Workers AI",
    tier: 1,
    quota: "100,000 requests/day, up to ~1,500 requests/min",
    provenance: "operator",
    reliability: "solid",
    note: "Cloudflare's own request and token figures are internally inconsistent; confirm both on your dashboard before relying on the ceiling.",
  },
  {
    providerId: "groq",
    provider: "Groq",
    tier: 1,
    quota: "14,400 requests/day, 30 requests/min, sub-300ms",
    provenance: "operator",
    reliability: "solid",
    note: "The best latency here by a wide margin.",
  },
  {
    providerId: "poixe",
    provider: "Poixe AI",
    tier: 1,
    quota: "10,000 requests/day, 10M tokens/day",
    provenance: "third-party",
    reliability: "watch",
    note: "Large advertised volume, unverified operator.",
  },
  {
    providerId: "internai",
    provider: "Intern AI",
    tier: 1,
    quota: "~90M tokens/month, ~3M tokens/day, 30 requests/min",
    provenance: "third-party",
    reliability: "watch",
    note: "Generous on paper; measured latency is high.",
  },
  {
    providerId: "xkiro",
    provider: "xKiro AI",
    tier: 1,
    quota: "5M tokens/day",
    provenance: "third-party",
    reliability: "watch",
  },
  {
    providerId: "zylo",
    provider: "Zylo API",
    tier: 1,
    quota: "7,200 requests/day, 200K tokens/day",
    provenance: "third-party",
    reliability: "watch",
  },

  {
    providerId: "voidai",
    provider: "Void AI",
    tier: 2,
    quota: "100 requests/min, 125K daily credits",
    provenance: "third-party",
    reliability: "watch",
  },
  {
    providerId: "llm7",
    provider: "LLM7.IO",
    tier: 2,
    quota: "2,400 requests/day, 1M tokens/day",
    provenance: "third-party",
    reliability: "watch",
  },
  {
    providerId: "poolside",
    provider: "Poolside",
    tier: 2,
    quota: "200 requests/day, 1M tokens/day",
    provenance: "operator",
    reliability: "solid",
    note: "Low volume, highest skill: ideal as a first entry for hard work, not for bulk.",
  },
  {
    providerId: "nvidia",
    provider: "NVIDIA NIM",
    tier: 2,
    quota: "40 requests/min per model across many models, no published token cap",
    provenance: "operator",
    reliability: "solid",
  },
  {
    providerId: "meganova",
    provider: "MegaNova / AnyAPI / Kilo / Requesty / Zydit / Free.ai",
    tier: 2,
    quota: "roughly 200 to 1,000 requests/day each",
    provenance: "third-party",
    reliability: "watch",
    note: "Largely the same underlying free pool re-exported.",
  },

  {
    providerId: "agnes",
    provider:
      "Agnes, AION, BazaarLink, Naga, HelixMind, Mistral, OpenRouter, Cohere, SEA-LION, Mixlayer, Odirouter, Routeway",
    tier: 3,
    quota: "tight per-minute and per-day limits, several with reliability caveats",
    provenance: "unpublished",
    reliability: "watch",
  },
  {
    providerId: "electronhub",
    provider: "ElectronHub, Hugging Face",
    tier: 3,
    quota: "$0.25/week and $0.10/month in credits",
    provenance: "operator",
    reliability: "avoid",
    note: "Huge model lists, single-use budget. Novelties, not infrastructure.",
  },
  {
    providerId: "tokenreply",
    provider: "TokenReply, Yolo-Auto, FastRouter",
    tier: 3,
    quota: "roughly 3 to 15 requests/day",
    provenance: "third-party",
    reliability: "avoid",
  },

  {
    providerId: "ollama",
    provider: "Ollama Cloud",
    tier: 4,
    quota: "A five-hour session per week that resets weekly",
    provenance: "operator",
    reliability: "solid",
    note: "Generous inside the window, then it stops. The local daemon has no limit at all.",
  },
  {
    providerId: "evolvex",
    provider: "EvolveX, Orcarouter",
    tier: 4,
    quota: "not published",
    provenance: "unpublished",
    reliability: "watch",
  },
];

export const COMBINED_RANKING: CombinedEntry[] = [
  {
    rank: 1,
    providerId: "groq",
    model: "qwen/qwen3.8-27b or openai/gpt-oss-120b",
    tier: 1,
    why: "Tier-1 volume, sub-300ms latency and an explicit code tag. The daily driver.",
  },
  {
    rank: 2,
    providerId: "cloudflare",
    model: "@cf/qwen/qwen2.5-coder-32b-instruct or @cf/openai/gpt-oss-120b",
    tier: 1,
    why: "The largest ceiling on the list with edge latency. Confirms the quota on its own dashboard.",
  },
  {
    rank: 3,
    providerId: "opencode-zen",
    model: "muse-spark-1.3-contributor-free",
    tier: 2,
    why: "Actually curated for coding agents, 1M context, and a real contributor tier.",
  },
  {
    rank: 4,
    providerId: "poolside",
    model: "laguna-s-2.1",
    tier: 2,
    why: "Best coding pedigree if you do not need volume.",
  },
  {
    rank: 5,
    providerId: "voidai",
    model: "gpt-5.3-codex / deepseek-v4-pro / kimi-k2.7-code",
    tier: 2,
    why: "Flagship coding models with decent throughput.",
  },
  {
    rank: 6,
    providerId: "mistral",
    model: "codestral-latest / devstral-latest",
    tier: 3,
    why: "Dedicated code family straight from the source.",
  },
  {
    rank: 7,
    providerId: "xkiro",
    model: "mistralai/codestral-2508 or deepseek/deepseek-v4-pro",
    tier: 1,
    why: "Large daily token allowance: good for batch work.",
  },
  {
    rank: 8,
    providerId: "nvidia",
    model: "poolside/laguna-xs-2.1 or nemotron-3-super-120b-a12b",
    tier: 2,
    why: "Solid backup pool with per-model limits.",
  },
];

export const REDUNDANCY_TABLE: RedundancyEntry[] = [
  {
    family: "gpt-oss-120b",
    alsoOn: [
      "cloudflare",
      "huggingface",
      "electronhub",
      "fastrouter",
      "poixe",
      "tokenreply",
      "voidai",
      "ollama",
      "literouter",
    ],
    keep: "groq",
    fallback: "cloudflare",
  },
  {
    family: "gpt-oss-20b",
    alsoOn: [
      "cloudflare",
      "helixmind",
      "evolvex",
      "poixe",
      "zylo",
      "nvidia",
      "fastrouter",
      "literouter",
      "tokenreply",
      "ollama",
    ],
    keep: "groq",
    fallback: "zylo",
  },
  {
    family: "qwen3.8-27b",
    alsoOn: ["cloudflare", "orcarouter", "yolo", "voidai", "literouter"],
    keep: "groq",
    fallback: "orcarouter",
  },
  {
    family: "DeepSeek V4 Pro / Flash",
    alsoOn: ["helixmind", "gonka", "voidai", "huggingface", "literouter", "orcarouter"],
    keep: "xkiro",
    fallback: "voidai",
  },
  {
    family: "Poolside laguna-s / xs-2.1",
    alsoOn: ["openrouter", "kilo", "nvidia", "opencode-zen", "literouter", "tokenreply", "evolvex"],
    keep: "poolside",
    fallback: "opencode-zen",
  },
  {
    family: "codestral-latest / 2508",
    alsoOn: ["electronhub", "llm7", "xkiro"],
    keep: "mistral",
    fallback: "xkiro",
  },
  {
    family: "nemotron-3-super-120b",
    alsoOn: [
      "cloudflare",
      "openrouter",
      "kilo",
      "requesty",
      "evolvex",
      "tokenreply",
      "anyapi",
      "ollama",
    ],
    keep: "nvidia",
    fallback: "cloudflare",
  },
  {
    family: "OpenRouter free-pool clones",
    alsoOn: ["kilo", "openrouter", "anyapi", "naga", "requesty", "tokenreply"],
    keep: "anyapi or kilo",
    fallback: "requesty",
  },
  {
    family: "qwen plus / flash :free",
    alsoOn: ["voidai", "poixe"],
    keep: "xkiro",
    fallback: "voidai",
  },
];

export const DROP_LIST: Array<{ provider: string; reason: string }> = [
  {
    provider: "LLM.Kiwi and LiteRouter",
    reason:
      "Both fail structured output, which breaks tool calling for coding agents. Fine for casual chat only.",
  },
  {
    provider: "TokenReply",
    reason:
      "A single-digit request-per-minute cap plus 10 to 22 second latency. Too thin and too slow.",
  },
  {
    provider: "Routeway AI",
    reason:
      "Two models, one around 11 seconds of latency, and the same models are better served by Groq or Cloudflare.",
  },
  {
    provider: "Odirouter",
    reason:
      "Advertises free access to vendor models that vendors do not wholesale to resellers. Whoever answers is almost certainly not that model.",
  },
  {
    provider: "Gonka Broker",
    reason:
      "Phone verification for three models that are all available elsewhere without friction.",
  },
  { provider: "FreeInference", reason: "Manual account review for three models." },
  {
    provider: "ElectronHub and Hugging Face",
    reason:
      "$0.25/week and $0.10/month caps mean a handful of calls. Occasional novelties, not infrastructure.",
  },
  {
    provider: "Yolo-Auto",
    reason: "One model, about fifteen requests per day, with better equivalents elsewhere.",
  },
];

/** The bottom line, in one paragraph. */
export const RANKING_BOTTOM_LINE =
  "Groq and Cloudflare cover daily high-volume coding. OpenCode Zen or Poolside cover needing a coding specialist. xKiro, Void AI and Mistral direct are the deep fallbacks. Everything else on the list is either a re-export of those same models or too rate-limited to build around, so six or seven providers is the practical ceiling.";
