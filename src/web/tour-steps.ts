/**
 * The onboarding tour's script.
 *
 * Steps that name a `route` have the tour navigate there first, so most of
 * this walk is the real, live page - not a tooltip pasted over a screenshot
 * of it. A step's `target` is a `data-tour` attribute on a real, always-
 * rendered element of that page (a search box, a named field, a panel
 * title) - never something that only exists once a modal is opened, since
 * the tour does not drive anything but navigation on the user's behalf.
 * `placement` is fixed per step rather than computed from viewport space:
 * every target here sits in a predictable part of its page's layout, so
 * there is nothing to flip.
 */

export type TourPlacement = "right" | "bottom" | "left" | "top" | "center";

export interface TourStep {
  id: string;
  /** Route to navigate to before this step, when it differs from the current one. */
  route?: string;
  /** `data-tour` selector to spotlight. Omitted for the welcome/closing cards. */
  target?: string;
  placement: TourPlacement;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    placement: "center",
    title: "Tour guide",
    body: "Press Enter or click Next to move to the next step. Skip drops you straight in. Replay this any time from the compass in the topbar.",
  },
  {
    id: "dashboard",
    route: "/dashboard",
    target: "dashboard-tabs",
    placement: "bottom",
    title: "Dashboard",
    body: "Three tabs: Live route draws the request as it is walked right now, Resilience names which of the three containment layers caught your last failure, and Activity is the gateway's own health.",
  },
  {
    id: "providers",
    route: "/providers",
    target: "providers-search",
    placement: "bottom",
    title: "Providers",
    body: "Click any provider's card - not just the Connect button - to see its full dossier, jurisdiction and free-tier limit before you paste a key. COKEY verifies a key the moment you save it.",
  },
  {
    id: "chains-alias",
    route: "/chains",
    target: "chain-alias-field",
    placement: "bottom",
    title: "A chain's name IS the model id",
    body: "Whatever you type here - say cokey-best - is exactly what your client should request as \"model\". COKEY resolves that alias to a node, a model and a key on every single request, and moves to the next one the moment any of those runs out.",
  },
  {
    id: "no-chain-needed",
    route: "/chains",
    target: "v1-models-link",
    placement: "bottom",
    title: "Don't want a chain? You don't need one",
    body: "A chain is for fallback across several keys or providers. If you only ever use one key, skip building a chain entirely: connect the provider and call its real model id directly. Open this link any time to see every model your connected keys can currently serve.",
  },
  {
    id: "models",
    route: "/models",
    target: "models-search",
    placement: "bottom",
    title: "Models",
    body: "Every curated free model, searchable by name, use or provider. A model greyed out just means none of your connected keys can reach it yet - the play button on any row sends one real request and only turns green on an actual 200.",
  },
  {
    id: "usage",
    route: "/usage",
    target: "usage-panel",
    placement: "bottom",
    title: "Usage",
    body: "Exactly which node, key and exit IP is serving right now, per-key throughput, and your full local request history - nothing here is estimated.",
  },
  {
    id: "api-keys",
    route: "/api-keys",
    target: "apikey-name-field",
    placement: "bottom",
    title: "API keys",
    body: "Optional: create a named key here only if you want your own clients to authenticate against COKEY itself. Most setups just use a placeholder value - COKEY only checks it if a gateway key actually exists.",
  },
  {
    id: "settings",
    route: "/settings",
    target: "settings-port-field",
    placement: "bottom",
    title: "Settings",
    body: "The gateway's port and host binding live here, along with the fallback policy that decides how a cooldown or a retry behaves across every chain.",
  },
  {
    id: "proxies",
    route: "/proxies",
    target: "proxies-panel",
    placement: "bottom",
    title: "Proxies",
    body: "Add exits here to turn on the automatic egress pool - off by default - so two keys of the same provider never share an exit IP. One key, one pool, one exit.",
  },
  {
    id: "live-status",
    target: "live-status",
    placement: "bottom",
    title: "The live route",
    body: "This chip names the node, the key and the exit IP serving your last request, live - click it for the full routing feed, from anywhere in the app.",
  },
  {
    id: "notifications",
    target: "notif-bell",
    placement: "bottom",
    title: "Notifications",
    body: "A key cooling down, a model going unavailable, a proxy dying - anything that needs a look lands here.",
  },
  {
    id: "guide",
    target: "guide-button",
    placement: "bottom",
    title: "Come back any time",
    body: "This compass replays the whole tour whenever you want it - COKEY won't show it again on its own once you've seen it.",
  },
  {
    id: "closing",
    placement: "center",
    title: "That's every page",
    body: "Connect a free key, then either chain it for fallback or use its model id directly - both are first-class here. Terms and About, in the sidebar, are where bug reports and provider tips live.",
  },
];
