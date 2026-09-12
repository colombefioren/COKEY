import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError, timeAgo } from "../api.js";
import type { UsageProviderView, UsageView } from "../types.js";
import {
  Empty,
  Panel,
  Stat,
  StatusDot,
  formatDuration,
  formatNumber,
} from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

/** Usage vs limits, per provider, key and model, plus the live route. */
export function Usage({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [view, setView] = useState<UsageView | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.usage();
      setView(result);
      setProviderId((current) => current ?? result.providers[0]?.providerId ?? null);
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const provider: UsageProviderView | undefined = useMemo(
    () => view?.providers.find((candidate) => candidate.providerId === providerId),
    [view, providerId],
  );

  useEffect(() => {
    if (!provider) {
      setModel(null);
      return;
    }
    setModel((current) =>
      current && provider.models.some((entry) => entry.model === current)
        ? current
        : (provider.models[0]?.model ?? null),
    );
  }, [provider]);

  const selectedModel = provider?.models.find((entry) => entry.model === model);

  const monthTotals = useMemo(() => {
    const rows = provider?.daily ?? [];
    return {
      requests: rows.reduce((sum, row) => sum + row.requests, 0),
      inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
      outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
    };
  }, [provider]);

  if (!view) return <Empty>Loading usage…</Empty>;

  const now = view.now;

  return (
    <>
      <Panel title="Serving now">
        {now.active ? (
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <span className="badge">{now.chainAlias}</span>
            <span className="mono">
              {now.providerId} / {now.model}
            </span>
            <span className="small">
              <StatusDot status="healthy" /> {now.credentialDescription ?? now.credentialId}
              {now.maskedSecret ? (
                <span className="mono small faint"> {now.maskedSecret}</span>
              ) : null}
            </span>
            {now.proxyLabel ? (
              <span className="chip-proxy mono small">⇢ {now.proxyLabel}</span>
            ) : null}
            {now.fallback ? <span className="badge warn">fallback</span> : null}
            <span className="small faint">{now.attempts} attempt(s)</span>
            {now.startedAt ? (
              <span className="small faint">started {timeAgo(now.startedAt)}</span>
            ) : null}
          </div>
        ) : (
          <Empty>
            Idle. The next request shows the chain, node and sub-key it lands on here.
            {now.lastOutcome ? ` Last route: ${now.lastOutcome}.` : ""}
          </Empty>
        )}
      </Panel>

      <Panel title="Chain state">
        {view.chains.length === 0 ? (
          <Empty>No chains configured.</Empty>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {view.chains.map((chain) => (
              <div key={chain.id} className="model-provider">
                <header>
                  <strong className="mono">{chain.alias}</strong>
                  {chain.enabled ? null : <span className="badge warn">disabled</span>}
                  <span className="spacer" />
                  <span className="small faint">{chain.entries.length} nodes</span>
                </header>
                <div style={{ display: "grid", gap: 6 }}>
                  {chain.entries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="row"
                      style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <span className="small faint">{index + 1}.</span>
                      <span className="mono">
                        {entry.providerId} / {entry.model}
                      </span>
                      {entry.enabled ? null : <span className="badge warn">off</span>}
                      <span className="badge">{entry.routingStrategy}</span>
                      <span className="small faint">keys:</span>
                      {entry.credentials.length === 0 ? (
                        <span className="badge bad">none</span>
                      ) : (
                        entry.credentials.map((credential) => (
                          <span
                            key={credential.id}
                            className="cred-chip"
                            title={`${credential.status}${credential.active ? " · serving now" : ""}`}
                            style={credential.active ? { borderColor: "var(--ok)" } : undefined}
                          >
                            <StatusDot status={credential.status as never} />
                            {credential.description}
                            {credential.active ? <span className="badge">now</span> : null}
                          </span>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Usage by provider">
        {view.providers.length === 0 ? (
          <Empty>No usage recorded yet. Send a request to /v1/chat/completions.</Empty>
        ) : (
          <>
            <div className="tabs" style={{ marginBottom: 12 }}>
              {view.providers.map((entry) => (
                <button
                  key={entry.providerId}
                  className="tab"
                  aria-selected={entry.providerId === providerId}
                  onClick={() => setProviderId(entry.providerId)}
                  type="button"
                >
                  {entry.displayName}
                </button>
              ))}
            </div>

            {provider ? (
              <>
                <div className="grid cards">
                  <Stat label="Models used" value={provider.models.length} />
                  <Stat label="Keys" value={provider.credentials.length} />
                  <Stat label="30-day requests" value={formatNumber(monthTotals.requests)} />
                  <Stat
                    label="30-day tokens"
                    value={formatNumber(monthTotals.inputTokens + monthTotals.outputTokens)}
                    hint={`${formatNumber(monthTotals.inputTokens)} in · ${formatNumber(monthTotals.outputTokens)} out`}
                  />
                </div>

                <div className="row" style={{ gap: 6, flexWrap: "wrap", margin: "14px 0" }}>
                  {provider.models.length === 0 ? (
                    <span className="small faint">No model usage yet.</span>
                  ) : (
                    provider.models.map((entry) => (
                      <button
                        key={entry.model}
                        className={entry.model === model ? "secondary" : "ghost"}
                        onClick={() => setModel(entry.model)}
                        type="button"
                        title={`${entry.requests} requests`}
                      >
                        {entry.model}
                      </button>
                    ))
                  )}
                </div>

                {selectedModel ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="row" style={{ gap: 20, flexWrap: "wrap" }}>
                      <span className="small">
                        {formatNumber(selectedModel.requests)} req ·{" "}
                        {formatNumber(selectedModel.success)} ok ·{" "}
                        {formatNumber(selectedModel.failure)} failed
                      </span>
                      <span className="small muted">
                        {formatNumber(selectedModel.inputTokens)} in ·{" "}
                        {formatNumber(selectedModel.outputTokens)} out
                      </span>
                      <span className="small faint">
                        avg {formatDuration(selectedModel.averageLatencyMs)}
                      </span>
                    </div>

                    <table>
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>State</th>
                          <th>Requests</th>
                          <th>Tokens in / out</th>
                          <th>Rate / min</th>
                          <th>Quota vs limit</th>
                          <th>Reset</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.credentials.map((credential) => {
                          const usage = selectedModel.perCredential.find(
                            (entry) => entry.credentialId === credential.id,
                          );
                          const quota = credential.quota;
                          return (
                            <tr key={credential.id}>
                              <td>
                                <span className="mono small">{credential.description}</span>
                                <div className="mono small faint">{credential.maskedSecret}</div>
                              </td>
                              <td>
                                <StatusDot status={credential.status} />
                                <span className="small"> {credential.status}</span>
                              </td>
                              <td className="small">{formatNumber(usage?.requests ?? 0)}</td>
                              <td className="small muted">
                                {formatNumber(usage?.inputTokens ?? 0)} /{" "}
                                {formatNumber(usage?.outputTokens ?? 0)}
                              </td>
                              <td className="small">{credential.rate.requestsPerMinute}/min</td>
                              <td className="small">
                                <QuotaVsLimit quota={quota} />
                              </td>
                              <td className="small faint">
                                {quota?.available && quota.resetAt ? timeAgo(quota.resetAt) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>No model usage for this provider yet.</Empty>
                )}

                <h4 style={{ marginTop: 20 }}>Daily rollup</h4>
                {provider.daily.length === 0 ? (
                  <Empty>No daily totals yet.</Empty>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Requests</th>
                        <th>Tokens in</th>
                        <th>Tokens out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.daily.map((day) => (
                        <tr key={day.day}>
                          <td className="mono small">
                            {day.day}
                            {day.day === view.today ? <span className="badge"> today</span> : null}
                          </td>
                          <td className="small">{formatNumber(day.requests)}</td>
                          <td className="small muted">{formatNumber(day.inputTokens)}</td>
                          <td className="small muted">{formatNumber(day.outputTokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}

/**
 * Remaining quota against the declared limit, or an honest "unknown".
 *
 * Providers rarely expose limits, so a missing number is shown as "no declared
 * limit" rather than a fabricated bar.
 */
function QuotaVsLimit({
  quota,
}: {
  quota?: UsageView["providers"][number]["credentials"][number]["quota"];
}) {
  if (!quota || !quota.available) return <span className="faint">no declared limit</span>;

  const parts: string[] = [];
  if (typeof quota.requestsRemaining === "number")
    parts.push(`${formatNumber(quota.requestsRemaining)} req left`);
  if (typeof quota.tokensRemaining === "number")
    parts.push(`${formatNumber(quota.tokensRemaining)} tok left`);
  if (typeof quota.requestsPerMinute === "number") parts.push(`${quota.requestsPerMinute} RPM`);
  if (typeof quota.tokensPerMinute === "number")
    parts.push(`${formatNumber(quota.tokensPerMinute)} TPM`);
  if (parts.length === 0) return <span className="faint">no declared limit</span>;

  return (
    <span className="muted" title={`source: ${quota.source}`}>
      {parts.join(" · ")}
      <span className="faint small"> ({quota.source})</span>
    </span>
  );
}
