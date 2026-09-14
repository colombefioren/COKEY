/**
 * The onboarding tour's script.
 *
 * Every step but the first and last points at a real, always-mounted piece of
 * chrome (a `data-tour` attribute on a sidebar row or a topbar control), so the
 * tour works from any page without navigating the app out from under itself.
 * `placement` is fixed per step rather than computed from viewport space,
 * because this app's chrome is fixed too: the sidebar is always the left rail
 * and the topbar is always the top strip, so there is nothing to flip.
 */

export type TourPlacement = "right" | "bottom" | "left" | "top" | "center";

export interface TourStep {
  id: string;
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
    title: "Welcome to COKEY",
    body: "A quick, skippable tour of where everything lives. Next takes you through it, Skip drops you straight in - either way, click the compass in the topbar to see this again.",
  },
  {
    id: "dashboard",
    target: "nav-dashboard",
    placement: "right",
    title: "Dashboard",
    body: "A live overview: chains, keys and connected providers, and the resilience layer that caught your last failure, if any did.",
  },
  {
    id: "chains",
    target: "nav-chains",
    placement: "right",
    title: "Chains",
    body: "Build a chain here: one node per provider and model, with the keys each node may use, in the order you want them tried.",
  },
  {
    id: "providers",
    target: "nav-providers",
    placement: "right",
    title: "Providers",
    body: "Paste a free API key from any provider - COKEY verifies it inline before it can join a chain.",
  },
  {
    id: "models",
    target: "nav-models",
    placement: "right",
    title: "Models",
    body: "Browse the curated free-model catalog, test any model with one real request, and check the rankings boards.",
  },
  {
    id: "usage",
    target: "nav-usage",
    placement: "right",
    title: "Usage",
    body: "Per-key throughput and request history, so two keys of the same provider are never indistinguishable.",
  },
  {
    id: "live-status",
    target: "live-status",
    placement: "bottom",
    title: "The live route",
    body: "This chip names the node, the key and the exit IP serving your last request, live - click it for the full routing feed.",
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
    body: "This compass replays the tour whenever you want it - COKEY won't show it again on its own once you've seen it.",
  },
  {
    id: "closing",
    placement: "center",
    title: "That's everything",
    body: "Go connect a free key and build your first chain. Terms and About, in the sidebar, are where bug reports and provider tips live.",
  },
];
