import { useEffect, useState } from "react";
import type { Settings as SettingsModel } from "../types.js";
import { EgressPoolPanel } from "../components/EgressPoolPanel.js";
import { Empty } from "../components/Primitives.js";
import { useLang } from "../lang.js";

export function Proxies({
  settings,
  onSaved,
  refreshKey,
}: {
  settings: SettingsModel | null;
  onSaved: () => void;
  refreshKey: number;
}) {
  const { t } = useLang();
  const [draft, setDraft] = useState<SettingsModel | null>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (!draft) return <Empty>{t("Loading settings…")}</Empty>;

  return <EgressPoolPanel settings={draft} onSettingsChanged={onSaved} refreshKey={refreshKey} />;
}
