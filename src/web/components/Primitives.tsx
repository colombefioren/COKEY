import type { ReactNode } from "react";
import type { CredentialStatus } from "../types.js";

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

export function Panel({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel-head">
          {title ? <h2>{title}</h2> : null}
          <span className="spacer" />
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
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
  return (
    <div
      className="overlay"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="presentation"
    >
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
    </div>
  );
}

/** Human-readable duration, matching the CLI's formatting. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/** A credential's quota, or an explicit "unknown" — never a fabricated value. */
export function QuotaLabel({ quota }: { quota?: { available: boolean; requestsRemaining?: number; tokensRemaining?: number; requestsPerMinute?: number } }) {
  if (!quota || !quota.available) return <span className="faint">Quota: Unknown</span>;

  const parts: string[] = [];
  if (typeof quota.requestsRemaining === "number") parts.push(`${quota.requestsRemaining} req left`);
  if (typeof quota.tokensRemaining === "number") parts.push(`${formatNumber(quota.tokensRemaining)} tok left`);
  if (typeof quota.requestsPerMinute === "number") parts.push(`${quota.requestsPerMinute} RPM`);
  if (parts.length === 0) return <span className="faint">Quota: Unknown</span>;
  return <span className="muted">{parts.join(" · ")}</span>;
}
