import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CredentialRate, CredentialStatus } from "../types.js";
import { Window, type WindowHue } from "./Window.js";

/** Coloured status indicator for a credential. */
export function StatusDot({ status, title }: { status: CredentialStatus; title?: string }) {
  return <span className={`dot ${status}`} title={title ?? status} />;
}

export function StatusBadge({ status }: { status: CredentialStatus }) {
  const tone =
    status === "healthy"
      ? ""
      : status === "cooldown"
        ? "warn"
        : status === "invalid"
          ? "bad"
          : "neutral";
  return <span className={`badge ${tone}`}>{status}</span>;
}

/**
 * A titled content block.
 *
 * Thin wrapper over the Window component so every screen on the dashboard gets
 * the same mock-OS chrome from one definition. The `panel` class is carried
 * alongside `window` because a couple of hand-rolled sections still select it.
 *
 * `hue` is usually left unset: the stylesheet alternates hues down a page so a
 * stack of panels is colour-blocked without each call site choosing a colour.
 */
export function Panel({
  title,
  actions,
  children,
  hue,
  icon,
  label,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  hue?: WindowHue;
  icon?: ReactNode;
  label?: string;
}) {
  return (
    <Window title={title} actions={actions} hue={hue} icon={icon} label={label} className="panel">
      {children}
    </Window>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

/**
 * Simple confirmation dialog.
 *
 * Presents a message and two buttons: a left "Cancel" (ghost) and a right
 * primary action (danger by default) labelled `actionLabel`.
 */
export function ConfirmModal({
  title,
  message,
  onConfirm,
  onClose,
  actionLabel = "Delete",
  danger = true,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  actionLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ margin: 0 }}>{message}</p>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button className={danger ? "danger" : "secondary"} onClick={onConfirm}>
          {actionLabel}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Prompt-style modal with a text input.
 *
 * Pre-fills `defaultValue`, submits on Enter, and renders the value as a
 * password field when `type` is `"password"`.
 */
export function PromptModal({
  title,
  message,
  defaultValue = "",
  onSubmit,
  onClose,
  placeholder,
  type = "text",
}: {
  title: string;
  message: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ margin: 0 }}>{message}</p>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit(value.trim());
          }
        }}
        autoFocus
        style={{ width: "100%", marginTop: 12, boxSizing: "border-box" }}
      />
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button onClick={() => onSubmit(value.trim())}>OK</button>
      </div>
    </Modal>
  );
}

/** Overlay modal. Escape closes; clicking the backdrop closes. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={wide ? { width: "min(820px, 100%)" } : undefined}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3>{title}</h3>
        {subtitle ? <div className="modal-sub">{subtitle}</div> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Human-readable duration, matching the CLI's formatting. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Twelve 5-second buckets covering the trailing minute.
 *
 * Deliberately tiny and unlabeled: the exact numbers live in the tooltip, the
 * shape is what tells a user at a glance whether one key is doing all the work.
 */
export function Sparkline({ buckets, title }: { buckets: number[]; title?: string }) {
  const max = Math.max(1, ...buckets);
  return (
    <span className="spark" title={title}>
      {buckets.map((value, index) => (
        <i key={index} style={{ height: `${Math.max(2, Math.round((value / max) * 14))}px` }} />
      ))}
    </span>
  );
}

/**
 * Observed throughput for one credential.
 *
 * "VPM" here means verified requests per minute, measured locally by COKEY -
 * not a provider-declared quota. It is the only way to tell two keys of the
 * same provider apart.
 */
export function RateLabel({ rate, compact }: { rate?: CredentialRate; compact?: boolean }) {
  if (!rate || rate.lastRequestAt === undefined) {
    return <span className="faint small">idle</span>;
  }

  const title =
    `${rate.requestsPerMinute} req in the last minute · ${rate.requestsLast5Minutes} in the last 5 min` +
    (rate.recentlyRateLimited ? " · rate limited recently" : "");

  return (
    <span className={`rate ${rate.recentlyRateLimited ? "limited" : ""}`} title={title}>
      <Sparkline buckets={rate.sparkline} title={title} />
      {compact ? null : (
        <span className="mono small">
          {rate.requestsPerMinute}/min
          {rate.recentlyRateLimited ? " ⚠" : ""}
        </span>
      )}
    </span>
  );
}

/** A credential's quota, or an explicit "unknown" - never a fabricated value. */
export function QuotaLabel({
  quota,
  quotaErrors,
}: {
  quota?: {
    available: boolean;
    requestsRemaining?: number;
    tokensRemaining?: number;
    requestsPerMinute?: number;
  };
  quotaErrors?: number;
}) {
  if (quotaErrors && quotaErrors > 0) {
    return <span className="badge bad" title={`${quotaErrors} quota exhaustion(s) observed`}>exhausted</span>;
  }
  if (!quota || !quota.available) return <span className="faint">Quota: Unknown</span>;

  const parts: string[] = [];
  if (typeof quota.requestsRemaining === "number")
    parts.push(`${quota.requestsRemaining} req left`);
  if (typeof quota.tokensRemaining === "number")
    parts.push(`${formatNumber(quota.tokensRemaining)} tok left`);
  if (typeof quota.requestsPerMinute === "number") parts.push(`${quota.requestsPerMinute} RPM`);
  if (parts.length === 0) return <span className="faint">Quota: Unknown</span>;
  return <span className="muted">{parts.join(" · ")}</span>;
}
