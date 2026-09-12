import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainView, ProviderStatus, PublicCredential } from "../types.js";
import { Modal } from "./Primitives.js";
import { useToast } from "./Toast.js";

/**
 * Append an entry to an existing chain.
 *
 * Flow is provider → model → keys. Only models present in the curated catalog
 * are offered, so a paid-only model can never be selected by accident.
 */
export function AddEntryModal({
  chain,
  onClose,
  onChanged,
}: {
  chain: ChainView;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const [providerList, credentialList] = await Promise.all([
        api.providers(),
        api.credentials(),
      ]);
      setProviders(providerList);
      setCredentials(credentialList);
      const firstConnected = providerList.find((p) => p.connected) ?? providerList[0];
      if (firstConnected) {
        setProviderId(firstConnected.id);
        setModel(firstConnected.knownModels[0] ?? "");
      }
    })();
  }, []);

  const provider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId],
  );

  const providerCredentials = useMemo(
    () => credentials.filter((credential) => credential.providerId === providerId),
    [credentials, providerId],
  );

  // Pre-select every credential of the chosen provider, matching the CLI.
  useEffect(() => {
    setSelected(providerCredentials.map((credential) => credential.id));
  }, [providerCredentials]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function submit() {
    if (!providerId || !model) {
      setError("Pick a provider and a model");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one credential, or connect a key for this provider first");
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      await api.addEntry(chain.id, { providerId, model, credentialIds: selected });
      toast.ok(`Added ${providerId}/${model} to ${chain.alias}`);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function testSelected() {
    if (!providerId || !model || selected.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.testCredential(selected[0]!);
      if (result.ok) toast.ok(`${providerId}/${model}: operational in ${result.latencyMs ?? 0}ms`);
      else toast.err(`${providerId}/${model}: ${result.classification} — ${result.message ?? ""}`);
    } catch (err) {
      toast.err(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Add entry to ${chain.alias}`}
      subtitle="Entries run top to bottom; every credential of an entry is exhausted before the next entry."
      onClose={onClose}
      wide
    >
      <div className="field">
        <label htmlFor="entry-provider">Provider</label>
        <select
          id="entry-provider"
          value={providerId}
          onChange={(event) => {
            const next = providers.find((p) => p.id === event.target.value);
            setProviderId(event.target.value);
            setModel(next?.knownModels[0] ?? "");
          }}
        >
          {providers.map((option) => (
            <option key={option.id} value={option.id}>
              {option.displayName} {option.freeTier.advertised ? "(free)" : ""} ·{" "}
              {option.connected ? `${option.credentialCount} keys` : "not connected"}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="entry-model">Model</label>
        <div className="row">
          <select
            id="entry-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            style={{ flex: 1 }}
          >
            {(provider?.knownModels ?? []).map((knownModel) => (
              <option key={knownModel} value={knownModel}>
                {knownModel}
              </option>
            ))}
          </select>
          <button
            className="secondary"
            type="button"
            onClick={() => void testSelected()}
            disabled={busy || !model || selected.length === 0}
            title="Probe this model with a selected key"
          >
            test
          </button>
        </div>
        <span className="small faint">
          Only {provider?.displayName ?? providerId} models are listed.
        </span>
      </div>

      <div className="field">
        <label>Credentials</label>
        {providerCredentials.length === 0 ? (
          <div className="hint-box">
            No credentials for {provider?.displayName ?? providerId} yet. Connect one from the
            Providers tab first — COKEY will not create an entry with an unverified key.
          </div>
        ) : (
          <div className="selected-list">
            {providerCredentials.map((credential) => (
              <label key={credential.id} className="selected-item" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={selected.includes(credential.id)}
                  onChange={() => toggle(credential.id)}
                />
                <span>{credential.description}</span>
                <span className="mono muted">{credential.maskedSecret}</span>
                <span className="spacer" style={{ flex: 1 }} />
                <span className="small muted">{credential.status}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="verify err">{error}</div> : null}

      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button onClick={() => void submit()} disabled={busy || providerCredentials.length === 0}>
          {busy ? "Adding…" : "Add entry"}
        </button>
      </div>
    </Modal>
  );
}
