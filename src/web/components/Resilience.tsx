import type { ReactNode } from "react";
import { IconKey, IconRoute, IconSparkle } from "./Icons.js";

/**
 * The three failure scopes, drawn.
 *
 * The live route says where a request went. This says what happens when it
 * cannot go there: every failure COKEY knows about is contained at exactly one
 * scope, and a scope that was not affected is never disturbed. That is the whole
 * difference between a pool of keys and a gateway, and it is invisible from the
 * client, so it gets a picture.
 *
 * Written as three concrete stories - a chain, a key, a model - because the
 * scopes are easier to hold in the head as a picture than as a policy table.
 */

function LayerRow({
  index,
  icon,
  scope,
  title,
  blurb,
  notes,
  children,
}: {
  index: number;
  icon: ReactNode;
  scope: string;
  title: string;
  blurb: string;
  notes: string[];
  children: ReactNode;
}) {
  return (
    <div className={`layer tint-${index}`}>
      <div className="layer-badge" aria-hidden="true">
        {icon}
        <span className="layer-number">{index}</span>
      </div>
      <div className="layer-copy">
        <span className="layer-kicker">
          Layer {index} · scope: {scope}
        </span>
        <h4>{title}</h4>
        <p>{blurb}</p>
      </div>
      <div className="layer-track">{children}</div>
      <ul className="layer-notes">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function Rail() {
  return <span className="layer-rail" aria-hidden="true" />;
}

export function Resilience() {
  return (
    <section className="panel layers-panel">
      <div className="layer-head">
        <span className="layer-head-kicker">Resilience · 3 self-healing layers</span>
        <span className="layer-head-scope">scope · chain then key then model</span>
      </div>

      <h3 className="layer-title">
        The right layer for the right failure, so <em>one dead key never costs a whole chain</em>.
      </h3>

      <LayerRow
        index={1}
        icon={<IconRoute size={20} />}
        scope="whole chain"
        title="Chain fallback"
        blurb="A node that cannot serve is set aside and the request walks on to the next node in your order, instead of failing."
        notes={[
          "entered only once every key of the node is spent",
          "model_unavailable skips the node's remaining keys",
          "context_too_large and invalid_request stop instead",
        ]}
      >
        <span className="layer-node is-hub">
          <b>cokey-best</b>
          <small>the alias clients call</small>
        </span>
        <Rail />
        <div className="layer-stack">
          <span className="layer-key is-bad">
            <i aria-hidden="true" />
            node 1 · groq
            <em>set aside</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            node 2 · openrouter
            <em>next</em>
          </span>
        </div>
      </LayerRow>

      <LayerRow
        index={2}
        icon={<IconKey size={20} />}
        scope="one key"
        title="Key cooldown"
        blurb="A rate-limited key sits out while its siblings keep serving the same node. The client sees a slower answer, never an error."
        notes={[
          "catches 429, invalid key and provider 5xx",
          "Retry-After wins; otherwise 30s, 60s, 120s, 300s",
          "plus or minus 15% jitter, so keys never retry in lockstep",
        ]}
      >
        <span className="layer-node is-hub">
          <b>node 1</b>
          <small>3 keys bound</small>
        </span>
        <Rail />
        <div className="layer-stack">
          <span className="layer-key is-bad">
            <i aria-hidden="true" />
            key-1
            <em>cooling down</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            key-2
            <em>serving</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            key-3
            <em>ready</em>
          </span>
        </div>
      </LayerRow>

      <LayerRow
        index={3}
        icon={<IconSparkle size={20} />}
        scope="one model"
        title="Model gating"
        blurb="A model is offered only while its provider holds a key COKEY has verified, so a node can never be built against a key that does not work."
        notes={[
          "verified against the provider before it joins a chain",
          "against the exact model where the provider checks per model",
          "an expired cooldown comes back as unverified, not healthy",
        ]}
      >
        <span className="layer-node is-hub">
          <b>key-1</b>
          <small>proven against the provider</small>
        </span>
        <Rail />
        <div className="layer-stack">
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            model-a
            <em>offered</em>
          </span>
          <span className="layer-key is-locked">
            <i aria-hidden="true" />
            model-b
            <em>not offered</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            model-c
            <em>offered</em>
          </span>
        </div>
      </LayerRow>

      <p className="layer-footer mono">
        key 429 -&gt; cooldown · invalid key -&gt; rotate · node 5xx -&gt; fallback · context too
        large -&gt; stop · a lower node is never tried while a key above it can serve
      </p>
    </section>
  );
}
