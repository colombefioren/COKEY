import { CokeyLogo } from "../components/Logo.js";
import { Panel } from "../components/Primitives.js";
import { CREATOR, DATA_CREDIT, REPO_URL } from "../links.js";
import { useLang } from "../lang.js";

/**
 * About and credits.
 *
 * COKEY is a local tool made by one person, so the about page says who and
 * links where the model data came from. Nothing here fetches anything: it is a
 * static signpost.
 */

export function About() {
  const { t } = useLang();
  return (
    <>
      <Panel title="COKEY">
        <div className="about-hero">
          <div className="about-logo">
            <CokeyLogo height={40} />
          </div>
          <div className="about-copy">
            <h2>{t("a tool for broke lads made by a broke princess")}</h2>
            <p className="muted">
              {t(
                "Pool the free API keys you already have into ordered chains, behind one OpenAI-compatible endpoint. When a key runs out, the next one takes over and the client never notices. It runs on your machine, encrypted at rest, and sends nothing anywhere.",
              )}
            </p>
            <span className="badge ok" style={{ marginBottom: 12 }}>
              {t("If it's not free, it's not in COKEY")}
            </span>
            <div className="about-actions">
              <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
                {t("Source on GitHub")}
              </a>
              <a className="btn secondary" href={CREATOR.github} target="_blank" rel="noreferrer">
                {t("Follow")} @{CREATOR.name}
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={t("Credits")}>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t("The provider and free-tier catalog is built in part from")}{" "}
          <a href={DATA_CREDIT.url} target="_blank" rel="noreferrer">
            {DATA_CREDIT.label}
          </a>
          , {t("with thanks. Rate limits change constantly, so the ranking boards always name their source and let you decide.")}
        </p>
      </Panel>
    </>
  );
}
