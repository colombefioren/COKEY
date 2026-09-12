import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, ProviderStatus } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";

export function EditEntryModal({
  entry,
  onClose,
  onChanged,
}: {
  entry: ChainEntryView;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [providerId, setProviderId] = useState(entry.providerId);
  const [model, setModel] = useState(entry.model);
  const [strategy, setStrategy] = useState(entry.routingStrategy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        const data = await api.providers();
        setProviders(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err));
      }
    })();
  }, []);

  // Get models for currently selected provider
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId],
  );

  const knownModels = selectedProvider?.knownModels ?? [];
  const modelOptions = knownModels.includes(model) || knownModels.length === 0 ? knownModels : [model, ...knownModels];

  async function save() {
    const nextModel = model.trim();
    if (!nextModel) {
      setError("Pick or type a model");
      return;
    }
    if (!providerId) {
      setError("Select a provider");
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const updates: Record<string, unknown> = {};
      if (providerId !== entry.providerId) updates.providerId = providerId;
      if (nextModel !== entry.model) updates.model = nextModel;
      if (strategy !== entry.routingStrategy) updates.routingStrategy = strategy;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      await api.updateEntry(entry.id, updates);
      toast.ok("Entry updated");
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const hasChanges =
    providerId !== entry.providerId || model !== entry.model || strategy !== entry.routingStrategy;

  return (
    <Modal title="Edit entry" onClose={onClose}>
      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <div className="field">
          <label htmlFor="entry-edit-provider">Provider</label>
          <select
            id="entry-edit-provider"
            value={providerId}
            onChange={(event) => {
              setProviderId(event.target.value);
              setModel(""); // Reset model when provider changes
            }}
            autoFocus
          >
            <option value="">Select provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} ({p.knownModels.length} models)
              </option>
            ))}
          </select>
        </div>

        {providerId && (
          <div className="field">
            <label htmlFor="entry-edit-model">Model</label>
            <select
              id="entry-edit-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="">Select model…</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="small faint">{knownModels.length} models available in this provider</span>
          </div>
        )}

        <div className="field">
          <label htmlFor="entry-edit-strategy">Routing strategy</label>
          <select id="entry-edit-strategy" value={strategy} onChange={(event) => setStrategy(event.target.value as "sequential" | "round-robin")}>
            <option value="sequential">Sequential (use credentials in order)</option>
            <option value="round-robin">Round-robin (rotate through credentials)</option>
          </select>
          <span className="small faint">How credentials are selected when routing to this model</span>
        </div>

        {error ? <div className="verify err">{error}</div> : null}

        <div className="modal-actions">
          <button className="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button onClick={() => void save()} disabled={busy || !hasChanges || !model.trim() || !providerId}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
