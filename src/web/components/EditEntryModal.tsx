import { useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView } from "../types.js";
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
  const known = entry.provider?.knownModels ?? [];
  const [model, setModel] = useState(entry.model);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const options = known.includes(model) || known.length === 0 ? known : [model, ...known];

  async function save() {
    const next = model.trim();
    if (!next) {
      setError("Pick or type a model");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api.updateEntry(entry.id, { model: next });
      toast.ok(`Model changed to ${next}`);
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
      title={`Edit ${entry.providerId} entry`}
      subtitle="Change the model this entry routes to. Credentials and order are unchanged."
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="entry-edit-model">Model</label>
        <select
          id="entry-edit-model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          autoFocus
        >
          {options.map((knownModel) => (
            <option key={knownModel} value={knownModel}>
              {knownModel}
            </option>
          ))}
        </select>
        <span className="small faint">
          Only {entry.providerId} models are listed — the entry's provider is fixed.
        </span>
      </div>

      {error ? <div className="verify err">{error}</div> : null}

      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button onClick={() => void save()} disabled={busy || !model.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
