import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainView } from "../types.js";
import { useToast } from "./Toast.js";

export type RefreshState = "idle" | "testing" | "ok" | "fail";

export interface ChainRefresh {
  states: Record<string, RefreshState>;
  winnerId: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
}

export function useChainRefresh(chain: ChainView | null, onChanged: () => void): ChainRefresh {
  const toast = useToast();
  const [states, setStates] = useState<Record<string, RefreshState>>({});
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStates({});
    setWinnerId(null);
  }, [chain?.id]);

  async function refresh() {
    if (busy || !chain) return;
    const ordered = [...chain.entries].sort((a, b) => a.priority - b.priority);
    if (ordered.length === 0) return;

    setBusy(true);
    setWinnerId(null);

    const next: Record<string, RefreshState> = {};
    let firstOk: string | null = null;

    for (const entry of ordered) {
      next[entry.id] = "testing";
      setStates({ ...next });

      let ok = false;
      try {
        const result = await api.testEntry(entry.id);
        ok = result.ok;
      } catch {
        ok = false;
      }

      next[entry.id] = ok ? "ok" : "fail";
      setStates({ ...next });
      if (ok && firstOk === null) firstOk = entry.id;
    }

    setWinnerId(firstOk);

    if (firstOk && ordered[0]?.id !== firstOk) {
      const reordered = [
        firstOk,
        ...ordered.map((entry) => entry.id).filter((id) => id !== firstOk),
      ];
      try {
        await api.reorderChain(chain.id, reordered);
      } catch (error) {
        toast.err(error instanceof ApiError ? error.message : String(error));
      }
    }

    if (firstOk) {
      const winner = ordered.find((entry) => entry.id === firstOk);
      toast.ok(`Now serving via ${winner?.label ?? winner?.model ?? "first node that answered"}`);
    } else {
      toast.err("No node answered OK");
    }

    setBusy(false);
    onChanged();
  }

  return { states, winnerId, busy, refresh };
}
