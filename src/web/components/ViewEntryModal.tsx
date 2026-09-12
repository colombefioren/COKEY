import { useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, PublicCredential } from "../types.js";
import { Modal } from "./Primitives.js";
import { RateLabel, StatusDot } from "./Primitives.js";
import { useToast } from "./Toast.js";

interface Props {
  entry: ChainEntryView;
  onClose: () => void;
  onChanged: () => void;
}

export function ViewEntryModal({ entry, onClose, onChanged }: Props) {
  const toast = useToast();
  const [testingCredId, setTestingCredId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs?: number; message?: string }>>({});

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
    <Modal title={`${entry.model} · Details`} onClose={onClose}>
      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <div className="field">
          <label>Provider</label>
          <span className="mono">{entry.providerId}</span>
        </div>

        <div className="field">
          <label>Model</label>
          <span className="mono">{entry.model}</span>
        </div>

        <div className="field">
          <label>Base URL</label>
          <span className="mono small">{entry.baseUrl}</span>
        </div>

        <div className="field">
          <label>Routing strategy</label>
          <span className="badge">{entry.routingStrategy}</span>
        </div>

        <div className="field">
          <label>Status</label>
          <span className="badge" style={{ backgroundColor: entry.enabled ? "var(--ok-bg)" : "var(--warn-bg)" }}>
            {entry.enabled ? "enabled" : "disabled"}
          </span>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <h4 style={{ margin: "0 0 12px 0" }}>Credentials ({entry.credentials.length})</h4>

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
                      padding: 8,
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                    }}
                  >
                    <StatusDot status={credential.status} />
                    <span className="mono" style={{ flex: 1 }}>
                      {credential.description}
                    </span>
                    <span className="mono small faint">{credential.maskedSecret}</span>
                    <RateLabel rate={credential.rate} compact />

                    {hasTested && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isPassed ? "var(--ok-bg)" : "var(--bad-bg)",
                          color: isPassed ? "var(--ok)" : "var(--bad)",
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
                    >
                      {testingCredId === credential.id ? "testing…" : "test"}
                    </button>

                    <button
                      className="ghost danger"
                      style={{ padding: "2px 4px", fontSize: 12 }}
                      onClick={() => void removeCredential(credential)}
                    >
                      remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
