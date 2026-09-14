import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, ProviderStatus } from "../types.js";
import { Modal, Select } from "./Primitives.js";
import { useToast } from "./Toast.js";
import { useLang } from "../lang.js";

/**
 * Edit one chain node.
 *
 * The provider is fixed: an entry's credentials belong to that provider, so
 * swapping the provider would silently detach every key. Model, display name,
 * routing strategy and enabled state are all editable.
 *
 * The display name is free text on purpose. COKEY never derives a label such as
 * "DeepSeek V4 Pro (xKiro)" from the model id; whatever the user types is what
 * clients and the UI show.
 */
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
  const { t } = useLang();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [model, setModel] = useState(entry.model);
  const [label, setLabel] = useState(entry.label ?? "");
  const [strategy, setStrategy] = useState(entry.routingStrategy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        setProviders(await api.allProviders());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : String(err));
      }
    })();
  }, []);

  const knownModels = providers.find((p) => p.id === entry.providerId)?.knownModels ?? [];
  const known = new Set(knownModels);
  // Keep the current model selectable even if the curated catalog has moved on.
  const modelOptions = known.has(model) ? knownModels : [model, ...knownModels];

  const trimmedLabel = label.trim();
  const hasChanges =
    model.trim() !== entry.model ||
    trimmedLabel !== (entry.label ?? "") ||
    strategy !== entry.routingStrategy;

  async function save() {
    const nextModel = model.trim();
    if (!nextModel) {
      setError(t("Pick or type a model"));
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const updates: Parameters<typeof api.updateEntry>[1] = {};
      if (nextModel !== entry.model) updates.model = nextModel;
      if (trimmedLabel !== (entry.label ?? "")) updates.label = trimmedLabel || null;
      if (strategy !== entry.routingStrategy) updates.routingStrategy = strategy;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      await api.updateEntry(entry.id, updates);
      toast.ok(t("Chain node updated"));
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t("Edit chain node")}
      subtitle={`${entry.providerId} ${t("cannot be changed here: this node's keys belong to it.")}`}
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="entry-edit-label">{t("Display name (optional)")}</label>
        <input
          id="entry-edit-label"
          value={label}
          placeholder="DeepSeek V4 Pro (xKiro)"
          onChange={(event) => setLabel(event.target.value)}
          autoFocus
        />
        <span className="small faint">
          {t("Shown in the dashboard and in")} <code>/v1/models</code>.{" "}
          {t("Leave it empty to show the raw model id.")}
        </span>
      </div>

      <div className="field">
        <label htmlFor="entry-edit-model">{t("Model")}</label>
        <input
          id="entry-edit-model"
          list="entry-edit-model-options"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
        <datalist id="entry-edit-model-options">
          {modelOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <span className="small faint">
          {knownModels.length} {t("curated model(s) for")} {entry.providerId}.{" "}
          {t("Any id the provider accepts works.")}
        </span>
      </div>

      <div className="field">
        <label htmlFor="entry-edit-strategy">{t("Routing strategy")}</label>
        <Select
          id="entry-edit-strategy"
          value={strategy}
          onChange={(value) => setStrategy(value as "sequential" | "round-robin")}
        >
          <option value="sequential">{t("Sequential: use the keys in order")}</option>
          <option value="round-robin">{t("Round robin: rotate the keys")}</option>
        </Select>
      </div>

      {error ? <div className="verify err">{error}</div> : null}

      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          {t("Cancel")}
        </button>
        <button onClick={() => void save()} disabled={busy || !hasChanges || !model.trim()}>
          {busy ? t("Saving…") : t("Save")}
        </button>
      </div>
    </Modal>
  );
}
