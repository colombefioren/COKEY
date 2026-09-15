import type { ReactNode } from "react";
import { IconKey, IconRoute, IconSparkle } from "./Icons.js";
import { useLang } from "../lang.js";

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
  const { t } = useLang();
  return (
    <div className={`layer tint-${index}`}>
      <div className="layer-badge" aria-hidden="true">
        {icon}
        <span className="layer-number">{index}</span>
      </div>
      <div className="layer-copy">
        <span className="layer-kicker">
          {t("scope")} · {t(scope)}
        </span>
        <h4>{t(title)}</h4>
        <p>{t(blurb)}</p>
      </div>
      <div className="layer-track">{children}</div>
      <ul className="layer-notes">
        {notes.map((note) => (
          <li key={note}>{t(note)}</li>
        ))}
      </ul>
    </div>
  );
}

function Rail() {
  return <span className="layer-rail" aria-hidden="true" />;
}

export function Resilience() {
  const { t } = useLang();
  return (
    <section className="panel layers-panel">
      <div className="layer-head">
        <span className="layer-head-kicker">{t("Resilience · three layers")}</span>
        <span className="layer-head-scope">{t("node, then key, then model")}</span>
      </div>

      <h3 className="layer-title">
        {t("One dead key never costs a")} <em>{t("whole chain")}</em>.
      </h3>

      <LayerRow
        index={1}
        icon={<IconRoute size={20} />}
        scope="whole chain"
        title="Chain fallback"
        blurb="A node that cannot serve is set aside and the request walks on."
        notes={[
          "entered once every key of that node is spent",
          "model_unavailable skips the node; context_too_large stops",
        ]}
      >
        <span className="layer-node is-hub">
          <b>cokey-best</b>
          <small>{t("the alias clients call")}</small>
        </span>
        <Rail />
        <div className="layer-stack">
          <span className="layer-key is-bad">
            <i aria-hidden="true" />
            {t("node 1 · groq")}
            <em>{t("set aside")}</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            {t("node 2 · openrouter")}
            <em>{t("next")}</em>
          </span>
        </div>
      </LayerRow>

      <LayerRow
        index={2}
        icon={<IconKey size={20} />}
        scope="one key"
        title="Key cooldown"
        blurb="A rate-limited key sits out. Its siblings keep serving the node."
        notes={[
          "catches 429, a rejected key and provider 5xx",
          "Retry-After wins; otherwise 30s → 60s → 120s → 300s, with jitter",
        ]}
      >
        <span className="layer-node is-hub">
          <b>{t("node 1")}</b>
          <small>3 {t("keys bound")}</small>
        </span>
        <Rail />
        <div className="layer-stack">
          <span className="layer-key is-bad">
            <i aria-hidden="true" />
            key-1
            <em>{t("cooling")}</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            key-2
            <em>{t("serving")}</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            key-3
            <em>{t("ready")}</em>
          </span>
        </div>
      </LayerRow>

      <LayerRow
        index={3}
        icon={<IconSparkle size={20} />}
        scope="one model"
        title="Model gating"
        blurb="A model is offered only while a verified key can reach it."
        notes={[
          "proven against the provider before it joins a chain",
          "an expired cooldown returns as unverified, never healthy",
        ]}
      >
        <span className="layer-node is-hub">
          <b>key-1</b>
          <small>{t("proven")}</small>
        </span>
        <Rail />
        <div className="layer-stack">
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            model-a
            <em>{t("offered")}</em>
          </span>
          <span className="layer-key is-locked">
            <i aria-hidden="true" />
            model-b
            <em>{t("not offered")}</em>
          </span>
          <span className="layer-key is-ok">
            <i aria-hidden="true" />
            model-c
            <em>{t("offered")}</em>
          </span>
        </div>
      </LayerRow>

      <p className="layer-footer mono">
        {t(
          "key 429 → cooldown · rejected key → rotate · node 5xx → fallback · context too large → stop",
        )}
      </p>
    </section>
  );
}
