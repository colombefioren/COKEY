import { CokeyLogo } from "../components/Logo.js";
import { Panel } from "../components/Primitives.js";
import { ContactGrid } from "../components/Contact.js";
import { CREATOR, DATA_CREDIT, REPO_URL } from "../links.js";

/**
 * About, credits and contact.
 *
 * COKEY is a local tool made by one person, so the about page says who and
 * links where the model data came from. Nothing here fetches anything: it is a
 * static signpost.
 */

const STACK: Array<{ label: string; tone?: string }> = [
  { label: "TypeScript" },
  { label: "Node.js 20+" },
  { label: "Fastify" },
  { label: "SQLite (WAL)" },
  { label: "Zod" },
  { label: "React 18" },
  { label: "Vite" },
  { label: "Server-Sent Events" },
];

const RUNTIME: Array<{ label: string }> = [
  { label: "OpenAI-compatible /v1" },
  { label: "Streaming" },
  { label: "Chain fallback" },
  { label: "Automatic egress pool" },
  { label: "Local-first, no telemetry" },
];

export function About() {
  return (
    <>
      <Panel title="COKEY">
        <div className="about-hero">
          <div className="about-logo">
            <CokeyLogo height={40} />
          </div>
          <div className="about-copy">
            <h2>a tool for broke lads made by a broke princess</h2>
            <p className="muted">
              Pool the free API keys you already have into ordered chains, behind one
              OpenAI-compatible endpoint. When a key runs out, the next one takes over and the
              client never notices. It runs on your machine, encrypted at rest, and sends nothing
              anywhere.
            </p>
            <div className="about-actions">
              <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
                Source on GitHub
              </a>
              <a className="btn secondary" href={CREATOR.github} target="_blank" rel="noreferrer">
                Follow @{CREATOR.name}
              </a>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Built with">
        <div className="chip-row">
          {STACK.map((item) => (
            <span key={item.label} className="stack-chip">
              {item.label}
            </span>
          ))}
        </div>
        <div className="chip-row" style={{ marginTop: 10 }}>
          {RUNTIME.map((item) => (
            <span key={item.label} className="stack-chip alt">
              {item.label}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Contact the creator">
        <p className="small muted" style={{ marginTop: 0 }}>
          Built and maintained by <strong>@{CREATOR.name}</strong>. Bug reports, provider tips and
          pull requests welcome.
        </p>
        <ContactGrid />
      </Panel>

      <Panel title="Credits">
        <p className="small muted" style={{ marginTop: 0 }}>
          The provider and free-tier catalog is built in part from{" "}
          <a href={DATA_CREDIT.url} target="_blank" rel="noreferrer">
            {DATA_CREDIT.label}
          </a>
          , with thanks. Rate limits change constantly, so the ranking boards always name their
          source and let you decide.
        </p>
      </Panel>
    </>
  );
}
