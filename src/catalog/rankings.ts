export interface RankingSource {
  label: string;
  url: string;
}

export type QuotaProvenance = "operator" | "third-party" | "unpublished";

export interface SkillTier {
  name: SkillEntry["tierName"];
  label: string;
  labelFr?: string;
  blurb: string;
  blurbFr?: string;
}

export interface SkillEntry {
  model: string;

  providerId?: string;
  tierName: "S" | "A" | "B" | "C";

  sweScore?: number;
  reason: string;
  reasonFr?: string;
}

export interface RateLimitEntry {
  providerId: string;
  provider: string;

  tier: 1 | 2 | 3 | 4;
  quota: string;
  provenance: QuotaProvenance;
  reliability: "solid" | "watch" | "avoid";
  note?: string;
  noteFr?: string;
}

export interface CombinedEntry {
  rank: number;
  providerId: string;
  model: string;
  why: string;
  whyFr?: string;
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
export const RANKING_DISCLAIMER_FR =
  "Les scores de benchmark évoluent chaque mois et les chiffres publiés par les éditeurs les flattent. Considérez ceci comme une présélection de départ, puis utilisez le bouton de test : le seul score qui compte est celui que votre propre clé reproduit.";

export const SKILL_TIERS: SkillTier[] = [
  {
    name: "S",
    label: "Purpose-built coding models",
    labelFr: "Modèles de codage conçus sur mesure",
    blurb: "Trained for agentic software engineering or a dedicated code family. Start here.",
    blurbFr:
      "Entraînés pour l'ingénierie logicielle agentique ou issus d'une famille dédiée au code. Commencez ici.",
  },
  {
    name: "A",
    label: "Strong generalists",
    labelFr: "Généralistes solides",
    blurb: "Not code-specialised, but they code well enough to be your first entry.",
    blurbFr: "Non spécialisés en code, mais ils codent assez bien pour être votre premier nœud.",
  },
  {
    name: "B",
    label: "Usable, mid-tier",
    labelFr: "Utilisables, milieu de gamme",
    blurb: "Fine as a fallback; large context sometimes beats specialisation.",
    blurbFr: "Corrects en secours ; un grand contexte l'emporte parfois sur la spécialisation.",
  },
  {
    name: "C",
    label: "Skip for coding",
    labelFr: "À éviter pour le code",
    blurb: "Roleplay, translation and vision fine-tunes. Wrong tool for writing code.",
    blurbFr:
      "Affinages pour le jeu de rôle, la traduction et la vision. Mauvais outil pour écrire du code.",
  },
];

export const SKILL_RANKING: SkillEntry[] = [
  {
    model: "Poolside laguna-s-2.1",
    providerId: "poolside",
    tierName: "S",
    sweScore: 62.4,
    reason: "Trained specifically for agentic software engineering.",
    reasonFr: "Entraîné spécifiquement pour l'ingénierie logicielle agentique.",
  },
  {
    model: "Poolside laguna-xs-2.1",
    providerId: "poolside",
    tierName: "S",
    sweScore: 48.1,
    reason: "Smaller sibling of the same purpose-built coding line.",
    reasonFr: "Petit frère de la même gamme de codage conçue sur mesure.",
  },
  {
    model: "gpt-5.3-codex",
    providerId: "voidai",
    tierName: "S",
    sweScore: 74.9,
    reason: "Codex-branded flagship exposed through Void AI.",
    reasonFr: "Modèle phare de marque Codex exposé via Void AI.",
  },
  {
    model: "Mistral codestral-latest",
    providerId: "mistral",
    tierName: "S",
    sweScore: 51.3,
    reason: "Mistral's dedicated completion model.",
    reasonFr: "Le modèle de complétion dédié de Mistral.",
  },
  {
    model: "Mistral devstral-latest",
    providerId: "mistral",
    tierName: "S",
    sweScore: 53.6,
    reason: "Dedicated agentic editing model from the same lab.",
    reasonFr: "Modèle d'édition agentique dédié du même laboratoire.",
  },
  {
    model: "Qwen3-Coder-480B-A35B",
    providerId: "huggingface",
    tierName: "S",
    sweScore: 67.0,
    reason: "Dedicated Qwen coder line, largest variant.",
    reasonFr: "Gamme de codage Qwen dédiée, plus grande variante.",
  },
  {
    model: "Qwen3-Coder-30B-A3B",
    providerId: "huggingface",
    tierName: "S",
    sweScore: 51.6,
    reason: "Mixture-of-experts coder with a small active footprint.",
    reasonFr: "Codeur à mélange d'experts avec une petite empreinte active.",
  },
  {
    model: "Kimi-K2.7-Code",
    providerId: "voidai",
    tierName: "S",
    sweScore: 65.8,
    reason: "Moonshot's dedicated code variant.",
    reasonFr: "La variante de code dédiée de Moonshot.",
  },
  {
    model: "muse-spark-1.3-contributor-free",
    providerId: "opencode-zen",
    tierName: "S",
    sweScore: 59.2,
    reason: "The whole gateway is curated for coding agents, not general chat.",
    reasonFr: "Toute la passerelle est organisée pour les agents de codage, pas le chat général.",
  },

  {
    model: "gpt-oss-120b",
    providerId: "groq",
    tierName: "A",
    sweScore: 41.7,
    reason: "Open-weight generalist that codes well and runs extremely fast on Groq.",
    reasonFr: "Généraliste à poids ouverts qui code bien et tourne extrêmement vite sur Groq.",
  },
  {
    model: "GLM-4.7",
    providerId: "zai",
    tierName: "A",
    sweScore: 49.8,
    reason: "Strong tool calling and long-context reasoning.",
    reasonFr: "Appel d'outils solide et raisonnement à long contexte.",
  },
  {
    model: "Qwen3.8-27B",
    providerId: "groq",
    tierName: "A",
    sweScore: 44.3,
    reason: "Code-tagged on Groq, good balance of speed and quality.",
    reasonFr: "Étiqueté code sur Groq, bon équilibre entre vitesse et qualité.",
  },
  {
    model: "Nemotron-3-Super-120B",
    providerId: "nvidia",
    tierName: "A",
    sweScore: 42.1,
    reason: "NVIDIA's open generalist, dependable on NIM.",
    reasonFr: "Le généraliste ouvert de NVIDIA, fiable sur NIM.",
  },
  {
    model: "Qwen2.5-Coder-32B",
    providerId: "cloudflare",
    tierName: "A",
    sweScore: 31.4,
    reason: "The classic open coder, served at the edge.",
    reasonFr: "Le codeur ouvert classique, servi en périphérie.",
  },

  {
    model: "gpt-oss-20b",
    providerId: "groq",
    tierName: "B",
    sweScore: 28.6,
    reason: "Fast and cheap; fine as a fallback entry.",
    reasonFr: "Rapide et bon marché ; correct comme nœud de secours.",
  },
  {
    model: "Ministral 14B",
    providerId: "mistral",
    tierName: "B",
    sweScore: 22.3,
    reason: "Small generalist, useful for classification-shaped work.",
    reasonFr: "Petit généraliste, utile pour un travail de type classification.",
  },
  {
    model: "Gemini 3.x flash",
    providerId: "gemini",
    tierName: "B",
    sweScore: 40.5,
    reason: "Huge context helps on big repositories, but it is not code-specialised.",
    reasonFr: "Un contexte immense aide sur les gros dépôts, mais ce n'est pas spécialisé en code.",
  },

  {
    model: "Sapphira-L3.3-70b",
    tierName: "C",
    sweScore: 8.2,
    reason: "Roleplay fine-tune.",
    reasonFr: "Affinage pour le jeu de rôle.",
  },
  {
    model: "Violet-Lotus-12B",
    tierName: "C",
    sweScore: 5.4,
    reason: "Roleplay fine-tune.",
    reasonFr: "Affinage pour le jeu de rôle.",
  },
  {
    model: "Euryale-v2.1",
    tierName: "C",
    sweScore: 6.1,
    reason: "Roleplay fine-tune.",
    reasonFr: "Affinage pour le jeu de rôle.",
  },
  {
    model: "MythoMax-L2-13B",
    tierName: "C",
    sweScore: 4.7,
    reason: "Roleplay fine-tune.",
    reasonFr: "Affinage pour le jeu de rôle.",
  },
  {
    model: "hermes-4-14b",
    tierName: "C",
    sweScore: 9.3,
    reason: "General chat tuning, not code.",
    reasonFr: "Réglage pour le chat général, pas le code.",
  },
  {
    model: "Riva (translate)",
    tierName: "C",
    reason: "Translation only.",
    reasonFr: "Traduction uniquement.",
  },
  {
    model: "Llama 3.2 1B / 3B",
    tierName: "C",
    reason: "Too small to hold a codebase in context.",
    reasonFr: "Trop petit pour tenir une base de code en contexte.",
  },
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
    noteFr:
      "Les chiffres de requêtes et de jetons de Cloudflare sont en interne incohérents ; confirmez les deux sur votre tableau de bord avant de vous fier au plafond.",
  },
  {
    providerId: "groq",
    provider: "Groq",
    tier: 1,
    quota: "14,400 requests/day, 30 requests/min, sub-300ms",
    provenance: "operator",
    reliability: "solid",
    note: "The best latency here by a wide margin.",
    noteFr: "La meilleure latence ici, de loin.",
  },
  {
    providerId: "poixe",
    provider: "Poixe AI",
    tier: 1,
    quota: "10,000 requests/day, 10M tokens/day",
    provenance: "third-party",
    reliability: "watch",
    note: "Large advertised volume, unverified operator.",
    noteFr: "Grand volume annoncé, opérateur non vérifié.",
  },
  {
    providerId: "internai",
    provider: "Intern AI",
    tier: 1,
    quota: "~90M tokens/month, ~3M tokens/day, 30 requests/min",
    provenance: "third-party",
    reliability: "watch",
    note: "Generous on paper; measured latency is high.",
    noteFr: "Généreux sur le papier ; la latence mesurée est élevée.",
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
    noteFr:
      "Faible volume, compétence la plus élevée : idéal comme premier nœud pour le travail difficile, pas pour le volume.",
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
    noteFr: "Très largement le même pool gratuit sous-jacent re-exporté.",
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
    noteFr:
      "Immenses listes de modèles, budget à usage unique. Des curiosités, pas une infrastructure.",
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
    noteFr: "Généreux dans la fenêtre, puis ça s'arrête. Le démon local n'a aucune limite du tout.",
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
    whyFr:
      "Volume de niveau 1, latence sous 300 ms et une étiquette code explicite. Le pilote quotidien.",
  },
  {
    rank: 2,
    providerId: "cloudflare",
    model: "@cf/qwen/qwen2.5-coder-32b-instruct or @cf/openai/gpt-oss-120b",
    tier: 1,
    why: "The largest ceiling on the list with edge latency. Confirms the quota on its own dashboard.",
    whyFr:
      "Le plus grand plafond de la liste avec une latence de périphérie. Confirmez le quota sur son propre tableau de bord.",
  },
  {
    rank: 3,
    providerId: "opencode-zen",
    model: "muse-spark-1.3-contributor-free",
    tier: 2,
    why: "Actually curated for coding agents, 1M context, and a real contributor tier.",
    whyFr:
      "Réellement organisé pour les agents de codage, 1M de contexte, et un vrai palier contributeur.",
  },
  {
    rank: 4,
    providerId: "poolside",
    model: "laguna-s-2.1",
    tier: 2,
    why: "Best coding pedigree if you do not need volume.",
    whyFr: "Meilleur pedigree de codage si vous n'avez pas besoin de volume.",
  },
  {
    rank: 5,
    providerId: "voidai",
    model: "gpt-5.3-codex / deepseek-v4-pro / kimi-k2.7-code",
    tier: 2,
    why: "Flagship coding models with decent throughput.",
    whyFr: "Modèles de codage phares avec un débit correct.",
  },
  {
    rank: 6,
    providerId: "mistral",
    model: "codestral-latest / devstral-latest",
    tier: 3,
    why: "Dedicated code family straight from the source.",
    whyFr: "Famille de code dédiée directement de la source.",
  },
  {
    rank: 7,
    providerId: "xkiro",
    model: "mistralai/codestral-2508",
    tier: 1,
    why: "Large daily token allowance: good for batch work.",
    whyFr: "Grand quota quotidien de jetons : bon pour le travail par lots.",
  },
  {
    rank: 8,
    providerId: "nvidia",
    model: "poolside/laguna-xs-2.1 or nemotron-3-super-120b-a12b",
    tier: 2,
    why: "Solid backup pool with per-model limits.",
    whyFr: "Pool de secours solide avec des limites par modèle.",
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
    alsoOn: ["helixmind", "gonka", "huggingface", "literouter", "orcarouter"],
    keep: "voidai",
    fallback: "helixmind",
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

export const DROP_LIST: Array<{ provider: string; reason: string; reasonFr?: string }> = [
  {
    provider: "LLM.Kiwi and LiteRouter",
    reason:
      "Both fail structured output, which breaks tool calling for coding agents. Fine for casual chat only.",
    reasonFr:
      "Les deux échouent sur la sortie structurée, ce qui casse l'appel d'outils pour les agents de codage. Correct pour du chat occasionnel seulement.",
  },
  {
    provider: "TokenReply",
    reason:
      "A single-digit request-per-minute cap plus 10 to 22 second latency. Too thin and too slow.",
    reasonFr:
      "Un plafond de requêtes par minute à un seul chiffre plus une latence de 10 à 22 secondes. Trop peu et trop lent.",
  },
  {
    provider: "Routeway AI",
    reason:
      "Two models, one around 11 seconds of latency, and the same models are better served by Groq or Cloudflare.",
    reasonFr:
      "Deux modèles, l'un avec environ 11 secondes de latence, et les mêmes modèles sont mieux servis par Groq ou Cloudflare.",
  },
  {
    provider: "Odirouter",
    reason:
      "Advertises free access to vendor models that vendors do not wholesale to resellers. Whoever answers is almost certainly not that model.",
    reasonFr:
      "Annonce un accès gratuit à des modèles d'éditeurs que les éditeurs ne revendent pas en gros à des revendeurs. Ce qui répond n'est presque certainement pas ce modèle.",
  },
  {
    provider: "Gonka Broker",
    reason:
      "Phone verification for three models that are all available elsewhere without friction.",
    reasonFr:
      "Vérification par téléphone pour trois modèles tous disponibles ailleurs sans friction.",
  },
  {
    provider: "FreeInference",
    reason: "Manual account review for three models.",
    reasonFr: "Vérification manuelle du compte pour trois modèles.",
  },
  {
    provider: "ElectronHub and Hugging Face",
    reason:
      "$0.25/week and $0.10/month caps mean a handful of calls. Occasional novelties, not infrastructure.",
    reasonFr:
      "Des plafonds de 0,25 $/semaine et 0,10 $/mois ne permettent qu'une poignée d'appels. Des curiosités occasionnelles, pas une infrastructure.",
  },
  {
    provider: "Yolo-Auto",
    reason: "One model, about fifteen requests per day, with better equivalents elsewhere.",
    reasonFr:
      "Un modèle, environ quinze requêtes par jour, avec de meilleurs équivalents ailleurs.",
  },
];

export const RANKING_BOTTOM_LINE =
  "Groq and Cloudflare cover daily high-volume coding. OpenCode Zen or Poolside cover needing a coding specialist. xKiro, Void AI and Mistral direct are the deep fallbacks. Everything else on the list is either a re-export of those same models or too rate-limited to build around, so six or seven providers is the practical ceiling.";
export const RANKING_BOTTOM_LINE_FR =
  "Groq et Cloudflare couvrent le codage quotidien à fort volume. OpenCode Zen ou Poolside couvrent le besoin d'un spécialiste du code. xKiro, Void AI et Mistral en direct sont les recours de secours profonds. Tout le reste de la liste est soit une re-exportation de ces mêmes modèles, soit trop limité en débit pour s'y appuyer, donc six ou sept fournisseurs constituent le plafond pratique.";

export const FUN_FACTS: string[] = [
  "Did you know COKEY was built with the help of COKEY? The gateway spent part of its own development pooling free keys for the assistant that wrote it.",
  "A provider rate limit is almost always per key *and* per IP. That is the entire reason the automatic egress pool exists.",
  "COKEY never guesses a quota. If a provider does not publish rate-limit headers, the dashboard says 'Quota: Unknown' rather than making a number up.",
  "The routing invariant fits in five words: node, then key, then node. A lower-priority node never gets a turn while a higher one still has an unused key.",
  "Every secret on disk is AES-256-GCM encrypted, prefixed with a format version, so a future COKEY can change the scheme without breaking old data.",
  "COKEY's own name is a pun: pool your keys, COKEY. The two leaves on the logo are the 'broke princess' sprout the tagline promises.",
  "Redirects are never followed on a custom endpoint. That one rule alone stops an upstream from ever bouncing your Authorization header to a different origin.",
  "The live route panel is fed by the same server-sent-events stream a CLI could subscribe to directly - the dashboard has no private channel the API does not.",
  "A chain's node order is the only thing that decides fallback. COKEY does not silently reorder your nodes to 'optimize' anything.",
  "Some providers count a single verification call against the same daily quota as real traffic. Testing ten keys back-to-back can look, to them, like ten real requests.",
];

export const FUN_FACTS_FR: string[] = [
  "Saviez-vous que COKEY a été construit avec l'aide de COKEY ? La passerelle a passé une partie de son propre développement à mutualiser des clés gratuites pour l'assistant qui l'a écrite.",
  "Une limite de débit de fournisseur est presque toujours par clé *et* par IP. C'est la seule raison d'être du pool d'égress automatique.",
  "COKEY ne devine jamais un quota. Si un fournisseur ne publie pas d'en-têtes de limite de débit, le tableau de bord affiche « Quota : Inconnu » plutôt que d'inventer un chiffre.",
  "L'invariant de routage tient en quelques mots : nœud, puis clé, puis nœud. Un nœud de priorité inférieure n'a jamais son tour tant qu'un nœud supérieur a encore une clé inutilisée.",
  "Chaque secret sur le disque est chiffré en AES-256-GCM, préfixé d'une version de format, pour qu'un futur COKEY puisse changer de schéma sans casser les anciennes données.",
  "Le nom même de COKEY est un jeu de mots : mutualisez vos clés (pool your keys), COKEY. Les deux feuilles du logo sont la pousse de « princesse fauchée » que promet le slogan.",
  "Les redirections ne sont jamais suivies sur un point de terminaison personnalisé. Cette seule règle empêche un service en amont de jamais faire rebondir votre en-tête Authorization vers une autre origine.",
  "Le panneau de route en direct est alimenté par le même flux d'événements envoyés par le serveur qu'une CLI pourrait suivre directement - le tableau de bord n'a aucun canal privé que l'API n'a pas.",
  "L'ordre des nœuds d'une chaîne est la seule chose qui décide du repli. COKEY ne réordonne jamais silencieusement vos nœuds pour « optimiser » quoi que ce soit.",
  "Certains fournisseurs comptent un simple appel de vérification dans le même quota quotidien que le trafic réel. Tester dix clés à la suite peut ressembler, pour eux, à dix vraies requêtes.",
];

export interface RankingsView {
  tiers: SkillTier[];
  skill: SkillEntry[];
  rateLimit: RateLimitEntry[];
  combined: CombinedEntry[];
  redundancy: RedundancyEntry[];
  dropList: Array<{ provider: string; reason: string; reasonFr?: string }>;
  bottomLine: string;
  bottomLineFr?: string;
  disclaimer: string;
  disclaimerFr?: string;
  sources: RankingSource[];

  source: "remote" | "compiled";

  fetchedAt?: string;

  funFacts?: string[];

  funFactsFr?: string[];
}

export function compiledRankingsView(): RankingsView {
  return {
    tiers: SKILL_TIERS,
    skill: SKILL_RANKING,
    rateLimit: RATE_LIMIT_RANKING,
    combined: COMBINED_RANKING,
    redundancy: REDUNDANCY_TABLE,
    dropList: DROP_LIST,
    bottomLine: RANKING_BOTTOM_LINE,
    bottomLineFr: RANKING_BOTTOM_LINE_FR,
    disclaimer: RANKING_DISCLAIMER,
    disclaimerFr: RANKING_DISCLAIMER_FR,
    sources: RANKING_SOURCES,
    source: "compiled",
    funFacts: FUN_FACTS,
    funFactsFr: FUN_FACTS_FR,
  };
}
