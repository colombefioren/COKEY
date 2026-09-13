import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { ChainEntryView, ChainView, LiveRouteSnapshot, PublicCredential } from "../types.js";
import { CokeyMark } from "./Logo.js";
import { Empty, StatusPill } from "./Primitives.js";
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
 * It is drawn rather than tabulated: one inked rail runs the length of the
 * journey, every stop is a pebble with a hand-numbered tab, and the token that
 * travels the rail carries the brand ramp. A routing decision is a sequence, so
 * the picture of it should be a path, not a row of cards.
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
    return <Empty>No chains yet. Create one in Chains and the route draws itself here.</Empty>;
  }

  const steps = selected ? [...selected.entries].sort((a, b) => a.priority - b.priority) : [];

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

        <div className="flow-meta">
          {route?.active ? (
            <span className="flow-state live">
              <i aria-hidden="true" />
              routing
            </span>
          ) : route?.updatedAt ? (
            <span className="flow-state">
              idle · {new Date(route.updatedAt).toLocaleTimeString()}
            </span>
          ) : (
            <span className="flow-state">waiting</span>
          )}
          {route?.fallback ? <span className="flow-state warn">fallback</span> : null}
        </div>

        <button
          type="button"
          className="flow-sweep"
          onClick={() => void sweep.refresh()}
          disabled={sweep.busy}
          title="Test every node and keep the first that answers"
        >
          {sweep.busy ? "testing" : "test all"}
        </button>
      </div>

      <div className="flow-scroll">
        <div className="flow-track">
          <div className="flow-node flow-endpoint">
            <span className="flow-node-kicker">client</span>
            <span className="flow-node-title">editor</span>
          </div>

          <FlowLink live={Boolean(route?.active)} />

          <div className="flow-node flow-hub">
            <span className="flow-hub-orb">
              <span className="flow-hub-ring" aria-hidden="true" />
              <CokeyMark height={24} />
            </span>
            <span className="flow-node-title mono">{selected?.alias ?? "COKEY"}</span>
            <span className="flow-node-kicker">alias</span>
          </div>

          {steps.length > 0 ? (
            <>
              {steps.map((entry, index) => (
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
              ))}
              <FlowLink live={Boolean(route?.active)} dead={Boolean(activeEntryKey)} />
              <div className="flow-node flow-cap">
                <span className="flow-node-kicker">reply</span>
              </div>
            </>
          ) : (
            <>
              <FlowLink live={false} dead />
              <div className="flow-node flow-empty">
                <span className="flow-node-kicker">empty</span>
                <span className="flow-node-title">no nodes</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flow-legend">
        <StatusPill status="healthy" />
        <StatusPill status="cooldown" />
        <StatusPill status="invalid" />
        <StatusPill status="unverified" />
        <span className="spacer" />
        {sweep.winnerId ? (
          <span className="flow-legend-note ok">current · first node that answered</span>
        ) : (
          <span className="flow-legend-note">tried top to bottom</span>
        )}
      </div>
    </div>
  );
}

/** The connector between two nodes: an inked rail with a token that travels it. */
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
        <span className="flow-stop">{index + 1}</span>
        <span className="flow-node-title" title={entry.model}>
          {entry.label ?? entry.model}
        </span>
      </div>
      <span className="flow-node-sub mono">{entry.providerId}</span>
      <div className="flow-keys">
        {entry.credentials.length === 0 ? (
          <span className="flow-keys-empty">no keys</span>
        ) : (
          entry.credentials.map((credential) => (
            <KeyChip
              key={credential.id}
              credential={credential}
              active={live && activeCredentialId === credential.id}
            />
          ))
        )}
      </div>
      {sweepState !== "idle" || current ? (
        <span className="flow-node-flag">
          {current
            ? "current"
            : sweepState === "testing"
              ? "testing"
              : sweepState === "ok"
                ? "ok"
                : "fail"}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One bound key, as a capsule.
 *
 * The state is carried by the capsule's own fill and glyph rather than by a
 * coloured square, so a row of twelve keys can be read at a glance without a
 * legend lookup — and the tooltip still holds the exact description.
 */
function KeyChip({ credential, active }: { credential: PublicCredential; active: boolean }) {
  const title = `${credential.description} (${credential.status})${
    credential.proxy.auto ? " · auto egress" : credential.proxy.configured ? " · pinned egress" : ""
  }`;
  return (
    <span className={`flow-key ${credential.status}${active ? " active" : ""}`} title={title}>
      {active ? <span className="flow-key-ring" aria-hidden="true" /> : null}
    </span>
  );
}
