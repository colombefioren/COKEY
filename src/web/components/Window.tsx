import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { burstSparkles } from "../lib/motion.js";
import { IconChevron, IconClose } from "./Icons.js";
import { useLang } from "../lang.js";

export type WindowHue = "pink" | "lav" | "sky" | "butter" | "mint";

export interface WindowProps {
  title?: ReactNode;

  icon?: ReactNode;

  hue?: WindowHue;

  actions?: ReactNode;
  children: ReactNode;
  className?: string;

  collapsible?: boolean;

  defaultCollapsed?: boolean;

  onClose?: () => void;

  label?: string;
}

export function Window({
  title,
  icon,
  hue,
  actions,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
  onClose,
  label,
}: WindowProps) {
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyId = useId();
  const hasChrome =
    Boolean(title) || Boolean(icon) || Boolean(actions) || Boolean(onClose) || collapsible;

  return (
    <section
      className={`window${hue ? ` hue-${hue}` : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
    >
      {hasChrome ? (
        <header className="window-bar">
          {icon ? (
            <span className="window-icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}

          {title ? <span className="window-title">{title}</span> : null}

          {actions || collapsible || onClose ? (
            <div className="window-actions">
              {actions}
              {collapsible ? (
                <button
                  type="button"
                  className="window-control"
                  aria-label={collapsed ? t("Expand panel") : t("Collapse panel")}
                  aria-expanded={!collapsed}
                  aria-controls={bodyId}
                  onClick={() => setCollapsed((value) => !value)}
                >
                  <IconChevron className={collapsed ? "flip" : undefined} size={14} />
                </button>
              ) : null}
              {onClose ? (
                <button
                  type="button"
                  className="window-control"
                  aria-label={`${t("Close")} ${typeof title === "string" ? title : t("panel")}`}
                  onClick={onClose}
                >
                  <IconClose size={14} />
                </button>
              ) : null}
            </div>
          ) : null}
        </header>
      ) : null}

      <div className="window-body" id={bodyId} hidden={collapsible && collapsed}>
        {children}
      </div>
    </section>
  );
}

export function useSparkle<T extends HTMLElement>(
  hue: "butter" | "pink" | "mint" = "butter",
): {
  ref: React.RefObject<T>;
  celebrate: (count?: number) => void;
} {
  const ref = useRef<T>(null);

  const celebrate = useCallback(
    (count = 9) => {
      const node = ref.current;
      if (!node) return;
      burstSparkles(node, { count, hue });
    },
    [hue],
  );

  return { ref, celebrate };
}
