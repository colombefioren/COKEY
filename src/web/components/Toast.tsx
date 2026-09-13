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

/**
 * Minimal toast queue: no dependency, auto-dismissing, capped at five.
 *
 * A success fires a small star burst from the toast itself. That is the one
 * reward in the UI, and it is deliberately tied to this theme's motif rather
 * than pulled in from a generic confetti library — which is also why it lives
 * in the motion helper rather than here.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>(
    []);
  const nodes = useRef(new Map<number, HTMLDivElement>());

  const push = useCallback((message: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-4), { id, message, kind }]);

    if (kind === "ok") {
      // Wait one frame so the node exists before anchoring a burst to it.
      window.requestAnimationFrame(() => {
        const node = nodes.current.get(id);
        if (node) burstSparkles(node, { count: 7, hue: "butter" });
      });
    }

    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      nodes.current.delete(id);
    }, 4000);
  }, []);

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
          >
            {toast.message}
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
