/**
 * The navbar's own two languages.
 *
 * This does not translate the app — every page still speaks English. It
 * covers exactly the chrome that never changes screen to screen: the
 * sidebar's labels and hints, its footer, and the page title in the topbar.
 * A toggle for the rest of the app is a much larger project than "the
 * navbar," and pretending otherwise here would just leave half-translated
 * pages behind it.
 */

export type Lang = "en" | "fr";

const LANG_KEY = "cokey.lang";

export function getStoredLang(): Lang {
  try {
    return window.localStorage.getItem(LANG_KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function setStoredLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Private browsing or a blocked store: the toggle still works for the
    // session, it just forgets the choice next time.
  }
}

export const PAGE_TITLES: Record<Lang, Record<string, string>> = {
  en: {
    "/dashboard": "Dashboard",
    "/chains": "Chains",
    "/models": "Models",
    "/providers": "Providers",
    "/api-keys": "API keys",
    "/usage": "Usage",
    "/settings": "Settings",
    "/proxies": "Proxies",
    "/tutorial": "Tutorial",
    "/terms": "Terms of service",
    "/about": "About",
  },
  fr: {
    "/dashboard": "Tableau de bord",
    "/chains": "Chaînes",
    "/models": "Modèles",
    "/providers": "Fournisseurs",
    "/api-keys": "Clés API",
    "/usage": "Utilisation",
    "/settings": "Paramètres",
    "/proxies": "Proxys",
    "/tutorial": "Tutoriel",
    "/terms": "Conditions d'utilisation",
    "/about": "À propos",
  },
};

export const NAV_HINTS: Record<Lang, Record<string, string>> = {
  en: {
    "/dashboard": "Gateway summary, the live route and the resilience layers",
    "/chains": "Your failover chains, their nodes and their keys",
    "/models": "Model catalog, live probes and rankings",
    "/providers": "Who runs each provider and whether to depend on it",
    "/api-keys": "Keys for talking to the gateway itself",
    "/usage": "Request history and token usage together",
    "/settings": "Gateway and fallback settings",
    "/proxies": "The egress proxy pool: health, pinning and bulk paste",
    "/tutorial": "Wire COKEY into your editor or CLI",
    "/terms": "What you agree to by using COKEY",
    "/about": "The stack, the credits and how to reach the creator",
  },
  fr: {
    "/dashboard": "Résumé de la passerelle, la route en direct et les couches de résilience",
    "/chains": "Vos chaînes de secours, leurs nœuds et leurs clés",
    "/models": "Catalogue de modèles, tests en direct et classements",
    "/providers": "Qui exploite chaque fournisseur et si on peut en dépendre",
    "/api-keys": "Clés pour parler à la passerelle elle-même",
    "/usage": "Historique des requêtes et utilisation des jetons",
    "/settings": "Paramètres de la passerelle et du repli",
    "/proxies": "Le pool de proxys de sortie : santé, épinglage et collage en masse",
    "/tutorial": "Brancher COKEY dans votre éditeur ou votre CLI",
    "/terms": "Ce que vous acceptez en utilisant COKEY",
    "/about": "La stack, les crédits et comment joindre la créatrice",
  },
};

export const SIDEBAR_TEXT: Record<
  Lang,
  { chains: string; keys: string; tagline: string; expand: string; collapse: string }
> = {
  en: {
    chains: "chains",
    keys: "keys",
    tagline: "a tool for broke lads made by a broke princess",
    expand: "Expand sidebar",
    collapse: "Collapse sidebar",
  },
  fr: {
    chains: "chaînes",
    keys: "clés",
    tagline: "un outil pour les fauchés, fait par une princesse fauchée",
    expand: "Agrandir la barre latérale",
    collapse: "Réduire la barre latérale",
  },
};
