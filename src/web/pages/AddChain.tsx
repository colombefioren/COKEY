import { useMemo, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ProviderStatus, PublicCredential } from "../types.js";
import { Empty, Modal, Panel } from "../components/Primitives.js";
import { useToast } from "../components/Toast.js";

type Step = 0 | 1 | 2 | 3 | 4;

interface DraftKey {
  localId: string;
  description: string;
  secret: string;
  accountId: string;
  credentialId?: string;
  status: "draft" | "verifying" | "ok" | "error";
  message?: string;
  classification?: string;
}

interface DraftEntry {
  localId: string;
  providerId: string;
  providerName: string;
  model: string;
  keys: DraftKey[];
}

let counter = 0;
function localId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function newKey(): DraftKey {
  return {
    localId: localId("key"),
    description: "",
    secret: "",
    accountId: "",
    status: "draft",
  };
}

/**
 * The guided flow from spec §24: provider → model → verified keys → order.
 *
 * Nothing is written until the final step, and every key is verified against
 * the provider before the entry that references it is created.
 */
export function AddChain({
  providers,
  credentials,
  onCreated,
}: {
  providers: ProviderStatus[];
  credentials: PublicCredential[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>(0);
  const [alias, setAlias] = useState("");
  const [description, setDescription] = useState("");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [draftKeys, setDraftKeys] = useState<DraftKey[]>([newKey()]);
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [showExisting, setShowExisting] = useState(false);

  const provider = useMemo(
    () => providers.find((candidate) => candidate.id === providerId),
    [providers, providerId],
  );

  const existingForProvider = useMemo(
    () => credentials.filter((credential) => credential.providerId === providerId),
    [credentials, providerId],
  );

  const verifiedCount = draftKeys.filter((key) => key.status === "ok" || key.credentialId).length;

  function resetKeyDraft() {
    setDraftKeys([newKey()]);
  }

  function updateKey(id: string, patch: Partial<DraftKey>) {
    setDraftKeys((current) => current.map((key) => (key.localId === id ? { ...key, ...patch } : key)));
  }

  async function verifyKey(key: DraftKey) {
    if (!key.description.trim() || !key.secret.trim()) {
      updateKey(key.localId, { status: "error", message: "Description and key are required" });
      return;
    }
    if (!provider) return;

    updateKey(key.localId, { status: "verifying", message: undefined });
    try {
      const result = await api.connectProvider(provider.id, {
        description: key.description.trim(),
        secret: key.secret.trim(),
        ...(key.accountId.trim() ? { accountId: key.accountId.trim() } : {}),
      });
      updateKey(key.localId, {
        status: "ok",
        credentialId: result.credential.id,
        classification: result.validation.classification,
        message: `verified in ${result.validation.latencyMs ?? 0}ms`,
      });
    } catch (error) {
      const classification = error instanceof ApiError ? error.classification : undefined;
      updateKey(key.localId, {
        status: "error",
        classification,
        message: error instanceof ApiError ? error.message : String(error),
      });
    }
  }

  function reuseExisting(credential: PublicCredential) {
    setDraftKeys((current) => [
      ...current.filter((key) => key.status !== "draft" || key.description || key.secret),
      {
        localId: localId("key"),
        description: credential.description,
        secret: "",
        accountId: "",
        credentialId: credential.id,
        status: "ok",
        message: `reusing ${credential.maskedSecret}`,
      },
    ]);
    setShowExisting(false);
  }

  function commitEntry() {
    if (!provider || !model) return;
    if (verifiedCount === 0) {
      toast.err("Verify at least one key before adding this entry");
      return;
    }
    setEntries((current) => [
      ...current,
      {
        localId: localId("entry"),
        providerId: provider.id,
        providerName: provider.displayName,
        model,
        keys: draftKeys.filter((key) => key.status === "ok" || key.credentialId),
      },
    ]);
    setProviderId("");
    setModel("");
    resetKeyDraft();
    setStep(1);
    toast.ok("Entry staged. Add another provider, or create the chain.");
  }

  async function createChain() {
    if (!alias.trim()) {
      toast.err("The chain needs an alias");
      setStep(0);
      return;
    }
    if (entries.length === 0) {
      toast.err("Add at least one entry");
      setStep(1);
      return;
    }

    setBusy(true);
    try {
      const chain = await api.createChain({
        alias: alias.trim(),
        description: description.trim() || undefined,
      });

      for (const entry of entries) {
        const credentialIds = entry.keys
          .map((key) => key.credentialId)
          .filter((id): id is string => Boolean(id));

        if (credentialIds.length === 0) continue;
        await api.addEntry(chain.id, {
          providerId: entry.providerId,
          model: entry.model,
          credentialIds,
        });
      }

      toast.ok(`Created ${chain.alias} with ${entries.length} entries`);
      setAlias("");
      setDescription("");
      setEntries([]);
      setStep(0);
      onCreated();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Add chain">
      <div className="steps">
        {["Name", "Provider", "Model", "Keys", "Review"].map((label, index) => (
          <div
            key={label}
            className={`step ${step === index ? "active" : ""} ${step > index ? "done" : ""}`}
          >
            <span className="n">{index + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {step === 0 ? (
        <>
          <div className="field">
            <label htmlFor="wizard-alias">Chain alias</label>
            <input
              id="wizard-alias"
              value={alias}
              placeholder="cokey-best"
              onChange={(event) => setAlias(event.target.value)}
            />
            <div className="small faint" style={{ marginTop: 5 }}>
              Clients send this as the <code>model</code> field.
            </div>
          </div>
          <div className="field">
            <label htmlFor="wizard-description">Description (optional)</label>
            <input
              id="wizard-description"
              value={description}
              placeholder="Groq primary, OpenRouter failover"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="row end">
            <button onClick={() => setStep(1)} disabled={!alias.trim()}>
              Next: choose provider
            </button>
          </div>
        </>
      ) : null}

      {step === 1 ? (
        <>
          {entries.length > 0 ? (
            <div className="hint-box" style={{ marginBottom: 14 }}>
              Staged entries: {entries.map((entry) => `${entry.providerId}/${entry.model}`).join(" → ")}
            </div>
          ) : null}

          <h3 style={{ fontSize: 13, margin: "0 0 10px" }}>Free providers</h3>
          <div className="grid cards">
            {providers
              .filter((candidate) => candidate.freeTier.advertised)
              .map((candidate) => (
                <div
                  key={candidate.id}
                  className={`card selectable ${providerId === candidate.id ? "selected" : ""}`}
                  onClick={() => {
                    setProviderId(candidate.id);
                    setModel(candidate.knownModels[0] ?? "");
                    resetKeyDraft();
                  }}
                >
                  <div className="title">
                    {candidate.displayName} <span className="badge">Free</span>
                  </div>
                  <div className="sub">{candidate.freeTier.summary}</div>
                </div>
              ))}
          </div>

          <h3 style={{ fontSize: 13, margin: "20px 0 10px" }}>Other supported providers</h3>
          <div className="grid cards">
            {providers
              .filter((candidate) => !candidate.freeTier.advertised)
              .map((candidate) => (
                <div
                  key={candidate.id}
                  className={`card selectable ${providerId === candidate.id ? "selected" : ""}`}
                  onClick={() => {
                    setProviderId(candidate.id);
                    setModel(candidate.knownModels[0] ?? "");
                    resetKeyDraft();
                  }}
                >
                  <div className="title">{candidate.displayName}</div>
                  <div className="sub">{candidate.baseUrl}</div>
                </div>
              ))}
          </div>

          <div className="row end" style={{ marginTop: 16 }}>
            <button className="secondary" onClick={() => setStep(entries.length > 0 ? 4 : 0)}>
              Back
            </button>
            <button onClick={() => setStep(2)} disabled={!providerId}>
              Next: choose model
            </button>
          </div>
        </>
      ) : null}

      {step === 2 && provider ? (
        <>
          <div className="field">
            <label>Model on {provider.displayName}</label>
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              {provider.knownModels.map((knownModel) => (
                <option key={knownModel} value={knownModel}>
                  {knownModel}
                </option>
              ))}
            </select>
          </div>
          <div className="hint-box">
            Only models in the curated free catalogue are listed. Paid-only models are intentionally
            absent — use a custom endpoint if you need one.
          </div>
          <div className="row end" style={{ marginTop: 16 }}>
            <button className="secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button onClick={() => setStep(3)} disabled={!model}>
              Next: add keys
            </button>
          </div>
        </>
      ) : null}

      {step === 3 && provider ? (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <strong>Keys for {provider.displayName}</strong>
            <span className="spacer" style={{ flex: 1 }} />
            {existingForProvider.length > 0 ? (
              <button className="secondary" onClick={() => setShowExisting(true)}>
                Use an existing key
              </button>
            ) : null}
          </div>

          <div className="selected-list">
            {draftKeys.map((key) => (
              <div key={key.localId} className="selected-item" style={{ display: "block" }}>
                <div className="row">
                  <input
                    value={key.description}
                    placeholder="Main account"
                    onChange={(event) => updateKey(key.localId, { description: event.target.value })}
                  />
                  <input
                    value={key.secret}
                    type="password"
                    autoComplete="off"
                    placeholder="API key"
                    disabled={Boolean(key.credentialId)}
                    onChange={(event) => updateKey(key.localId, { secret: event.target.value })}
                  />
                  {provider.credentialFields.includes("accountId") ? (
                    <input
                      value={key.accountId}
                      placeholder="Account id"
                      disabled={Boolean(key.credentialId)}
                      onChange={(event) => updateKey(key.localId, { accountId: event.target.value })}
                    />
                  ) : null}
                  <button
                    className="secondary"
                    onClick={() => void verifyKey(key)}
                    disabled={key.status === "verifying" || Boolean(key.credentialId)}
                  >
                    {key.status === "verifying" ? "Verifying…" : "Verify"}
                  </button>
                </div>
                {key.message ? (
                  <div className={`verify ${key.status === "ok" ? "ok" : "err"}`}>
                    {key.status === "ok" ? "✓" : "✗"} {key.message}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="secondary" onClick={() => setDraftKeys((current) => [...current, newKey()])}>
              + Another key
            </button>
            <span className="small faint">
              {verifiedCount} verified. Every credential of this entry is tried before the next entry.
            </span>
          </div>

          <div className="row end" style={{ marginTop: 16 }}>
            <button className="secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button onClick={commitEntry} disabled={verifiedCount === 0}>
              Stage entry
            </button>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          {entries.length === 0 ? (
            <Empty>No entries staged yet.</Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Keys</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.localId}>
                    <td>{index + 1}</td>
                    <td>{entry.providerName}</td>
                    <td className="mono small">{entry.model}</td>
                    <td className="small">
                      {entry.keys.map((key) => `${key.description} (${key.message ?? "key"})`).join(", ")}
                    </td>
                    <td>
                      <button
                        className="ghost"
                        onClick={() =>
                          setEntries((current) => current.filter((item) => item.localId !== entry.localId))
                        }
                      >
                        remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <button className="secondary" onClick={() => setStep(1)}>
              + Add another entry
            </button>
            <span className="spacer" style={{ flex: 1 }} />
            <button onClick={() => void createChain()} disabled={busy || entries.length === 0}>
              {busy ? "Creating…" : `Create ${alias || "chain"}`}
            </button>
          </div>
        </>
      ) : null}

      {showExisting ? (
        <Modal
          title={`Existing ${provider?.displayName ?? ""} keys`}
          subtitle="Reusing a key attaches the stored credential — its secret is never shown."
          onClose={() => setShowExisting(false)}
        >
          {existingForProvider.length === 0 ? (
            <Empty>No stored credentials for this provider.</Empty>
          ) : (
            <div className="selected-list">
              {existingForProvider.map((credential) => (
                <div key={credential.id} className="selected-item">
                  <span>{credential.description}</span>
                  <span className="mono muted">{credential.maskedSecret}</span>
                  <span className="spacer" style={{ flex: 1 }} />
                  <button onClick={() => reuseExisting(credential)}>Use</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      ) : null}
    </Panel>
  );
}
