import { CREATOR, REPO_URL } from "../links.js";
import { useLang } from "../lang.js";

/**
 * The status bar, docked at the bottom of the desktop.
 *
 * This is where the old sidebar's footer went. A status bar is the right home
 * for it: an OS puts the things you check occasionally and never interact with
 * in a strip at the bottom edge, out of the way of the work. Counts read left to
 * right; the creator links sit on the right, quiet.
 */
export function StatusBar({
  version,
  dataDir,
  providers,
  keys,
  chains,
  live = false,
}: {
  version: string;
  dataDir: string;
  /** Providers with at least one connected key. */
  providers: number;
  keys: number;
  chains: number;
  /**
   * Whether the event stream is open.
   *
   * Worth a cell of its own: every count on this bar updates because of that
   * stream, so a user who sees stale numbers deserves to know why rather than
   * being left to guess whether the dashboard is slow or broken.
   */
  live?: boolean;
}) {
  const { t } = useLang();
  return (
    <footer className="statusbar">
      <span
        className={`status-cell live-flag${live ? " on" : ""}`}
        title={
          live
            ? t("Connected to the live event stream — this page updates as the gateway changes")
            : t("Event stream offline — falling back to a periodic refresh")
        }
      >
        {live ? t("live") : t("offline")}
      </span>
      <span className="status-cell" title={t("Connected providers")}>
        <strong>{providers}</strong> {t("providers")}
      </span>
      <span className="status-cell" title={t("Stored credentials")}>
        <strong>{keys}</strong> {t("keys")}
      </span>
      <span className="status-cell" title={t("Configured chains")}>
        <strong>{chains}</strong> {t("chains")}
      </span>

      <span className="status-cell" title={dataDir || t("data directory")}>
        {t("data:")} {dataDir ? shortenPath(dataDir) : t("default")}
      </span>
      <span className="status-cell" title={t("Gateway version")}>
        v{version || "0.1.0"}
      </span>

      <span className="spacer" />

      <span className="status-cell">
        {t("made by")}{" "}
        <a href={CREATOR.github} target="_blank" rel="noreferrer">
          @{CREATOR.name}
        </a>
      </span>
      <a href={CREATOR.linkedin} target="_blank" rel="noreferrer">
        LinkedIn
      </a>
      <a href={REPO_URL} target="_blank" rel="noreferrer">
        {t("source")}
      </a>
    </footer>
  );
}

/** Keep a long data path from pushing the creator links off the bar. */
function shortenPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}
