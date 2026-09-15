import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, ProviderStatus, PublicCredential } from "../types.js";
import { AddCredentialModal } from "./AddCredentialModal.js";
import { ConfirmModal, Modal, RateLabel, Select, StatusDot } from "./Primitives.js";
import { useToast } from "./Toast.js";
import { useLang } from "../lang.js";

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
  const [testingCredId, setTestingCredId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; latencyMs?: number; message?: string }>
  >({});
  const [addingCredential, setAddingCredential] = useState(false);
  const [removingCredential, setRemovingCredential] = useState<PublicCredential | null>(null);

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

  async function testCredential(credential: PublicCredential) {
    setTestingCredId(credential.id);
    try {
      const result = await api.testCredential(credential.id);
      setTestResults((prev) => ({ ...prev, [credential.id]: result }));
      if (!result.ok) {
        toast.err(`${credential.description}: ${result.classification} — ${result.message ?? ""}`);
      }
    } catch (err) {
      toast.err(err instanceof ApiError ? err.message : String(err));
    } finally {
      setTestingCredId(null);
    }
  }

  async function removeCredential(credential: PublicCredential) {
    try {
      await api.removeEntryCredential(entry.id, credential.id);
      toast.ok(t("Credential removed"));
      setRemovingCredential(null);
      onChanged();
      onClose();
    } catch (err) {
      toast.err(err instanceof ApiError ? err.message : String(err));
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

      <div className="field">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <label style={{ marginBottom: 0 }}>
            {t("Keys")} ({entry.credentials.length})
          </label>
          <button
            className="secondary"
            style={{ padding: "4px 8px", fontSize: 12 }}
            onClick={() => setAddingCredential(true)}
          >
            + {t("Add key")}
          </button>
        </div>

        {entry.credentials.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            {t("No credentials linked to this entry.")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entry.credentials.map((credential) => {
              const testResult = testResults[credential.id];
              const isPassed = testResult?.ok;
              const hasTested = testResult !== undefined;

              return (
                <div
                  key={credential.id}
                  style={{
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <StatusDot status={credential.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontWeight: 500 }}>
                      {credential.description}
                    </div>
                    <div className="mono small faint">{credential.maskedSecret}</div>
                  </div>

                  <RateLabel rate={credential.rate} compact />

                  {hasTested && (
                    <span
                      className="badge"
                      style={{
                        backgroundColor: isPassed ? "var(--ok-bg)" : "var(--bad-bg)",
                        color: isPassed ? "var(--ok)" : "var(--bad)",
                        fontSize: 11,
                        padding: "3px 6px",
                      }}
                    >
                      {isPassed ? `✓ ${testResult.latencyMs}ms` : `✗ ${t("failed")}`}
                    </span>
                  )}

                  <button
                    className="ghost"
                    style={{ padding: "2px 4px", fontSize: 12 }}
                    onClick={() => void testCredential(credential)}
                    disabled={testingCredId === credential.id}
                    title={
                      testingCredId === credential.id ? t("Testing...") : t("Test this credential")
                    }
                  >
                    {testingCredId === credential.id ? "⟳" : "↻"}
                  </button>

                  <button
                    className="ghost danger"
                    style={{ padding: "2px 4px", fontSize: 12 }}
                    onClick={() => setRemovingCredential(credential)}
                    title={t("Remove credential")}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
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

      {addingCredential ? (
        <AddCredentialModal
          entry={entry}
          onClose={() => setAddingCredential(false)}
          onChanged={() => onChanged()}
        />
      ) : null}

      {removingCredential ? (
        <ConfirmModal
          title={t("Remove credential")}
          message={`${t("Remove")} ${removingCredential.description}?`}
          onConfirm={() => void removeCredential(removingCredential)}
          onClose={() => setRemovingCredential(null)}
          actionLabel={t("Remove")}
        />
      ) : null}
    </Modal>
  );
}
