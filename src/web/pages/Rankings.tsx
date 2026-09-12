import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { RankingsResponse, RateLimitEntry } from "../types.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useRoute } from "../router.js";

type Board = "skill" | "rate" | "combined" | "redundancy";

const BOARDS: Array<{ id: Board; label: string; hint: string }> = [
  { id: "skill", label: "Coding skill", hint: "Benchmark first, limits ignored" },
  { id: "rate", label: "Rate limits", hint: "Throughput first, skill ignored" },
  { id: "combined", label: "Combined", hint: "What to actually wire up" },
  { id: "redundancy", label: "Redundancy", hint: "What is a re-export of what" },
];

/**
 * The ranking boards.
 *
 * Three questions, three boards, because they do not have the same answer. Every
 * quota number carries its provenance so nobody mistakes a third-party blog post
 * for a provider's own documentation.
 */
export function Rankings({ refreshKey }: { refreshKey: number }) {
  const { route, navigate } = useRoute();
  const toast = useToast();
  const [data, setData] = useState<RankingsResponse | null>(null);

  const requested = route.sub ?? route.section;
  const board = (BOARDS.find((candidate) => candidate.id === requested)?.id ?? "skill") as Board;

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.rankings());
      } catch (error) {
        toast.err(error instanceof Error ? error.message : String(error));
      }
    })();
  }, [refreshKey, toast]);

  if (!data) return <Empty>Loading rankings…</Empty>;

  return (
    <>
      <Panel
        title="How to read this"
        actions={
          <div className="tabs tabs-inline">
            {BOARDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tab"
                aria-selected={item.id === board}
                title={item.hint}
                onClick={() => navigate(`/models/rankings/${item.id}`)}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        <p className="small muted" style={{ margin: 0 }}>
          {data.disclaimer}
        </p>
      </Panel>

      {board === "skill" ? <SkillBoard data={data} /> : null}
      {board === "rate" ? <RateBoard data={data} /> : null}
      {board === "combined" ? <CombinedBoard data={data} /> : null}
      {board === "redundancy" ? <RedundancyBoard data={data} /> : null}

      <Panel title="Sources">
        <ul className="source-list">
          {data.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="small faint" style={{ marginBottom: 0 }}>
          Benchmark scores move every month and vendor-run numbers flatter the vendor. The play
          button in the catalog is the only score that reflects your own key.
        </p>
      </Panel>
    </>
  );
}

function SkillBoard({ data }: { data: RankingsResponse }) {
  return (
    <>
      {data.tiers.map((tier) => {
        const rows = data.skill.filter((entry) => entry.tierName === tier.name);
        return (
          <Panel key={tier.name} title={`Tier ${tier.name}: ${tier.label}`}>
            <p className="small muted" style={{ marginTop: 0 }}>
              {tier.blurb}
            </p>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>Tier</th>
                  <th>Model</th>
                  <th style={{ width: 120 }}>SWE-bench</th>
                  <th>Provider</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => (b.sweScore ?? -1) - (a.sweScore ?? -1))
                  .map((entry) => (
                    <tr key={`${tier.name}-${entry.model}`}>
                      <td>
                        <span className={`badge tier-${tier.name.toLowerCase()}`}>{tier.name}</span>
                      </td>
                      <td className="mono small">
                        <a
                          href={`#/models?q=${encodeURIComponent(entry.model)}`}
                          title={`Find ${entry.model} in the catalog`}
                        >
                          {entry.model}
                        </a>
                      </td>
                      <td>
                        {entry.sweScore !== undefined ? (
                          <span className="swe-score">
                            <span className="swe-bar" aria-hidden="true">
                              <span
                                className="swe-fill"
                                style={{ width: `${Math.min(100, entry.sweScore)}%` }}
                              />
                            </span>
                            <span className="mono small">{entry.sweScore.toFixed(1)}%</span>
                          </span>
                        ) : (
                          <span className="small faint">—</span>
                        )}
                      </td>
                      <td className="small muted">
                        {entry.providerId ? (
                          <a
                            href={`#/providers?q=${encodeURIComponent(entry.providerId)}`}
                            title={`Open ${entry.providerId} in the provider catalog`}
                          >
                            {entry.providerId}
                          </a>
                        ) : (
                          "vendor direct"
                        )}
                      </td>
                      <td className="small">{entry.reason}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </>
  );
}

function RateBoard({ data }: { data: RankingsResponse }) {
  return (
    <>
      <Panel title="Rate limits">
        <p className="small muted" style={{ marginTop: 0 }}>
          Ordered by how much a provider gives away, ignoring how good the models are. A provider
          can top this table and still be useless for coding: that is what the other two boards are
          for.
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: 56 }}>Tier</th>
              <th>Provider</th>
              <th>Quota</th>
              <th style={{ width: 110 }}>Source</th>
              <th style={{ width: 100 }}>Reliability</th>
            </tr>
          </thead>
          <tbody>
            {data.rateLimit.map((entry) => (
              <tr key={`${entry.tier}-${entry.provider}`}>
                <td>
                  <span className="badge neutral">{entry.tier}</span>
                </td>
                <td>
                  <div>{entry.provider}</div>
                  {entry.note ? <div className="small faint">{entry.note}</div> : null}
                </td>
                <td className="small">{entry.quota}</td>
                <td className="small muted">{provenanceLabel(entry)}</td>
                <td>
                  <span className={`badge ${reliabilityTone(entry)}`}>{entry.reliability}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Dropped on purpose">
        <table>
          <thead>
            <tr>
              <th style={{ width: 240 }}>Provider</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {data.dropList.map((entry) => (
              <tr key={entry.provider}>
                <td>{entry.provider}</td>
                <td className="small muted">{entry.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function CombinedBoard({ data }: { data: RankingsResponse }) {
  return (
    <Panel title="What to actually use, in order">
      <table>
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th style={{ width: 140 }}>Provider</th>
            <th>Model</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {data.combined.map((entry) => (
            <tr key={entry.rank}>
              <td className="mono">{entry.rank}</td>
              <td className="mono small">{entry.providerId}</td>
              <td className="small">{entry.model}</td>
              <td className="small muted">{entry.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hint-box" style={{ marginTop: 14 }}>
        {data.bottomLine}
      </div>
      <p className="small faint" style={{ marginBottom: 0 }}>
        Six or seven providers is the practical ceiling here. Beyond that you are wiring the same
        models up twice and paying for it in cooldowns.
      </p>
    </Panel>
  );
}

function RedundancyBoard({ data }: { data: RankingsResponse }) {
  return (
    <Panel title="Duplicated model families">
      <p className="small muted" style={{ marginTop: 0 }}>
        Dozens of these providers resell the same underlying free pool. OpenRouter's free catalogue
        shows up almost verbatim on several others, so the redundancy is structural rather than
        accidental. Keep one of each row, and treat the rest as a fallback only.
      </p>
      <table>
        <thead>
          <tr>
            <th>Model family</th>
            <th>Also available on</th>
            <th style={{ width: 140 }}>Keep</th>
            <th style={{ width: 140 }}>Fallback</th>
          </tr>
        </thead>
        <tbody>
          {data.redundancy.map((entry) => (
            <tr key={entry.family}>
              <td className="mono small">{entry.family}</td>
              <td className="small muted">{entry.alsoOn.join(", ")}</td>
              <td className="small">
                <span className="badge">{entry.keep}</span>
              </td>
              <td className="small">
                <span className="badge neutral">{entry.fallback}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function provenanceLabel(entry: RateLimitEntry): string {
  switch (entry.provenance) {
    case "operator":
      return "operator";
    case "third-party":
      return "third party";
    default:
      return "unpublished";
  }
}

function reliabilityTone(entry: RateLimitEntry): string {
  switch (entry.reliability) {
    case "solid":
      return "";
    case "avoid":
      return "bad";
    default:
      return "warn";
  }
}
