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
  /** Confirmed by direct hands-on use rather than the vendor's own published number. */
  fieldTested?: boolean;
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
  note?: string;
  noteFr?: string;
}

/** When the boards were last hand-verified, and how. */
export interface RankingsMeta {
  lastResearched: string;
  methodology: string;
  methodologyFr?: string;
}

/** A provider that's usable but comes with a caveat worth reading before you rely on it. */
export interface WorthTryingEntry {
  provider: string;
  note: string;
  noteFr?: string;
}

export const RANKINGS_META: RankingsMeta = {
  lastResearched: "2026-09-15",
  methodology:
    'Every provider marked provenance:"operator" below was checked against that vendor\'s own docs, pricing page, or community forum as of this date. Entries marked provenance:"third-party" or "unpublished" could not be independently confirmed and are flagged watch/avoid accordingly. Field notes (marked fieldTested) come from direct hands-on use, not vendor marketing, and are weighted above the advertised numbers wherever the two disagree.',
  methodologyFr:
    'Chaque fournisseur marqué provenance:"operator" ci-dessous a été vérifié par rapport à la documentation, la page de tarification ou le forum communautaire de ce fournisseur à cette date. Les entrées marquées provenance:"third-party" ou "unpublished" n\'ont pas pu être confirmées de manière indépendante et sont signalées watch/avoid en conséquence. Les notes de terrain (marquées fieldTested) proviennent d\'un usage direct, pas du marketing du fournisseur, et priment sur les chiffres annoncés lorsque les deux divergent.',
};

export const RANKING_SOURCES: RankingSource[] = [
  { label: "SWE-bench official leaderboards", url: "https://www.swebench.com/" },
  {
    label: "SWE-bench Verified leaderboard (LLM-Stats)",
    url: "https://llm-stats.com/benchmarks/swe-bench-verified",
  },
  {
    label: "Groq official rate limits documentation",
    url: "https://console.groq.com/docs/rate-limits",
  },
  {
    label: "Cloudflare Workers AI pricing (10,000 Neurons/day)",
    url: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
  },
  {
    label: "Cloudflare Community: 4006 daily free neuron limit exceeded while dashboard shows 0",
    url: "https://community.cloudflare.com/t/workers-ai-returns-4006-daily-free-neuron-limit-exceeded-while-dashboard-shows-0/909187",
  },
  {
    label: "Poolside: Laguna S 2.1 (free) on OpenRouter",
    url: "https://openrouter.ai/poolside/laguna-s-2.1:free",
  },
  {
    label: "Poolside get-started / free preview API and CLI",
    url: "https://poolside.ai/get-started",
  },
  {
    label: "Free, unlimited Poolside Laguna access via Puter.js",
    url: "https://developer.puter.com/tutorials/free-unlimited-poolside-ai-api/",
  },
  {
    label: "GitHub issue documenting Poixe's real free-tier caps (2 RPM / 5 RPD)",
    url: "https://github.com/diegosouzapw/OmniRoute/issues/12765",
  },
  { label: "Token Harbor official site", url: "https://tokenharbor.ai/" },
  {
    label: "Odirouter free LLM API listing (base URL, 50 RPD)",
    url: "https://github.com/mnfst/awesome-free-llm-apis/pull/93",
  },
  { label: "NVIDIA NIM (build.nvidia.com)", url: "https://build.nvidia.com/" },
  { label: "Mistral AI platform tiers", url: "https://docs.mistral.ai/deployment/laplateforme/tier/" },
];

export const RANKING_DISCLAIMER =
  "Benchmark scores move every month and vendor-run numbers flatter the vendor — and as Cloudflare and Poixe show here, advertised rate limits can flatter the vendor too. Treat this as a starting shortlist grounded in what's independently verifiable, then use the play button: the only quota that matters is the one your own key reproduces.";
export const RANKING_DISCLAIMER_FR =
  "Les scores de benchmark évoluent chaque mois et les chiffres publiés par les éditeurs les flattent — et comme le montrent ici Cloudflare et Poixe, les limites de débit annoncées peuvent aussi flatter l'éditeur. Considérez ceci comme une présélection de départ fondée sur ce qui est vérifiable de façon indépendante, puis utilisez le bouton de test : le seul quota qui compte est celui que votre propre clé reproduit.";

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
    reason:
      "Trained specifically for agentic software engineering. Poolside's own benchmark page puts it at 70.2% on Terminal-Bench 2.1 and 40.4% on DeepSWE — published, not third-party-estimated.",
    reasonFr:
      "Entraîné spécifiquement pour l'ingénierie logicielle agentique. La page de benchmark de Poolside indique 70,2 % sur Terminal-Bench 2.1 et 40,4 % sur DeepSWE — des chiffres publiés, pas des estimations tierces.",
  },
  {
    model: "Poolside laguna-xs-2.1",
    providerId: "poolside",
    tierName: "S",
    sweScore: 48.1,
    reason:
      "Smaller sibling of the same purpose-built coding line; Poolside's own docs claim it performs close to the flagship despite the smaller footprint.",
    reasonFr:
      "Petit frère de la même gamme de codage conçue sur mesure ; la documentation de Poolside indique qu'il approche le modèle phare malgré une empreinte plus petite.",
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
    sweScore: 67,
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

  // ---- Tier A -------------------------------------------------------------
  {
    model: "DeepSeek V4 Flash",
    providerId: "tokenharbor",
    tierName: "A",
    sweScore: 38.5,
    reason:
      "Not a dedicated coder, but DeepSeek's flash tier is a capable, fast generalist and it's free specifically on TokenHarbor right now.",
    reasonFr:
      "Pas un codeur dédié, mais le palier flash de DeepSeek est un généraliste rapide et compétent, et il est gratuit spécifiquement sur TokenHarbor en ce moment.",
  },
  {
    model: "deepseek/deepseek-v4.1-flash:free",
    providerId: "xkiro",
    tierName: "A",
    reason:
      "xKiro's genuinely free DeepSeek line, and the only DeepSeek variant the 5M TPD grant actually covers — the pro and non-flash ids are metered. A stronger generalist than the V4 Flash it replaces. xKiro publishes no independent benchmark number for it, so none is listed here.",
    reasonFr:
      "La ligne DeepSeek réellement gratuite de xKiro, et la seule variante DeepSeek que le crédit de 5M TPD couvre vraiment — les identifiants pro et non-flash sont mesurés. Un généraliste plus solide que le V4 Flash qu'elle remplace. xKiro ne publie aucun chiffre de benchmark indépendant, donc aucun n'est listé ici.",
  },
  {
    model: "deepseek/deepseek-v4-pro",
    providerId: "xkiro",
    tierName: "B",
    reason:
      "Served by the same xKiro key but without the :free tag, so it draws on metered balance rather than the free allowance. Worth knowing it is there; do not build a free chain on it.",
    reasonFr:
      "Servi par la même clé xKiro mais sans l'étiquette :free, donc il puise dans le solde mesuré plutôt que dans l'allocation gratuite. Bon à savoir qu'il est là ; ne bâtissez pas une chaîne gratuite dessus.",
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
    reason:
      "The classic open coder. Skill-wise it's fine — the caveats about this provider are entirely about the free-tier plumbing, not this model.",
    reasonFr:
      "Le codeur ouvert classique. Sur le plan des compétences, il est correct — les réserves sur ce fournisseur concernent uniquement la mécanique du palier gratuit, pas ce modèle.",
  },

  // ---- Tier B -------------------------------------------------------------
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

  // ---- Tier C -------------------------------------------------------------
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
    providerId: "groq",
    provider: "Groq",
    tier: 1,
    quota:
      "30 requests/min, 14,400 requests/day on the 8B-class model; larger models (GPT-OSS 120B/20B) are capped lower, around 1,000 RPD / 200,000 TPD",
    provenance: "operator",
    reliability: "solid",
    fieldTested: false,
    note: "Confirmed against Groq's current published limits. Per-model caps differ a lot — check the model you actually plan to use, not just the headline 14,400/day figure.",
    noteFr:
      "Confirmé par rapport aux limites publiées actuelles de Groq. Les plafonds par modèle varient beaucoup — vérifiez le modèle que vous comptez réellement utiliser, pas seulement le chiffre vedette de 14 400/jour.",
  },
  {
    providerId: "poolside",
    provider: "Poolside",
    tier: 1,
    quota:
      "200 requests/day, 1M tokens/day on the OpenRouter mirror — but Poolside's own preview API (platform.poolside.ai) and the Puter.js browser proxy currently offer effectively unmetered free access to the same Laguna models",
    provenance: "operator",
    reliability: "solid",
    fieldTested: true,
    note: "This one was undersold before. Go direct instead of through a shared free-model mirror and the real ceiling is much higher than 200/day. Best skill-to-limit ratio on the whole list right now.",
    noteFr:
      "Celui-ci était sous-estimé auparavant. Passez en direct plutôt que par un mirroir de modèles gratuits partagé, et le vrai plafond est bien plus élevé que 200/jour. Meilleur rapport compétence/limite de toute la liste en ce moment.",
  },
  {
    providerId: "xkiro",
    provider: "xKiro AI",
    tier: 1,
    quota: "5M tokens/day, free models only",
    provenance: "third-party",
    reliability: "watch",
    fieldTested: false,
    note: "The 5M TPD figure is the operator's own, not independently reproduced, and it applies to the :free-flagged catalogue only — the DeepSeek V4.1 Flash line qualifies, the pro and non-flash DeepSeek ids do not. Treat the ceiling as unverified until your own dashboard agrees.",
    noteFr:
      "Le chiffre de 5M TPD provient de l'opérateur et n'a pas été reproduit indépendamment ; il ne s'applique qu'au catalogue marqué :free — la ligne DeepSeek V4.1 Flash est éligible, les identifiants DeepSeek pro et non-flash ne le sont pas. Considérez le plafond comme non vérifié tant que votre propre tableau de bord ne le confirme pas.",
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
    providerId: "internai",
    provider: "Intern AI",
    tier: 2,
    quota: "~90M tokens/month, ~3M tokens/day, 30 requests/min",
    provenance: "third-party",
    reliability: "watch",
    note: "Generous on paper; measured latency is high.",
    noteFr: "Généreux sur le papier ; la latence mesurée est élevée.",
  },
  {
    providerId: "tokenharbor",
    provider: "TokenHarbor",
    tier: 2,
    quota: "Free access to DeepSeek V4 Flash and MiMo V2.5, no published RPM/RPD ceiling yet",
    provenance: "operator",
    reliability: "watch",
    fieldTested: true,
    note: "Real product, recently launched, confirmed live and free as of this write-up. Works well for DeepSeek V4 Flash specifically. It's pre-GA (their own listing still says 'we're still early'), so treat any quota as fluid and don't build critical infrastructure on it yet — but ride the free grant while it's there.",
    noteFr:
      "Produit réel, lancé récemment, confirmé actif et gratuit à la date de cette rédaction. Fonctionne bien spécifiquement pour DeepSeek V4 Flash. Le produit n'est pas encore en disponibilité générale (leur propre fiche dit encore « on en est au début »), donc traitez tout quota comme instable et ne construisez pas d'infrastructure critique dessus pour l'instant — mais profitez du crédit gratuit tant qu'il est là.",
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
    providerId: "cloudflare",
    provider: "Cloudflare Workers AI",
    tier: 3,
    quota:
      '10,000 "Neurons"/day shared across every model (Cloudflare\'s own unit, not a request count) — Neuron cost varies wildly per model, so a big model can burn the daily pool in a fraction of the requests a small one would. Cloudflare also separately advertises per-model RPM caps of 150-1,500.',
    provenance: "operator",
    reliability: "watch",
    fieldTested: true,
    note: "This was overstated in the original list — the '100,000 requests/day' figure doesn't reflect how the Neuron system works. There are also multiple open Cloudflare community threads reporting a 4006 'daily free neuron limit exceeded' error firing while the dashboard shows near-zero usage for the day, which lines up with the errors and inconsistent latency reported in hands-on use. The edge network is genuinely fast when it's healthy, so it's still worth having wired up — just don't put it on your critical path without load-testing it yourself first, and check your actual Neuron burn per model before assuming headroom.",
    noteFr:
      "C'était surestimé dans la liste d'origine — le chiffre de « 100 000 requêtes/jour » ne reflète pas le fonctionnement du système de Neurones. Plusieurs fils ouverts sur le forum communautaire de Cloudflare signalent aussi une erreur 4006 « quota quotidien de neurones gratuits dépassé » qui se déclenche alors que le tableau de bord affiche une utilisation quasi nulle pour la journée, ce qui correspond aux erreurs et à la latence irrégulière constatées en usage réel. Le réseau en périphérie est réellement rapide quand tout va bien, donc ça vaut toujours la peine de le brancher — mais ne le mettez pas sur votre chemin critique sans le tester vous-même en charge, et vérifiez votre consommation réelle de Neurones par modèle avant de supposer une marge.",
  },
  {
    providerId: "poixe",
    provider: "Poixe AI",
    tier: 3,
    quota:
      'The no-top-up ("Level 0") free tier is actually 2 requests/min and 5 requests/day on flagship ("large-cup") models, or 20 RPM / 50 RPD on smaller ("small-cup") models — the widely-quoted 10,000 requests/day and 10M tokens/day figures only apply once you add at least $1 of paid balance.',
    provenance: "third-party",
    reliability: "watch",
    fieldTested: true,
    note: "This matches hands-on experience: it authenticates and answers fine, then stops cold after about 5 requests until you top up. That's not a fluke — it's independently documented by another gateway's maintainers hitting the same wall while trying to wire up Poixe's free models. Still worth having as a five-requests-a-day bonus pool, just don't count on it for anything sustained.",
    noteFr:
      "Cela correspond à l'usage réel : ça s'authentifie et répond correctement, puis s'arrête net après environ 5 requêtes jusqu'à un rechargement. Ce n'est pas un hasard — c'est documenté indépendamment par les mainteneurs d'une autre passerelle qui ont buté sur le même mur en essayant de brancher les modèles gratuits de Poixe. Ça reste utile comme petit bonus de cinq requêtes par jour, mais ne comptez pas dessus pour un usage soutenu.",
  },
  {
    providerId: "agnes",
    provider: "Agnes, AION, BazaarLink, Naga, HelixMind, Mistral, OpenRouter, Cohere, SEA-LION, Mixlayer, Routeway",
    tier: 3,
    quota: "tight per-minute and per-day limits, several with reliability caveats",
    provenance: "unpublished",
    reliability: "watch",
  },
  {
    providerId: "odirouter",
    provider: "Odirouter",
    tier: 3,
    quota: "~50 requests/day (confirmed against the provider's own listing), models exposed with a free- prefix",
    provenance: "operator",
    reliability: "watch",
    note: "The base URL and the 50 RPD figure check out independently. The reason to treat it as a rotating fallback rather than a primary is what's already flagged elsewhere in this list: tool-call/schema reliability is inconsistent (⚠️/⚠️), and measured latency swings wildly by model, from under 2s to over 12s. Fine to keep in a fallback chain; don't lead with it.",
    noteFr:
      "L'URL de base et le chiffre de 50 requêtes/jour se vérifient de manière indépendante. La raison de le traiter comme un recours rotatif plutôt qu'un choix principal est déjà signalée ailleurs dans cette liste : la fiabilité de l'appel d'outils et du schéma est inégale (⚠️/⚠️), et la latence mesurée varie énormément selon le modèle, de moins de 2 s à plus de 12 s. Correct dans une chaîne de secours ; ne le mettez pas en tête.",
  },
  {
    providerId: "electronhub",
    provider: "ElectronHub, Hugging Face",
    tier: 3,
    quota: "$0.25/week and $0.10/month in credits",
    provenance: "operator",
    reliability: "avoid",
    note: "Huge model lists, single-use budget. Novelties, not infrastructure.",
    noteFr: "Immenses listes de modèles, budget à usage unique. Des curiosités, pas une infrastructure.",
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
    why: "Verified real quota, sub-300ms latency and an explicit code tag. The daily driver.",
    whyFr: "Quota réel vérifié, latence sous 300 ms et une étiquette code explicite. Le pilote quotidien.",
  },
  {
    rank: 2,
    providerId: "poolside",
    model: "laguna-s-2.1 (direct via platform.poolside.ai, not the OpenRouter mirror)",
    tier: 1,
    why: "Best coding pedigree on the list with real published benchmarks, and — used directly rather than through a shared free-model mirror — the limits are far more generous than the '200 RPD' figure usually quoted. Promoted based on hands-on use.",
    whyFr:
      "Meilleur pedigree de codage de la liste avec des benchmarks publiés réels, et — utilisé en direct plutôt que via un mirroir de modèles gratuits partagé — les limites sont bien plus généreuses que le chiffre de « 200 requêtes/jour » habituellement cité. Promu sur la base d'un usage réel.",
  },
  {
    rank: 3,
    providerId: "opencode-zen",
    model: "muse-spark-1.3-contributor-free",
    tier: 2,
    why: "Actually curated for coding agents, 1M context, and a real contributor tier.",
    whyFr: "Réellement organisé pour les agents de codage, 1M de contexte, et un vrai palier contributeur.",
  },
  {
    rank: 4,
    providerId: "tokenharbor",
    model: "deepseek-v4-flash",
    tier: 2,
    why: "A newly-launched, confirmed-live gateway giving free DeepSeek V4 Flash access with no shared-pool contention yet. Good while it lasts — it's pre-GA, so revisit this pick in a few months.",
    whyFr:
      "Une passerelle récemment lancée et confirmée active offrant un accès gratuit à DeepSeek V4 Flash sans contention de pool partagé pour l'instant. Bon tant que ça dure — le produit n'est pas encore en disponibilité générale, donc réévaluez ce choix dans quelques mois.",
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
    model: "deepseek/deepseek-v4.1-flash:free / mistralai/codestral-2508",
    tier: 1,
    why: "Large daily token allowance (5M TPD), and the DeepSeek V4.1 Flash line is inside the free grant, not just the Mistral code models. Good for batch work — the volume is third-party, so confirm it against your own dashboard before leaning on it.",
    whyFr:
      "Grande allocation quotidienne de jetons (5M TPD), et la ligne DeepSeek V4.1 Flash fait partie du crédit gratuit, pas seulement les modèles de code Mistral. Bon pour le travail par lots — le volume est tiers, vérifiez-le sur votre propre tableau de bord avant de vous y appuyer.",
  },
  {
    rank: 8,
    providerId: "nvidia",
    model: "poolside/laguna-xs-2.1 or nemotron-3-super-120b-a12b",
    tier: 2,
    why: "Solid backup pool with per-model limits.",
    whyFr: "Pool de secours solide avec des limites par modèle.",
  },
  {
    rank: 9,
    providerId: "cloudflare",
    model: "@cf/qwen/qwen2.5-coder-32b-instruct or @cf/openai/gpt-oss-120b",
    tier: 3,
    why: "Dropped from #2 to #9 on real-world testing. The advertised ceiling doesn't hold up: the real free tier is a 10,000-Neuron daily pool (not 100,000 requests), and it throws 'quota exceeded' errors well under that ceiling with inconsistent latency. Still worth having wired up for the edge reach — just verify it yourself before relying on it.",
    whyFr:
      "Rétrogradé de la 2e à la 9e place suite à un test en conditions réelles. Le plafond annoncé ne tient pas : le vrai palier gratuit est un pool quotidien de 10 000 Neurones (pas 100 000 requêtes), et il renvoie des erreurs de quota dépassé bien avant ce plafond, avec une latence irrégulière. Ça reste utile à brancher pour la portée en périphérie — vérifiez-le vous-même avant de vous y fier.",
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
    alsoOn: [
      "helixmind",
      "gonka",
      "huggingface",
      "literouter",
      "orcarouter",
      "tokenharbor",
      "xkiro",
    ],
    keep: "voidai",
    fallback: "helixmind",
    note: "For V4 Flash specifically, TokenHarbor is worth a look too — it's a dedicated free grant rather than a shared quota, at least while the product is new. xKiro carries the V4.1 Flash generation, which the older V4-only rows above do not.",
    noteFr:
      "Pour V4 Flash spécifiquement, TokenHarbor mérite aussi le détour — c'est un crédit gratuit dédié plutôt qu'un quota partagé, du moins tant que le produit est récent. xKiro porte la génération V4.1 Flash, que les lignes V4 ci-dessus ne couvrent pas.",
  },
  {
    family: "deepseek-v4.1-flash",
    alsoOn: ["xkiro", "tokenharbor"],
    keep: "xkiro",
    fallback: "tokenharbor",
    note: "Both expose it under a :free id, but xKiro's grant is the larger and the more stable of the two (5M TPD against TokenHarbor's unpublished pre-GA allowance). Lead with xKiro and let TokenHarbor catch the spill.",
    noteFr:
      "Les deux l'exposent sous un identifiant :free, mais le crédit de xKiro est le plus large et le plus stable des deux (5M TPD contre l'allocation pré-GA non publiée de TokenHarbor). Mettez xKiro en tête et laissez TokenHarbor absorber le débordement.",
  },
  {
    family: "Poolside laguna-s / xs-2.1",
    alsoOn: ["openrouter", "kilo", "nvidia", "opencode-zen", "literouter", "tokenreply", "evolvex"],
    keep: "poolside",
    fallback: "opencode-zen",
    note: "Keep means the vendor's own API/CLI (or the Puter.js proxy), not the OpenRouter mirror — the mirror's 200 RPD cap is much tighter than going direct.",
    noteFr:
      "« À conserver » signifie l'API/CLI du fournisseur lui-même (ou le proxy Puter.js), pas le mirroir OpenRouter — le plafond de 200 requêtes/jour du mirroir est bien plus serré qu'en direct.",
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
      "Not because of what the models are called — the base URL and free tier check out fine on paper. It's the inconsistent tool-call/schema reliability and the wide latency spread across its own catalog (under 2s to over 12s on different models) that make it a fallback-only pick.",
    reasonFr:
      "Pas à cause des noms des modèles — l'URL de base et le palier gratuit sont corrects sur le papier. C'est la fiabilité inégale de l'appel d'outils et du schéma, ainsi que le large éventail de latence au sein de son propre catalogue (moins de 2 s à plus de 12 s selon les modèles), qui en font un choix de secours uniquement.",
  },
  {
    provider: "Gonka Broker",
    reason: "Phone verification for three models that are all available elsewhere without friction.",
    reasonFr: "Vérification par téléphone pour trois modèles tous disponibles ailleurs sans friction.",
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
    reasonFr: "Un modèle, environ quinze requêtes par jour, avec de meilleurs équivalents ailleurs.",
  },
];

export const WORTH_TRYING_WITH_CAVEATS: WorthTryingEntry[] = [
  {
    provider: "Poixe AI",
    note: "The real no-top-up free tier is about 5 requests/day on flagship models (confirmed independently, not just anecdotally). It genuinely works while it lasts, so it's fine as a tiny bonus pool — just don't route anything through it that needs to survive past request #5.",
    noteFr:
      "Le vrai palier gratuit sans rechargement est d'environ 5 requêtes/jour sur les modèles phares (confirmé indépendamment, pas seulement de façon anecdotique). Ça fonctionne réellement tant que ça dure, donc c'est correct comme petit pool bonus — ne faites simplement pas transiter dessus quelque chose qui doit survivre au-delà de la 5e requête.",
  },
  {
    provider: "Cloudflare Workers AI",
    note: "Great latency when it's healthy, but the free tier is smaller than advertised (10,000 Neurons/day, not 100,000 requests) and prone to premature quota errors. Worth checking and keeping in a fallback chain — just don't lead with it or assume the advertised ceiling.",
    noteFr:
      "Excellente latence quand tout va bien, mais le palier gratuit est plus petit qu'annoncé (10 000 Neurones/jour, pas 100 000 requêtes) et sujet à des erreurs de quota prématurées. Ça vaut la peine de le vérifier et de le garder dans une chaîne de secours — ne le mettez simplement pas en tête et ne présumez pas du plafond annoncé.",
  },
];

/** The bottom line, in one paragraph. */
export const RANKING_BOTTOM_LINE =
  "Groq is still the daily driver. Poolside moves up to #2 once you go direct instead of through a shared mirror — it has the best coding pedigree on the list and turned out to be far less limited than advertised. xKiro's DeepSeek V4.1 Flash line now sits alongside its Mistral code models at #7: it is the only DeepSeek variant the 5M TPD free grant actually covers, which the boards previously ignored entirely. TokenHarbor is a solid new addition for free DeepSeek V4 Flash while its launch-week grant lasts. Cloudflare drops from #2 to #9: the real free tier is a 10,000-Neuron pool, not 100,000 requests, and it throws quota errors under real load — still worth wiring up for the edge latency, just verify it yourself. Poixe is genuinely usable for about 5 requests a day and then stops; treat it as a bonus, not a plan. Everything else is either a re-export of the same models or too rate-limited to build around, so six to eight providers is the practical ceiling.";
export const RANKING_BOTTOM_LINE_FR =
  "Groq reste le pilote quotidien. Poolside remonte à la 2e place une fois utilisé en direct plutôt que via un mirroir partagé — il a le meilleur pedigree de codage de la liste et s'est révélé bien moins limité qu'annoncé. La ligne DeepSeek V4.1 Flash de xKiro rejoint désormais ses modèles de code Mistral à la 7e place : c'est la seule variante DeepSeek que le crédit gratuit de 5M TPD couvre réellement, ce que les tableaux ignoraient totalement auparavant. TokenHarbor est un bon nouvel ajout pour DeepSeek V4 Flash gratuit tant que son crédit de lancement dure. Cloudflare passe de la 2e à la 9e place : le vrai palier gratuit est un pool de 10 000 Neurones, pas 100 000 requêtes, et il renvoie des erreurs de quota sous charge réelle — ça vaut toujours la peine de le brancher pour la latence en périphérie, mais vérifiez-le vous-même. Poixe est réellement utilisable pour environ 5 requêtes par jour puis s'arrête ; à traiter comme un bonus, pas comme un plan. Tout le reste est soit une re-exportation des mêmes modèles, soit trop limité en débit pour s'y appuyer, donc six à huit fournisseurs constituent le plafond pratique.";

/**
 * Short trivia for the dashboard's Insights cards. One or two sentences: this
 * does not need a release. Kept short - these render in a small card, not a
 * paragraph.
 */
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

/** French sibling of {@link FUN_FACTS}, same order, same length. */
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

/** The ranking boards, in the shape `/api/catalog/rankings` returns. */
export interface RankingsView {
  meta?: RankingsMeta;
  tiers: SkillTier[];
  skill: SkillEntry[];
  rateLimit: RateLimitEntry[];
  combined: CombinedEntry[];
  redundancy: RedundancyEntry[];
  dropList: Array<{ provider: string; reason: string; reasonFr?: string }>;
  worthTryingWithCaveats?: WorthTryingEntry[];
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

/** The boards exactly as compiled into this build. */
export function compiledRankingsView(): RankingsView {
  return {
    meta: RANKINGS_META,
    tiers: SKILL_TIERS,
    skill: SKILL_RANKING,
    rateLimit: RATE_LIMIT_RANKING,
    combined: COMBINED_RANKING,
    redundancy: REDUNDANCY_TABLE,
    dropList: DROP_LIST,
    worthTryingWithCaveats: WORTH_TRYING_WITH_CAVEATS,
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
