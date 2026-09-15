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

export function StatusDot({ status, title }: { status: CredentialStatus; title?: string }) {
  return <span className={`dot ${status}`} title={title ?? status} />;
}

const STATUS_WORD: Record<CredentialStatus, string> = {
  healthy: "healthy",
  cooldown: "cooling",
  invalid: "invalid",
  disabled: "paused",
  unverified: "new",
};

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

export function StatusBadge({ status }: { status: CredentialStatus }) {
  return <StatusPill status={status} />;
}

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
    <div
      className="overlay"

      onClick={(event) => {
        event.stopPropagation();
        onClose();
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
    </div>,
    document.body,
  );
}

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
