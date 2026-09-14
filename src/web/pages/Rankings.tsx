import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { RankingsResponse, RateLimitEntry } from "../types.js";
import { Empty, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";
import { useRoute } from "../router.js";
import { useLang } from "../lang.js";

/**
 * Rankings are fetchable content, not static UI copy, so they carry their own
 * French sibling field (`xFr`) instead of going through the `t()` dictionary -
 * a published bundle's exact English text can never be known ahead of time,
 * but its own French field always can. Falls back to English when a bundle
 * (or an older one) has not filled the French field in.
 */
function loc(en: string, fr: string | undefined, lang: string): string {
  return lang === "fr" && fr ? fr : en;
}

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
  const { t, lang } = useLang();
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [checking, setChecking] = useState(false);

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

  async function checkForUpdates() {
    setChecking(true);
    try {
      const result = await api.refreshRankings();
      if (result.changed && result.rankings) {
        setData(result.rankings);
        toast.ok(t("Rankings updated from the published bundle."));
      } else {
        toast.info(result.message ?? t("No update available."));
      }
    } catch (error) {
      toast.err(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  }

  if (!data) return <Empty>{t("Loading rankings…")}</Empty>;

  return (
    <>
      <Panel
        title={t("How to read this")}
        actions={
          <div className="tabs tabs-inline">
            {BOARDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tab"
                aria-selected={item.id === board}
                title={t(item.hint)}
                onClick={() => navigate(`/models/rankings/${item.id}`)}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        }
      >
        <p className="small muted" style={{ margin: 0 }}>
          {loc(data.disclaimer, data.disclaimerFr, lang)}
        </p>
        {/*
         * Provenance for the boards themselves. Fetched only when a person
         * clicks the button below — never on a timer, never on startup.
         */}
        <div className="row between center" style={{ marginTop: 8, flexWrap: "wrap", gap: 8 }}>
          <p className="small faint" style={{ margin: 0 }}>
            {data.source === "remote"
              ? `${t("Published boards")}${data.fetchedAt ? `, ${t("fetched")} ${new Date(data.fetchedAt).toLocaleString()}` : ""}.`
              : t("Compiled-in boards: this build's own snapshot.")}
          </p>
          <button
            type="button"
            className="secondary small"
            disabled={checking}
            onClick={() => void checkForUpdates()}
          >
            {checking ? t("checking…") : t("check for updates")}
          </button>
        </div>
      </Panel>

      {board === "skill" ? <SkillBoard data={data} /> : null}
      {board === "rate" ? <RateBoard data={data} /> : null}
      {board === "combined" ? <CombinedBoard data={data} /> : null}
      {board === "redundancy" ? <RedundancyBoard data={data} /> : null}

      <Panel title={t("Sources")}>
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
          {t(
            "Benchmark scores move every month and vendor-run numbers flatter the vendor. The play button in the catalog is the only score that reflects your own key.",
          )}
        </p>
      </Panel>
    </>
  );
}

function SkillBoard({ data }: { data: RankingsResponse }) {
  const { t, lang } = useLang();
  return (
    <>
      {data.tiers.map((tier) => {
        const rows = data.skill.filter((entry) => entry.tierName === tier.name);
        return (
          <Panel
            key={tier.name}
            title={`${t("Tier")} ${tier.name}: ${loc(tier.label, tier.labelFr, lang)}`}
          >
            <p className="small muted" style={{ marginTop: 0 }}>
              {loc(tier.blurb, tier.blurbFr, lang)}
            </p>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>{t("Tier")}</th>
                  <th>{t("Model")}</th>
                  <th style={{ width: 120 }}>SWE-bench</th>
                  <th>{t("Provider")}</th>
                  <th>{t("Why")}</th>
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
                          title={`${t("Find")} ${entry.model} ${t("in the catalog")}`}
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
                            className="link-quiet"
                            href={`#/providers?q=${encodeURIComponent(entry.providerId)}`}
                            title={`${t("Open")} ${entry.providerId} ${t("in the provider catalog")}`}
                          >
                            {entry.providerId}
                          </a>
                        ) : (
                          t("vendor direct")
                        )}
                      </td>
                      <td className="small">{loc(entry.reason, entry.reasonFr, lang)}</td>
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
  const { t, lang } = useLang();
  return (
    <>
      <Panel title={t("Rate limits")}>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t(
            "Ordered by how much a provider gives away, not how good it is — a provider can top this board and still be useless for coding.",
          )}
        </p>
        <table>
          <thead>
            <tr>
              <th style={{ width: 56 }}>{t("Tier")}</th>
              <th>{t("Provider")}</th>
              <th>{t("Quota")}</th>
              <th style={{ width: 110 }}>{t("Source")}</th>
              <th style={{ width: 100 }}>{t("Reliability")}</th>
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
                  {entry.note ? (
                    <div className="small faint">{loc(entry.note, entry.noteFr, lang)}</div>
                  ) : null}
                </td>
                <td className="small">{entry.quota}</td>
                <td className="small muted">{t(provenanceLabel(entry))}</td>
                <td>
                  <span className={`badge ${reliabilityTone(entry)}`}>{t(entry.reliability)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={t("Dropped on purpose")}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 240 }}>{t("Provider")}</th>
              <th>{t("Why")}</th>
            </tr>
          </thead>
          <tbody>
            {data.dropList.map((entry) => (
              <tr key={entry.provider}>
                <td>{entry.provider}</td>
                <td className="small muted">{loc(entry.reason, entry.reasonFr, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function CombinedBoard({ data }: { data: RankingsResponse }) {
  const { t, lang } = useLang();
  return (
    <Panel title={t("What to actually use, in order")}>
      <table>
        <thead>
          <tr>
            <th style={{ width: 44 }}>#</th>
            <th style={{ width: 140 }}>{t("Provider")}</th>
            <th>{t("Model")}</th>
            <th>{t("Why")}</th>
          </tr>
        </thead>
        <tbody>
          {data.combined.map((entry) => (
            <tr key={entry.rank}>
              <td className="mono">{entry.rank}</td>
              <td className="mono small">{entry.providerId}</td>
              <td className="small">{entry.model}</td>
              <td className="small muted">{loc(entry.why, entry.whyFr, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hint-box" style={{ marginTop: 14 }}>
        {loc(data.bottomLine, data.bottomLineFr, lang)}
      </div>
      <p className="small faint" style={{ marginBottom: 0 }}>
        {t(
          "Six or seven providers is the practical ceiling here. Beyond that you are wiring the same models up twice and paying for it in cooldowns.",
        )}
      </p>
    </Panel>
  );
}

function RedundancyBoard({ data }: { data: RankingsResponse }) {
  const { t } = useLang();
  return (
    <Panel title={t("Duplicated model families")}>
      <p className="small muted" style={{ marginTop: 0 }}>
        {t(
          "Dozens of these providers resell the same underlying free pool. OpenRouter's free catalogue shows up almost verbatim on several others, so the redundancy is structural rather than accidental. Keep one of each row, and treat the rest as a fallback only.",
        )}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t("Model family")}</th>
            <th>{t("Also available on")}</th>
            <th style={{ width: 140 }}>{t("Keep")}</th>
            <th style={{ width: 140 }}>{t("Fallback")}</th>
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
