/**
 * Provider dossiers.
 *
 * The catalog tells COKEY where a provider lives; a dossier tells a person
 * whether they want to depend on it. Two things matter and are almost never
 * written down in one place:
 *
 *   1. Who runs it and from where, because that decides the jurisdiction your
 *      prompts travel to.
 *   2. Whether the free tier is infrastructure or a novelty, because a $0.25
 *      weekly credit cap is not a fallback, it is a demo.
 *
 * `origin` is only filled in when the operator is publicly identifiable.
 * Everything else says `undisclosed` rather than guessing a country from a
 * domain name.
 */

export type ProviderKind = "lab" | "inference-cloud" | "aggregator" | "gateway" | "local";

export type ProviderVerdict =
  /** Dependable enough to be a chain's first entry. */
  | "recommended"
  /** Works, keep it as a fallback. */
  | "usable"
  /** Real, but rate-limited or credit-capped past the point of usefulness. */
  | "limited"
  /** Structural trap: re-exports, broken schemas, or unreachable. */
  | "avoid";

export interface ProviderDossier {
  /** Company, lab or project operating the endpoint. */
  operator: string;
  /** Country or region the operator is based in, when it is public. */
  origin: string;
  kind: ProviderKind;
  /** One or two sentences: what this actually is. */
  summary: string;
  verdict: ProviderVerdict;
  /** Why that verdict, in one line. */
  verdictReason: string;
  /** Public source for the operator/origin claim, when one exists. */
  sourceUrl?: string;
}

const DOSSIERS: Record<string, ProviderDossier> = {
  groq: {
    operator: "Groq, Inc.",
    origin: "United States",
    kind: "inference-cloud",
    summary:
      "Custom LPU silicon built for token throughput rather than general-purpose GPUs. Serves open-weight models with the lowest first-token latency on this list.",
    verdict: "recommended",
    verdictReason: "Highest usable daily volume with sub-300ms responses makes it the natural first entry.",
    sourceUrl: "https://groq.com/",
  },
  cloudflare: {
    operator: "Cloudflare, Inc.",
    origin: "United States",
    kind: "inference-cloud",
    summary:
      "Workers AI runs open models on Cloudflare's edge network, so requests terminate close to you. The free allowance is the largest per-day ceiling here.",
    verdict: "recommended",
    verdictReason: "Enormous request ceiling and near-zero network latency; the AI Gateway adds observability.",
    sourceUrl: "https://developers.cloudflare.com/workers-ai/",
  },
  cerebras: {
    operator: "Cerebras Systems",
    origin: "United States",
    kind: "inference-cloud",
    summary:
      "Wafer-scale chips serving open-weight models at very high token rates. Free tier is generous in throughput but strict on concurrency.",
    verdict: "usable",
    verdictReason: "Excellent speed, smaller daily allowance than Groq or Cloudflare.",
    sourceUrl: "https://www.cerebras.ai/",
  },
  nvidia: {
    operator: "NVIDIA Corporation",
    origin: "United States",
    kind: "inference-cloud",
    summary:
      "NIM hosts open-weight models on NVIDIA's own infrastructure. Limits are applied per model, so twelve models means twelve separate allowances.",
    verdict: "usable",
    verdictReason: "Wide model coverage and no token cap, but per-model RPM is modest.",
    sourceUrl: "https://build.nvidia.com/",
  },
  mistral: {
    operator: "Mistral AI",
    origin: "France",
    kind: "lab",
    summary:
      "European frontier lab. Its dedicated code family (Codestral, Devstral) is trained for completion and agentic editing rather than general chat.",
    verdict: "recommended",
    verdictReason: "Straight from the source, and the code models are purpose-built rather than re-tuned.",
    sourceUrl: "https://mistral.ai/",
  },
  cohere: {
    operator: "Cohere Inc.",
    origin: "Canada",
    kind: "lab",
    summary:
      "Enterprise-focused lab with a strong retrieval and tool-calling line. The free trial keys are metered and expire.",
    verdict: "usable",
    verdictReason: "Solid tool calling, but trial keys are time-boxed rather than self-replenishing.",
    sourceUrl: "https://cohere.com/",
  },
  gemini: {
    operator: "Google DeepMind",
    origin: "United States",
    kind: "lab",
    summary:
      "Google's frontier line. The flash tier is fast and cheap and carries a very large context window.",
    verdict: "usable",
    verdictReason: "Huge context helps on large repositories, though the free tier is not code-specialised.",
    sourceUrl: "https://ai.google.dev/",
  },
  zai: {
    operator: "Z.ai (formerly Zhipu AI)",
    origin: "China",
    kind: "lab",
    summary:
      "Chinese frontier lab behind the GLM family. Publishes open weights and runs an OpenAI-compatible endpoint.",
    verdict: "recommended",
    verdictReason: "GLM models code well and the open weights make the claims checkable.",
    sourceUrl: "https://en.wikipedia.org/wiki/Z.ai",
  },
  openrouter: {
    operator: "OpenRouter, Inc.",
    origin: "United States",
    kind: "aggregator",
    summary:
      "A router across many upstreams. Its `:free` catalogue is the reference list that most other 'free hubs' copy verbatim.",
    verdict: "usable",
    verdictReason: "Genuinely useful for breadth, but the free pool is shared and congested.",
    sourceUrl: "https://openrouter.ai/",
  },
  huggingface: {
    operator: "Hugging Face, Inc.",
    origin: "United States / France",
    kind: "aggregator",
    summary:
      "Inference Providers proxy dozens of backends behind one key. The free monthly credit is deliberately tiny.",
    verdict: "limited",
    verdictReason: "Widest model list here, but the credit cap is exhausted in a handful of calls.",
    sourceUrl: "https://huggingface.co/docs/inference-providers",
  },
  poolside: {
    operator: "Poolside",
    origin: "United States",
    kind: "lab",
    summary:
      "Lab training models specifically for agentic software engineering rather than general chat.",
    verdict: "recommended",
    verdictReason: "Best coding pedigree on this list when you do not need high volume.",
    sourceUrl: "https://poolside.ai/",
  },
  "opencode-zen": {
    operator: "OpenCode / SST",
    origin: "United States",
    kind: "gateway",
    summary:
      "A gateway curated for coding agents rather than general chat, with a long-context contributor tier.",
    verdict: "recommended",
    verdictReason: "Curated for exactly this workload, and the free contributor tier is real.",
    sourceUrl: "https://opencode.ai/",
  },
  ollama: {
    operator: "Ollama, Inc.",
    origin: "United States",
    kind: "local",
    summary:
      "Local model runner that also offers a hosted cloud tier. The local path costs nothing and leaks nothing.",
    verdict: "usable",
    verdictReason: "The local daemon is the honest unlimited option; the cloud tier resets weekly.",
    sourceUrl: "https://ollama.com/",
  },
  "sea-lion": {
    operator: "AI Singapore",
    origin: "Singapore",
    kind: "lab",
    summary:
      "A national open-source model family (Southeast Asian Languages in One Network) built for the region's languages.",
    verdict: "limited",
    verdictReason: "Genuinely open and well documented, but not a coding model.",
    sourceUrl: "https://sea-lion.ai/about/",
  },
  sealion: {
    operator: "AI Singapore",
    origin: "Singapore",
    kind: "lab",
    summary:
      "A national open-source model family (Southeast Asian Languages in One Network) built for the region's languages.",
    verdict: "limited",
    verdictReason: "Genuinely open and well documented, but not a coding model.",
    sourceUrl: "https://sea-lion.ai/about/",
  },
  internai: {
    operator: "Shanghai AI Laboratory",
    origin: "China",
    kind: "lab",
    summary:
      "The Intern series (Shusheng) from Shanghai AI Laboratory, released as open weights and served through its own hub.",
    verdict: "limited",
    verdictReason: "Strong models, but the endpoint is slow and the free allowance is opaque.",
    sourceUrl: "https://github.com/InternLM",
  },
  "intern-ai": {
    operator: "Shanghai AI Laboratory",
    origin: "China",
    kind: "lab",
    summary:
      "The Intern series (Shusheng) from Shanghai AI Laboratory, released as open weights and served through its own hub.",
    verdict: "limited",
    verdictReason: "Strong models, but the endpoint is slow and the free allowance is opaque.",
    sourceUrl: "https://github.com/InternLM",
  },
  kilo: {
    operator: "Kilo Code",
    origin: "United States",
    kind: "gateway",
    summary:
      "A coding-agent extension that also exposes an OpenAI-compatible gateway. Much of its free catalogue mirrors OpenRouter's.",
    verdict: "usable",
    verdictReason: "Convenient if you already use the extension, otherwise redundant with OpenRouter.",
  },
  requesty: {
    operator: "Requesty",
    origin: "Germany",
    kind: "aggregator",
    summary:
      "An observability-first router. Its free pool re-exports the same models as the other aggregators.",
    verdict: "usable",
    verdictReason: "Fine as a fallback; not a distinct source of models.",
  },
  voidai: {
    operator: "Void AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary:
      "A free hub advertising flagship coding models with a credit-based daily allowance.",
    verdict: "usable",
    verdictReason: "Good model coverage, but the operator is not publicly identified.",
  },
  xkiro: {
    operator: "xKiro AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary:
      "A free hub advertising a large daily token allowance across third-party model families.",
    verdict: "usable",
    verdictReason: "Useful batch capacity; treat the advertised volume as unverified until your dashboard agrees.",
  },
  llm7: {
    operator: "LLM7.IO",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A community free hub with a daily request and token allowance.",
    verdict: "usable",
    verdictReason: "Reasonable fallback volume, unclear operator.",
  },
  freeai: {
    operator: "Free.ai",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub fronting several open-weight models.",
    verdict: "limited",
    verdictReason: "Small allowances and no published operator.",
  },
  aion: {
    operator: "AION Labs",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub serving open-weight models with advertised daily token limits.",
    verdict: "limited",
    verdictReason: "Tight per-minute limits and an unverified operator.",
  },
  "aion-labs": {
    operator: "AION Labs",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub serving open-weight models with advertised daily token limits.",
    verdict: "limited",
    verdictReason: "Tight per-minute limits and an unverified operator.",
  },
  agnes: {
    operator: "Agnes AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub advertising a modest request-per-day allowance.",
    verdict: "limited",
    verdictReason: "Low ceiling compared with the major hubs.",
  },
  "agnes-ai": {
    operator: "Agnes AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub advertising a modest request-per-day allowance.",
    verdict: "limited",
    verdictReason: "Low ceiling compared with the major hubs.",
  },
  anyapi: {
    operator: "AnyAPI AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary:
      "A free hub whose model list closely mirrors OpenRouter's free pool rather than a distinct backend.",
    verdict: "limited",
    verdictReason: "Structurally a re-export, so it fails when OpenRouter's pool is congested.",
  },
  auriko: {
    operator: "Auriko",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub with a permanently-free model tier alongside a BYOK path.",
    verdict: "limited",
    verdictReason: "Small catalogue and no published operator.",
  },
  bazaarlink: {
    operator: "BazaarLink",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub advertising a very small request-per-day allowance.",
    verdict: "limited",
    verdictReason: "50 requests per day is a demo, not a pool.",
  },
  electronhub: {
    operator: "ElectronHub",
    origin: "undisclosed",
    kind: "aggregator",
    summary:
      "A free hub with a long model list but a weekly dollar credit cap rather than a request allowance.",
    verdict: "limited",
    verdictReason: "Impressive list, single-use budget: treat it as a novelty.",
  },
  evolvex: {
    operator: "EvolveX",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub that does not publish its quotas.",
    verdict: "limited",
    verdictReason: "Unspecified limits and no operator disclosure.",
  },
  fastrouter: {
    operator: "FastRouter",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A router with a per-model daily request allowance on its free tier.",
    verdict: "limited",
    verdictReason: "Ten requests per model per day is too thin to build on.",
  },
  freeinference: {
    operator: "FreeInference",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub gated behind manual account review.",
    verdict: "avoid",
    verdictReason: "Manual approval, tiny catalogue: the friction costs more than the access.",
  },
  gonka: {
    operator: "Gonka Broker",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A small broker reachable only after phone verification.",
    verdict: "avoid",
    verdictReason: "Phone verification for three models that are all available elsewhere.",
  },
  "gonka-broker": {
    operator: "Gonka Broker",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A small broker reachable only after phone verification.",
    verdict: "avoid",
    verdictReason: "Phone verification for three models that are all available elsewhere.",
  },
  helixmind: {
    operator: "HelixMind",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub with a mixed catalogue of open-weight models.",
    verdict: "limited",
    verdictReason: "No published operator and no verifiable quota source.",
  },
  llmkiwi: {
    operator: "LLM.Kiwi",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub that does not reliably honour structured output.",
    verdict: "avoid",
    verdictReason: "Schema failures break tool calling, which is the whole point of an agent.",
  },
  "llm-kiwi": {
    operator: "LLM.Kiwi",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub that does not reliably honour structured output.",
    verdict: "avoid",
    verdictReason: "Schema failures break tool calling, which is the whole point of an agent.",
  },
  literouter: {
    operator: "LiteRouter",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A light router that re-exports the common free catalogue.",
    verdict: "avoid",
    verdictReason: "Same structured-output problem as LLM.Kiwi, with no unique models.",
  },
  meganova: {
    operator: "MegaNova",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub inside the crowded re-export tier.",
    verdict: "limited",
    verdictReason: "Indistinguishable from the other re-exports; keep one, not five.",
  },
  mixlayer: {
    operator: "Mixlayer",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub serving open-weight models with tight limits.",
    verdict: "limited",
    verdictReason: "Small allowance, unverified operator.",
  },
  naga: {
    operator: "Naga AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub whose catalogue mirrors the OpenRouter free pool.",
    verdict: "limited",
    verdictReason: "Re-export tier: no independent capacity behind it.",
  },
  odirouter: {
    operator: "Odirouter",
    origin: "undisclosed",
    kind: "aggregator",
    summary:
      "A small router advertising free access to vendor models that the vendor does not wholesale to resellers.",
    verdict: "avoid",
    verdictReason: "If a reseller sells frontier weights for free, the name is almost certainly not the model.",
  },
  orcarouter: {
    operator: "Orcarouter",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub with an unspecified allowance.",
    verdict: "limited",
    verdictReason: "No published quotas, so capacity cannot be planned.",
  },
  poixe: {
    operator: "Poixe AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub advertising a very large daily request and token allowance.",
    verdict: "usable",
    verdictReason: "Worth keeping as volume, once your own dashboard confirms the numbers.",
  },
  pooled: {
    operator: "Pooled AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A small pooled-inference hub.",
    verdict: "limited",
    verdictReason: "Little public information and no published quotas.",
  },
  "pooled-ai": {
    operator: "Pooled AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A small pooled-inference hub.",
    verdict: "limited",
    verdictReason: "Little public information and no published quotas.",
  },
  routeway: {
    operator: "Routeway AI",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A router with two models, one of which answers with double-digit latency.",
    verdict: "avoid",
    verdictReason: "The same model is faster and freer on Groq or Cloudflare.",
  },
  tokenreply: {
    operator: "TokenReply",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub with a single-digit requests-per-day style cap and slow models.",
    verdict: "avoid",
    verdictReason: "Too thin and too slow to route real work through.",
  },
  yolo: {
    operator: "Yolo-Auto",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub offering one model at roughly fifteen requests per day.",
    verdict: "avoid",
    verdictReason: "One model, fifteen requests, better equivalents elsewhere.",
  },
  "yolo-auto": {
    operator: "Yolo-Auto",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub offering one model at roughly fifteen requests per day.",
    verdict: "avoid",
    verdictReason: "One model, fifteen requests, better equivalents elsewhere.",
  },
  zydit: {
    operator: "Zydit",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub advertising unlimited requests behind a low per-minute cap.",
    verdict: "limited",
    verdictReason: "Unlimited in name, rate-shaped in practice.",
  },
  zylo: {
    operator: "Zylo API",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "A free hub advertising a large daily request and token allowance.",
    verdict: "usable",
    verdictReason: "Decent volume on paper; verify the ceiling before you lean on it.",
  },
};

/** Dossier for a provider, or a neutral one for custom endpoints. */
export function providerDossier(providerId: string): ProviderDossier {
  const found = DOSSIERS[providerId];
  if (found) return found;

  if (providerId.startsWith("custom:")) {
    return {
      operator: "You",
      origin: "self-hosted",
      kind: "gateway",
      summary:
        "An endpoint you added yourself. COKEY validates it against the SSRF guard and treats it like any other provider.",
      verdict: "usable",
      verdictReason: "Your own endpoint: quotas and jurisdiction are whatever you configured.",
    };
  }

  return {
    operator: "Not publicly disclosed",
    origin: "undisclosed",
    kind: "aggregator",
    summary: "No dossier yet for this provider. Add one in the catalog when you learn who runs it.",
    verdict: "limited",
    verdictReason: "An undocumented operator cannot be recommended or ruled out.",
  };
}

export function providerDossiers(): Record<string, ProviderDossier> {
  return DOSSIERS;
}

/** Providers worth wiring up first, best first. */
export const PREFERRED_PROVIDERS = [
  "groq",
  "cloudflare",
  "opencode-zen",
  "poolside",
  "voidai",
  "mistral",
  "xkiro",
  "nvidia",
  "cerebras",
  "zai",
] as const;
