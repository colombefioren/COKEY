import { useEffect, useState } from "react";
import type { Settings as SettingsModel } from "../types.js";
import { EgressPoolPanel } from "../components/EgressPoolPanel.js";
import { Empty } from "../components/Primitives.js";

/**
 * The egress proxy pool, on its own screen.
 *
 * It used to live at the bottom of Settings, which buried a whole pool of
 * addresses — with its own health checks, bulk paste and per-provider
 * pinning — under a page named for gateway ports and fallback policy. It is
 * its own concern, so it gets its own tab.
 */
export function Proxies({
  settings,
  onSaved,
  refreshKey,
}: {
  settings: SettingsModel | null;
  onSaved: () => void;
  refreshKey: number;
}) {
  const [draft, setDraft] = useState<SettingsModel | null>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!draft) return <Empty>Loading settings…</Empty>;

  return <EgressPoolPanel settings={draft} onSettingsChanged={onSaved} refreshKey={refreshKey} />;
}
