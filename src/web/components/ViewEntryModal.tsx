import { useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, PublicCredential } from "../types.js";
import { Modal } from "./Primitives.js";
import { RateLabel, StatusDot } from "./Primitives.js";
import { useToast } from "./Toast.js";
import { AddCredentialModal } from "./AddCredentialModal.js";

interface Props {
  entry: ChainEntryView;
  onClose: () => void;
  onChanged: () => void;
}

export function ViewEntryModal({ entry, onClose, onChanged }: Props) {
  const toast = useToast();
  const [testingCredId, setTestingCredId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; latencyMs?: number; message?: string }>
  >({});
  const [addingCredential, setAddingCredential] = useState(false);

  async function testCredential(credential: PublicCredential) {
    setTestingCredId(credential.id);
    try {
      const result = await api.testCredential(credential.id);
      setTestResults((prev) => ({ ...prev, [credential.id]: result }));
      if (!result.ok) {
        toast.err(`${credential.description}: ${result.classification} — ${result.message ?? ""}`);
      }
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setTestingCredId(null);
    }
  }

  async function removeCredential(credential: PublicCredential) {
    if (!confirm(`Remove ${credential.description}?`)) return;
    try {
      await api.removeEntryCredential(entry.id, credential.id);
      toast.ok("Credential removed");
      onChanged();
      onClose();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <Modal
      title={`${entry.model} · Details`}
      subtitle="Everything this node routes to. Keys are tried in the strategy order below."
      onClose={onClose}
    >
      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">Provider</span>
            <span className="mono">{entry.providerId}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Model</span>
            <span className="mono">{entry.model}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Base URL</span>
            <span className="mono small">{entry.baseUrl}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Strategy</span>
            <span className="badge" title="How credentials are rotated for this node">
              {entry.routingStrategy === "sequential"
                ? "sequential · in order"
                : "round-robin · rotate"}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span
              className="badge"
              style={{
                backgroundColor: entry.enabled ? "var(--ok-bg)" : "var(--warn-bg)",
                color: entry.enabled ? "var(--ok)" : "var(--warn)",
              }}
            >
              {entry.enabled ? "✓ enabled" : "⊘ disabled"}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <h4 style={{ margin: 0 }}>Keys ({entry.credentials.length})</h4>
            <button
              className="secondary"
              style={{ padding: "4px 8px", fontSize: 12 }}
              onClick={() => setAddingCredential(true)}
            >
              + Add key
            </button>
          </div>
          <p className="small faint" style={{ margin: "0 0 12px" }}>
            Test a key against <span className="mono">{entry.model}</span>. A red pill means the key
            failed for this model; a green pill shows its latency.
          </p>

          {entry.credentials.length === 0 ? (
            <p className="small faint">No credentials linked to this entry.</p>
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
                        {isPassed ? `✓ ${testResult.latencyMs}ms` : "✗ failed"}
                      </span>
                    )}

                    <button
                      className="ghost"
                      style={{ padding: "2px 4px", fontSize: 12 }}
                      onClick={() => void testCredential(credential)}
                      disabled={testingCredId === credential.id}
                      title={
                        testingCredId === credential.id ? "Testing..." : "Test this credential"
                      }
                    >
                      {testingCredId === credential.id ? "⟳" : "↻"}
                    </button>

                    <button
                      className="ghost danger"
                      style={{ padding: "2px 4px", fontSize: 12 }}
                      onClick={() => void removeCredential(credential)}
                      title="Remove credential"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {addingCredential ? (
        <AddCredentialModal
          entry={entry}
          onClose={() => setAddingCredential(false)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}
    </Modal>
  );
}
