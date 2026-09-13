import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { burstSparkles } from "../lib/motion.js";
import { IconChevron, IconClose } from "./Icons.js";

/** The five blocked hues a window can take. */
export type WindowHue = "pink" | "lav" | "sky" | "butter" | "mint";

export interface WindowProps {
  /** Shown in the title bar. Omit for a chrome-less panel. */
  title?: ReactNode;
  /** A small pixel icon, placed before the title. */
  icon?: ReactNode;
  /**
   * Which colour this window is. Sections are blocked rather than tinted, so
   * this decides the title bar and nothing else.
   *
   * Left unset, the stylesheet alternates hues down the page so a stack of
   * windows is colour-blocked without every call site naming a colour. Set it
   * only when a specific section should own a specific hue.
   */
  hue?: WindowHue;
  /** Buttons for the right end of the title bar. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * When true the minimise light genuinely collapses the body, which is a real
   * affordance on a long dashboard. Off by default so the lights stay purely
   * decorative rather than promising behaviour that is not there.
   */
  collapsible?: boolean;
  /** Default collapsed state, only meaningful with `collapsible`. */
  defaultCollapsed?: boolean;
  /**
   * Turns the close light into a working button. Without it the lights are
   * marked `aria-hidden`, because a control that does nothing is worse than no
   * control.
   */
  onClose?: () => void;
  /** Accessible name for the window, when the title alone is not enough. */
  label?: string;
}

/**
 * A mock operating-system window.
 *
 * Every content block on the dashboard is one of these: a title bar with
 * stoplight lights, a hard outline and a solid offset shadow. The component
 * carries no data of its own, which is what lets a page be built out of pure
 * composition and lets the visual language change in one place.
 */
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
                  aria-label={collapsed ? "Expand panel" : "Collapse panel"}
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
                  aria-label={`Close ${typeof title === "string" ? title : "panel"}`}
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

/**
 * A star burst anchored to whatever succeeded.
 *
 * Returned as a hook rather than a component so the celebration can be fired
 * from the exact place the success is known about — the end of a key
 * verification, a green probe, a saved chain — instead of being inferred from a
 * render. The reward is tied to the theme (little hard-edged stars) rather than
 * a generic confetti library.
 */
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
