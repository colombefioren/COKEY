import { CokeyLogo } from "../components/Logo.js";
import { Panel } from "../components/Primitives.js";
import { CREATOR, DATA_CREDIT, DOCS_INTRO_URL, PROXY_CREDIT, REPO_URL } from "../links.js";
import { useLang } from "../lang.js";

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
            <p className="small muted">
              {t("Full documentation and additional information live at")}{" "}
              <a href={DOCS_INTRO_URL} target="_blank" rel="noreferrer">
                cokey.vercel.app
              </a>
              .
            </p>
            <div className="about-actions">
              <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
                {t("Source on GitHub")}
              </a>
              <a className="btn secondary" href={DOCS_INTRO_URL} target="_blank" rel="noreferrer">
                {t("Documentation")}
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
          ,{" "}
          {t(
            "with thanks. Rate limits change constantly, so the ranking boards always name their source and let you decide.",
          )}
        </p>
        <p className="small muted">
          {t("The automatic egress pool's free-proxy import pulls its list from")}{" "}
          <a href={PROXY_CREDIT.url} target="_blank" rel="noreferrer">
            {PROXY_CREDIT.label}
          </a>
          , {t("a community-maintained list refreshed continuously, no key and no quota.")}
        </p>
      </Panel>
    </>
  );
}
