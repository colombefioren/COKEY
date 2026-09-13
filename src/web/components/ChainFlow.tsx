import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { ChainEntryView, ChainView, LiveRouteSnapshot, PublicCredential } from "../types.js";
import { CokeyMark } from "./Logo.js";
import { Empty, StatusPill } from "./Primitives.js";
import { useChainRefresh, type RefreshState } from "./useChainRefresh.js";

/**
 * The live route, drawn as an actual node graph.
 *
 * A chain is the whole product, and it is invisible by default: a client sends
 * one request to one alias and never learns that four keys and two models were
 * involved. This diagram makes that physical: the client sits on the left, one
 * curved line runs to the COKEY hub, and the hub fans out to every node in the
 * order they will be tried, each carrying its own bound keys. It reads as a
 * network diagram because that is what a chain actually is — a routing
 * decision is a graph, not a table row.
 *
 * The fan-out geometry is computed in plain arithmetic (fixed node height and
 * gap, centred as a group) rather than measured from the DOM, so it never
 * needs a layout effect and never flashes un-positioned on the first paint.
 *
 * It is driven by the same live route snapshot the topbar uses, so the node
 * that is currently serving lights up and a fallback is visible as it happens.
 */

const POLL_MS = 3000;
const NODE_HEIGHT = 118;
const NODE_GAP = 18;
const GRAPH_MIN_HEIGHT = 420;
const HUB_X = 300;
const BRANCH_X = 640;
const CLIENT_X = 30;

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
  const count = Math.max(steps.length, 1);
  const stackHeight = count * NODE_HEIGHT + (count - 1) * NODE_GAP;
  const graphHeight = Math.max(GRAPH_MIN_HEIGHT, stackHeight + 48);
  const hubY = graphHeight / 2;
  const branchTop = hubY - stackHeight / 2;
  const branchMidX = (HUB_X + BRANCH_X) / 2;

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

      <div className="flow-graph" style={{ height: graphHeight }}>
        <svg className="flow-lines" width="100%" height={graphHeight} aria-hidden="true">
          <path
            className={`flow-path${route?.active ? " live" : ""}`}
            d={`M ${CLIENT_X + 190} ${hubY} C ${HUB_X - 70} ${hubY}, ${HUB_X - 70} ${hubY}, ${HUB_X} ${hubY}`}
          />
          {steps.length > 0 ? (
            steps.map((entry, index) => {
              const entryY = branchTop + index * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2;
              const isLive = activeEntryKey === `${entry.providerId}/${entry.model}`;
              const isDead = Boolean(activeEntryKey) && !isLive;
              return (
                <path
                  key={entry.id}
                  className={`flow-path${isLive ? " live" : ""}${isDead ? " dead" : ""}`}
                  d={`M ${HUB_X + 74} ${hubY} C ${branchMidX} ${hubY}, ${branchMidX} ${entryY}, ${BRANCH_X} ${entryY}`}
                />
              );
            })
          ) : (
            <path
              className="flow-path dead"
              d={`M ${HUB_X + 74} ${hubY} C ${branchMidX} ${hubY}, ${branchMidX} ${hubY}, ${BRANCH_X} ${hubY}`}
            />
          )}
        </svg>

        <div className="flow-node flow-client" style={{ top: hubY - 52 }}>
          <span className="flow-tape" aria-hidden="true" />
          <span className="flow-node-kicker">client</span>
          <span className="flow-node-title">your editor</span>
          <span className="flow-node-sub">one base URL</span>
        </div>

        <div className="flow-node flow-hub" style={{ top: hubY - 75, left: HUB_X - 75 }}>
          <span className="flow-hub-orb">
            <span className="flow-hub-ring" aria-hidden="true" />
            <CokeyMark height={22} />
          </span>
          <span className="flow-node-title mono">{selected?.alias ?? "COKEY"}</span>
          <span className="flow-node-kicker">alias</span>
        </div>

        {steps.length > 0 ? (
          steps.map((entry, index) => {
            const entryY = branchTop + index * (NODE_HEIGHT + NODE_GAP);
            return (
              <EntryNode
                key={entry.id}
                entry={entry}
                index={index}
                top={entryY}
                left={BRANCH_X}
                live={activeEntryKey === `${entry.providerId}/${entry.model}`}
                dead={
                  Boolean(activeEntryKey) &&
                  activeEntryKey !== `${entry.providerId}/${entry.model}`
                }
                activeCredentialId={route?.credentialId}
                sweepState={sweep.states[entry.id] ?? "idle"}
                current={sweep.winnerId === entry.id}
              />
            );
          })
        ) : (
          <div className="flow-node flow-empty" style={{ top: hubY - 52, left: BRANCH_X }}>
            <span className="flow-node-kicker">empty</span>
            <span className="flow-node-title">no nodes yet</span>
          </div>
        )}
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

function EntryNode({
  entry,
  index,
  top,
  left,
  live,
  dead,
  activeCredentialId,
  sweepState,
  current,
}: {
  entry: ChainEntryView;
  index: number;
  top: number;
  left: number;
  live: boolean;
  dead: boolean;
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
      className={`flow-node flow-entry${live ? " live" : ""}${dead ? " dead" : ""}${
        failed ? " failed" : ""
      }${sweepState !== "idle" ? ` sweep-${sweepState}` : ""}${current ? " sweep-current" : ""}`}
      style={{ top, left }}
    >
      <div className="flow-node-top">
        <span className="flow-stop">{index + 1}</span>
        <span className="flow-node-title" title={entry.model}>
          {entry.label ?? entry.model}
        </span>
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
        ) : live ? (
          <span className="flow-node-flag live">serving</span>
        ) : null}
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
