import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type OptionHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { CredentialRate, CredentialStatus } from "../types.js";
import { Window, type WindowHue } from "./Window.js";
import { useLang } from "../lang.js";
import { IconCheck, IconChevron } from "./Icons.js";

/** Coloured status indicator for a credential. */
export function StatusDot({ status, title }: { status: CredentialStatus; title?: string }) {
  return <span className={`dot ${status}`} title={title ?? status} />;
}

/**
 * One word for each state, in the reader's language rather than the database's.
 * "Cooling" is something a person can be; "cooldown" is a field name.
 */
const STATUS_WORD: Record<CredentialStatus, string> = {
  healthy: "healthy",
  cooldown: "cooling",
  invalid: "invalid",
  disabled: "paused",
  unverified: "new",
};

/**
 * A credential's state, as a pill with its own silhouette.
 *
 * Every state is drawn differently, not merely tinted differently: a burst for
 * healthy, a crescent for cooling, a crack for invalid, a dotted ring for one
 * that has never been proven, a bar for paused. Shape survives a colourblind
 * reader and a greyscale screenshot — which a row of identical dots does not,
 * and a row of identical dots was the whole problem.
 *
 * `compact` drops the word and keeps the mark, for places already labelled by
 * their column or legend.
 */
export function StatusPill({ status, compact }: { status: CredentialStatus; compact?: boolean }) {
  const { t } = useLang();
  const word = t(STATUS_WORD[status]);
  return (
    <span
      className={`status-pill ${status}${compact ? " compact" : ""}`}
      title={compact ? word : undefined}
    >
      <span className="status-glyph" aria-hidden="true" />
      {compact ? (
        <span className="sr-only">{word}</span>
      ) : (
        <span className="status-word">{word}</span>
      )}
    </span>
  );
}

/** Kept as the table-facing name for the same pill, so call sites read naturally. */
export function StatusBadge({ status }: { status: CredentialStatus }) {
  return <StatusPill status={status} />;
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
  actionLabel,
  danger = true,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  actionLabel?: string;
  danger?: boolean;
}) {
  const { t } = useLang();
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ margin: 0 }}>{message}</p>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button className={danger ? "danger" : "secondary"} onClick={onConfirm}>
          {actionLabel ?? t("Delete")}
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
  const { t } = useLang();
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
          {t("Cancel")}
        </button>
        <button onClick={() => onSubmit(value.trim())}>{t("OK")}</button>
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
  const { t } = useLang();
  if (!rate || rate.lastRequestAt === undefined) {
    return <span className="faint small">{t("idle")}</span>;
  }

  const title =
    `${rate.requestsPerMinute} ${t("req in the last minute")} · ${rate.requestsLast5Minutes} ${t("in the last 5 min")}` +
    (rate.recentlyRateLimited ? ` · ${t("rate limited recently")}` : "");

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
  status,
}: {
  quota?: {
    available: boolean;
    requestsRemaining?: number;
    tokensRemaining?: number;
    requestsPerMinute?: number;
  };
  quotaErrors?: number;
  status?: string;
}) {
  const { t } = useLang();
  // quotaErrors is a lifetime counter, so it stays > 0 long after a key has
  // recovered - only read it while the credential is still actually cooling
  // down, or a key that failed once would show "exhausted" forever.
  if (status === "cooldown" && quotaErrors && quotaErrors > 0) {
    return (
      <span className="badge bad" title={`${quotaErrors} ${t("quota exhaustion(s) observed")}`}>
        {t("exhausted")}
      </span>
    );
  }
  if (!quota || !quota.available) return <span className="faint">{t("Quota: Unknown")}</span>;

  const parts: string[] = [];
  if (typeof quota.requestsRemaining === "number")
    parts.push(`${quota.requestsRemaining} ${t("req left")}`);
  if (typeof quota.tokensRemaining === "number")
    parts.push(`${formatNumber(quota.tokensRemaining)} ${t("tok left")}`);
  if (typeof quota.requestsPerMinute === "number") parts.push(`${quota.requestsPerMinute} RPM`);
  if (parts.length === 0) return <span className="faint">{t("Quota: Unknown")}</span>;
  return <span className="muted">{parts.join(" · ")}</span>;
}

/**
 * A dropdown COKEY actually draws, instead of a native `<select>`.
 *
 * The closed control can be styled all day; the open list a browser draws for
 * a native select cannot be touched at all, which is what made every dropdown
 * in the app look like it belonged to a different program. This renders its
 * own floating panel in a portal (so a modal's `overflow: hidden` never clips
 * it), positioned against the trigger's real screen coordinates and flipped
 * upward when there is more room above than below.
 *
 * The API deliberately mirrors a native select — pass `<option>` children,
 * read `value`, get a new value back — so swapping one in is a tag rename,
 * not a rewrite of the surrounding form.
 */
export function Select({
  id,
  value,
  onChange,
  disabled,
  style,
  className,
  children,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [geometry, setGeometry] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    return Children.toArray(children)
      .filter(isValidElement)
      .map((element) => {
        const props = element.props as OptionHTMLAttributes<HTMLOptionElement>;
        return {
          value: String(props.value ?? ""),
          label: props.children,
          disabled: props.disabled,
        };
      });
  }, [children]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  const openMenu = () => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    setGeometry({
      top: openUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUp,
    });
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    // A dropdown that stays open under the content it should be layering
    // above defeats the point of a portal; scrolling anywhere else closes it
    // rather than tracking a stale position.
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((current) => Math.min(options.length - 1, current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((current) => Math.max(0, current - 1));
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = options[highlight];
        if (option && !option.disabled) {
          onChange(option.value);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, options, highlight, onChange]);

  // Keep the highlighted row in view as arrow keys move past the fold.
  useLayoutEffect(() => {
    if (!open) return;
    const row = panelRef.current?.querySelector(`[data-index="${highlight}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`select-trigger${className ? ` ${className}` : ""}`}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className="select-value">{selected?.label ?? value}</span>
        <IconChevron className={open ? "flip" : undefined} size={13} />
      </button>

      {open && geometry
        ? createPortal(
            <div
              ref={panelRef}
              className={`select-panel${geometry.openUp ? " up" : ""}`}
              role="listbox"
              style={{
                position: "fixed",
                left: geometry.left,
                width: geometry.width,
                ...(geometry.openUp
                  ? { bottom: window.innerHeight - geometry.top }
                  : { top: geometry.top }),
              }}
            >
              {options.map((option, index) => (
                <div
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled}
                  className={`select-option${index === highlight ? " active" : ""}${
                    option.value === value ? " selected" : ""
                  }${option.disabled ? " disabled" : ""}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="select-option-check">
                    {option.value === value ? <IconCheck size={12} /> : null}
                  </span>
                  <span className="select-option-label">{option.label}</span>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * A tooltip that reads as a spoken word, not an OS hint box.
 *
 * A native `title` attribute answers "what is this" with the browser's own
 * plain grey rectangle, on its own timer, in its own font — the one part of
 * an icon-only button the app's own theme never reached. This draws a small
 * pill in the brand's own pink-to-violet instead, with a tail pointing at
 * whatever it is labelling and a soft pop-in so it reads as part of the
 * interface rather than a system aside.
 *
 * Positioned in a portal against the trigger's real screen coordinates so it
 * is never clipped by a scrolling list or a card's own `overflow`.
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: side === "top" ? rect.top : rect.bottom,
      left: rect.left + rect.width / 2,
    });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={anchorRef}
      className="tooltip-anchor"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos
        ? createPortal(
            <span
              className={`tooltip-bubble ${side}`}
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
