import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { ChainEntryView, ChainView, LiveRouteSnapshot, PublicCredential } from "../types.js";
import { CokeyMark } from "./Logo.js";
import { Empty } from "./Primitives.js";
import { useChainRefresh, type RefreshState } from "./useChainRefresh.js";

/**
 * The live route, drawn.
 *
 * A chain is the whole product, and it is invisible by default: a client sends
 * one request to one alias and never learns that four keys and two models were
 * involved. This diagram makes the hop sequence physical. The request enters on
 * the left, passes through the COKEY hub, and walks the nodes in the order they
 * will actually be tried, with each node's keys branching off it.
 *
 * It is driven by the same live route snapshot the topbar uses, so the node
 * that is currently serving lights up and a fallback is visible as it happens.
 */

const POLL_MS = 3000;

export function ChainFlow({
  chains,
  refreshKey,
  onChanged,
}: {
  chains: ChainView[];
  refreshKey: number;
  onChanged?: () => void;
}) {
  const [route, setRoute] = useState<LiveRouteSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const snapshot = await api.status(1);
        if (!cancelled) setRoute(snapshot.route);
      } catch {
        // The gateway may be restarting; the next tick picks it up.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  const selected = useMemo(() => {
    if (chains.length === 0) return null;
    return chains.find((chain) => chain.id === selectedId) ?? chains[0]!;
  }, [chains, selectedId]);

  const sweep = useChainRefresh(selected, () => onChanged?.());

  const activeAlias = route?.chainAlias;
  const activeEntryKey =
    route?.providerId && route?.model ? `${route.providerId}/${route.model}` : null;

  if (chains.length === 0) {
    return (
      <Empty>
        No chains yet. Create one in Chains, add a node, and the live route shows up here.
      </Empty>
    );
  }

  return (
    <div className={`flow${route?.active ? " flow-live" : ""}`}>
      <div className="flow-head">
        <div className="flow-pills" role="tablist" aria-label="Chains">
          {chains.map((chain) => {
            const live = activeAlias === chain.alias && route?.active;
            return (
              <button
                key={chain.id}
                type="button"
                role="tab"
                aria-selected={selected?.id === chain.id}
                className={`flow-pill${selected?.id === chain.id ? " active" : ""}${
                  live ? " live" : ""
                }`}
                onClick={() => setSelectedId(chain.id)}
              >
                <span className="flow-pill-dot" aria-hidden="true" />
                <span className="mono">{chain.alias}</span>
                <span className="flow-pill-count">{chain.entries.length}</span>
              </button>
            );
          })}
        </div>

        <div className="flow-meta small faint">
          {route?.active ? (
            <span className="badge">routing now</span>
          ) : route?.updatedAt ? (
            <span>idle, last request {new Date(route.updatedAt).toLocaleTimeString()}</span>
          ) : (
            <span>waiting for traffic</span>
          )}
          {route?.fallback ? <span className="badge warn">fallback active</span> : null}
        </div>

        <button
          type="button"
          className="ghost"
          onClick={() => void sweep.refresh()}
          disabled={sweep.busy}
          title={sweep.busy ? "Testing nodes…" : "Test every node and go to the first that answers"}
        >
          {sweep.busy ? "testing…" : "⟳ refresh"}
        </button>
      </div>

      <div className="flow-scroll">
        <div className="flow-track">
          <div className="flow-node flow-endpoint">
            <span className="flow-node-kicker">client</span>
            <span className="flow-node-title">your editor</span>
            <span className="flow-node-sub small faint">one base URL</span>
          </div>

          <FlowLink live={Boolean(route?.active)} />

          <div className="flow-node flow-hub">
            <CokeyMark height={22} className="flow-hub-mark" />
            <span className="flow-node-title mono">{selected?.alias ?? "COKEY"}</span>
            <span className="flow-node-sub small faint">alias clients call</span>
          </div>

          {selected && selected.entries.length > 0 ? (
            [...selected.entries]
              .sort((a, b) => a.priority - b.priority)
              .map((entry, index) => (
                <div className="flow-step" key={entry.id}>
                  <FlowLink
                    live={Boolean(route?.active)}
                    dead={
                      Boolean(activeEntryKey) &&
                      activeEntryKey !== `${entry.providerId}/${entry.model}`
                    }
                  />
                  <EntryNode
                    entry={entry}
                    index={index}
                    live={activeEntryKey === `${entry.providerId}/${entry.model}`}
                    activeCredentialId={route?.credentialId}
                    sweepState={sweep.states[entry.id] ?? "idle"}
                    current={sweep.winnerId === entry.id}
                  />
                </div>
              ))
          ) : (
            <>
              <FlowLink live={false} dead />
              <div className="flow-node flow-empty">
                <span className="flow-node-title">no nodes</span>
                <span className="flow-node-sub small faint">add one in Chains</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flow-legend small faint">
        <span className="legend-item">
          <i className="flow-key healthy" /> healthy
        </span>
        <span className="legend-item">
          <i className="flow-key cooldown" /> cooldown
        </span>
        <span className="legend-item">
          <i className="flow-key invalid" /> invalid
        </span>
        <span className="legend-item">
          <i className="flow-key unverified" /> unverified
        </span>
        {sweep.winnerId ? (
          <>
            <span className="spacer" />
            <span className="badge ok">current: first node that answered OK</span>
          </>
        ) : (
          <span className="spacer" />
        )}
        <span>nodes are tried top to bottom, keys left to right</span>
      </div>
    </div>
  );
}

/** The connector between two nodes: a rail with a pulse that travels it. */
function FlowLink({ live = false, dead = false }: { live?: boolean; dead?: boolean }) {
  return (
    <div className={`flow-link${live ? " live" : ""}${dead ? " dead" : ""}`} aria-hidden="true">
      <span className="flow-rail" />
      {live ? <span className="flow-pulse" /> : null}
    </div>
  );
}

function EntryNode({
  entry,
  index,
  live,
  activeCredentialId,
  sweepState,
  current,
}: {
  entry: ChainEntryView;
  index: number;
  live: boolean;
  activeCredentialId?: string;
  sweepState: RefreshState;
  current?: boolean;
}) {
  const failed =
    entry.credentials.length > 0 &&
    entry.credentials.every(
      (credential) => credential.status === "invalid" || credential.status === "disabled",
    );

  return (
    <div
      className={`flow-node flow-entry${live ? " live" : ""}${failed ? " dead" : ""}${
        sweepState !== "idle" ? ` sweep-${sweepState}` : ""
      }${current ? " sweep-current" : ""}`}
    >
      <div className="flow-node-top">
        <span className="flow-priority">{index + 1}</span>
        <span className="flow-node-title" title={entry.model}>
          {entry.label ?? entry.model}
        </span>
        {sweepState === "testing" ? <span className="badge neutral">testing…</span> : null}
        {sweepState === "ok" ? <span className="badge ok">ok</span> : null}
        {sweepState === "fail" ? <span className="badge bad">fail</span> : null}
        {current ? <span className="badge ok">current</span> : null}
      </div>
      <span className="flow-node-sub small faint">
        {entry.providerId}
        {entry.label ? ` / ${entry.model}` : ""}
      </span>
      <div className="flow-keys">
        {entry.credentials.length === 0 ? (
          <span className="small faint">no keys bound</span>
        ) : (
          entry.credentials.map((credential) => (
            <KeyDot
              key={credential.id}
              credential={credential}
              active={live && activeCredentialId === credential.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KeyDot({ credential, active }: { credential: PublicCredential; active: boolean }) {
  const title = `${credential.description} (${credential.status})${
    credential.proxy.auto ? " · auto egress" : credential.proxy.configured ? " · pinned egress" : ""
  }`;
  return (
    <span className={`flow-key ${credential.status}${active ? " active" : ""}`} title={title}>
      {active ? <span className="flow-key-ring" aria-hidden="true" /> : null}
    </span>
  );
}
