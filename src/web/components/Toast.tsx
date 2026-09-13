import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { burstSparkles } from "../lib/motion.js";

type ToastKind = "info" | "ok" | "err";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  info: (message: string) => void;
  ok: (message: string) => void;
  err: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

/** How long a toast lives. Mirrored by `.toast::after` in surfaces.css. */
const TOAST_MS = 4000;

/**
 * Minimal toast queue: no dependency, auto-dismissing, capped at five.
 *
 * Each toast is a tag with a state rule down its leading edge, a glyph, and a
 * hairline that drains over the time it has left — so how long it will stay is
 * something you can see rather than remember. Clicking anywhere on one dismisses
 * it, because a notice you have already read should cost one gesture.
 *
 * A success also fires a small star burst from the toast itself. That is the one
 * reward in the UI, and it is deliberately tied to this theme's motif rather
 * than pulled in from a generic confetti library — which is also why it lives in
 * the motion helper rather than here.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nodes = useRef(new Map<number, HTMLDivElement>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    nodes.current.delete(id);
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-4), { id, message, kind }]);

      if (kind === "ok") {
        // Wait one frame so the node exists before anchoring a burst to it.
        window.requestAnimationFrame(() => {
          const node = nodes.current.get(id);
          if (node) burstSparkles(node, { count: 7, hue: "butter" });
        });
      }

      setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      info: (message) => push(message, "info"),
      ok: (message) => push(message, "ok"),
      err: (message) => push(message, "err"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            ref={(node) => {
              if (node) nodes.current.set(toast.id, node);
              else nodes.current.delete(toast.id);
            }}
            className={`toast ${toast.kind === "info" ? "" : toast.kind}`}
            role="status"
            onClick={() => dismiss(toast.id)}
            title="Dismiss"
          >
            <span className="toast-glyph" aria-hidden="true" />
            <span className="toast-text">{toast.message}</span>
            <span className="toast-close" aria-hidden="true">
              ×
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
