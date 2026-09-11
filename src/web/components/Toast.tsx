import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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

/** Minimal toast queue: no dependency, auto-dismissing, capped at five. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-4), { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
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
          <div key={toast.id} className={`toast ${toast.kind === "info" ? "" : toast.kind}`}>
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
