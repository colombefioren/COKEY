import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, ChainView, PublicCredential } from "../types.js";
import { AddCredentialModal } from "./AddCredentialModal.js";
import { AddEntryModal } from "./AddEntryModal.js";
import { EditEntryModal } from "./EditEntryModal.js";
import { RateLabel, StatusDot } from "./Primitives.js";
import { useToast } from "./Toast.js";

/**
 * One chain: a user-ordered list of provider+model entries.
 *
 * Order is the user's, expressed three ways (drag, keyboard, buttons) and
 * persisted immediately. The router always follows this order.
 */
export function ChainCard({ chain, onChanged }: { chain: ChainView; onChanged: () => void }) {
  const toast = useToast();
  const [entries, setEntries] = useState<ChainEntryView[]>(chain.entries);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [aliasDraft, setAliasDraft] = useState(chain.alias);
  const [addingEntry, setAddingEntry] = useState(false);
  const [credentialTarget, setCredentialTarget] = useState<ChainEntryView | null>(null);
  const [editingEntry, setEditingEntry] = useState<ChainEntryView | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(chain.entries);
    setAliasDraft(chain.alias);
  }, [chain]);

  async function persistOrder(next: ChainEntryView[]) {
    setEntries(next);
    try {
      await api.reorderChain(
        chain.id,
        next.map((entry) => entry.id),
      );
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  function move(entryId: string, delta: number) {
    const ids = entries.map((entry) => entry.id);
    const from = ids.indexOf(entryId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= ids.length) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    void persistOrder(next);
  }

  function onDragOver(event: React.DragEvent, overId: string) {
    event.preventDefault();
    if (!draggingId || draggingId === overId) return;

    setEntries((current) => {
      const ids = current.map((entry) => entry.id);
      const from = ids.indexOf(draggingId);
      const to = ids.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return current;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);

      // Keep the drop target's midpoint in mind so the row lands where the
      // cursor is, not always above the target.
      const box = (event.target as HTMLElement).closest(".entry")?.getBoundingClientRect();
      if (box && event.clientY > box.top + box.height / 2) {
        const index = next.findIndex((entry) => entry.id === draggingId);
        if (index !== -1 && index + 1 < next.length) {
          const [again] = next.splice(index, 1);
          next.splice(index + 1, 0, again!);
        }
      }
      return next;
    });
  }

  async function onDragEnd() {
    if (!draggingId) return;
    setDraggingId(null);
    await persistOrder(entries);
  }

  async function toggleEntry(entry: ChainEntryView) {
    try {
      await api.updateEntry(entry.id, { enabled: !entry.enabled });
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function setStrategy(entry: ChainEntryView, strategy: "sequential" | "round-robin") {
    try {
      await api.updateEntry(entry.id, { routingStrategy: strategy });
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function duplicate(entry: ChainEntryView) {
    try {
      await api.duplicateEntry(entry.id);
      toast.ok("Entry duplicated");
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function removeEntry(entry: ChainEntryView) {
    if (!confirm(`Remove ${entry.providerId}/${entry.model} from ${chain.alias}?`)) return;
    try {
      await api.deleteEntry(entry.id);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function removeCredential(entry: ChainEntryView, credential: PublicCredential) {
    try {
      await api.removeEntryCredential(entry.id, credential.id);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function testCredential(credential: PublicCredential) {
    try {
      const result = await api.testCredential(credential.id);
      if (result.ok) toast.ok(`${credential.description}: verified in ${result.latencyMs ?? 0}ms`);
      else
        toast.err(`${credential.description}: ${result.classification} — ${result.message ?? ""}`);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function testEntry(entry: ChainEntryView) {
    setTestingId(entry.id);
    try {
      const result = await api.testEntry(entry.id);
      if (result.ok)
        toast.ok(`${entry.providerId}/${entry.model}: operational in ${result.latencyMs ?? 0}ms`);
      else
        toast.err(
          `${entry.providerId}/${entry.model}: ${result.classification} — ${result.message ?? ""}`,
        );
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    } finally {
      setTestingId(null);
    }
  }

  async function saveAlias() {
    const next = aliasDraft.trim();
    if (!next || next === chain.alias) {
      setRenaming(false);
      return;
    }
    try {
      await api.updateChain(chain.id, { alias: next });
      toast.ok(`Renamed to ${next}`);
      setRenaming(false);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function toggleChain() {
    try {
      await api.updateChain(chain.id, { enabled: !chain.enabled });
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  async function deleteChain() {
    if (!confirm(`Delete chain ${chain.alias} and all of its entries?`)) return;
    try {
      await api.deleteChain(chain.id);
      toast.ok(`Deleted ${chain.alias}`);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
    }
  }

  return (
    <div className="chain">
      <div className="chain-head">
        <span className="alias">⠿</span>
        {renaming ? (
          <>
            <input
              value={aliasDraft}
              onChange={(event) => setAliasDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveAlias();
                if (event.key === "Escape") setRenaming(false);
              }}
              style={{ width: 220 }}
              autoFocus
            />
            <button onClick={() => void saveAlias()}>Save</button>
            <button className="secondary" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="alias mono">{chain.alias}</span>
            <span className="mono small faint" style={{ marginLeft: 8 }}>
              ID: {chain.id.slice(0, 8)}
            </span>
            {chain.enabled ? null : <span className="badge warn">disabled</span>}
            <span className="small faint">
              {entries.length} {entries.length === 1 ? "entry" : "entries"} · model id for clients
            </span>
          </>
        )}
        <span className="spacer" />
        <button className="ghost" onClick={() => setRenaming(true)} title="Rename">
          rename
        </button>
        <button className="ghost" onClick={() => void toggleChain()}>
          {chain.enabled ? "disable" : "enable"}
        </button>
        <button className="danger" onClick={() => void deleteChain()}>
          delete
        </button>
      </div>

      <div className="entries">
        {entries.length === 0 ? (
          <div className="drop-hint">
            No entries yet. Add a provider and model to start building the fallback order.
          </div>
        ) : null}

        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`entry ${draggingId === entry.id ? "dragging" : ""} ${
              entry.enabled ? "" : "disabled"
            }`}
            draggable
            tabIndex={0}
            onDragStart={() => setDraggingId(entry.id)}
            onDragOver={(event) => onDragOver(event, entry.id)}
            onDragEnd={() => void onDragEnd()}
            onKeyDown={(event) => {
              if (!event.altKey) return;
              if (event.key === "ArrowUp") {
                event.preventDefault();
                move(entry.id, -1);
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                move(entry.id, 1);
              }
            }}
            title="Drag to reorder, or Alt+↑ / Alt+↓"
          >
            <span className="handle" aria-hidden>
              ⠿
            </span>
            <span className="priority">{index + 1}.</span>
            <span className="model" title={entry.baseUrl}>
              {entry.providerId} / {entry.model}
            </span>

            <span className="creds">
              {entry.credentials.length === 0 ? (
                <span className="badge bad">no keys</span>
              ) : (
                entry.credentials.map((credential) => (
                  <span
                    key={credential.id}
                    className="cred-chip"
                    title={
                      (credential.proxy.configured
                        ? `egress via ${credential.proxy.label ?? "proxy"}`
                        : "direct egress") +
                      ` · ${credential.rate.requestsPerMinute} req/min (last 60s)` +
                      (credential.rate.recentlyRateLimited ? " · rate limited recently" : "")
                    }
                  >
                    <StatusDot status={credential.status} />
                    {credential.description}
                    <span className="mono small faint">{credential.maskedSecret}</span>
                    <RateLabel rate={credential.rate} compact />
                    {credential.proxy.label ? (
                      <span
                        className="chip-proxy mono small"
                        title={`egress via ${credential.proxy.label}`}
                      >
                        ⇢ {credential.proxy.label}
                      </span>
                    ) : null}
                    <button
                      className="ghost"
                      style={{ padding: "0 2px" }}
                      title="Test this credential"
                      onClick={() => void testCredential(credential)}
                    >
                      ↻
                    </button>
                    <button
                      className="ghost"
                      style={{ padding: "0 2px" }}
                      title="Detach from this entry"
                      onClick={() => void removeCredential(entry, credential)}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </span>

            <select
              value={entry.routingStrategy}
              onChange={(event) =>
                void setStrategy(entry, event.target.value as "sequential" | "round-robin")
              }
              style={{ width: 122 }}
              title="Credential rotation inside this entry"
            >
              <option value="sequential">sequential</option>
              <option value="round-robin">round-robin</option>
            </select>

            <button className="ghost" title="Move up" onClick={() => move(entry.id, -1)}>
              ↑
            </button>
            <button className="ghost" title="Move down" onClick={() => move(entry.id, 1)}>
              ↓
            </button>
            <button className="ghost" title="Edit model" onClick={() => setEditingEntry(entry)}>
              edit
            </button>
            <button className="ghost" title="Duplicate" onClick={() => void duplicate(entry)}>
              ⧉
            </button>
            <button
              className="ghost"
              title={entry.enabled ? "Disable entry" : "Enable entry"}
              onClick={() => void toggleEntry(entry)}
            >
              {entry.enabled ? "⊘" : "✓"}
            </button>
            <button
              className="secondary"
              style={{ padding: "4px 9px" }}
              onClick={() => void testEntry(entry)}
              disabled={testingId === entry.id}
              title={`Probe ${entry.providerId}/${entry.model} with a bound key`}
            >
              {testingId === entry.id ? "testing…" : "test"}
            </button>
            <button
              className="secondary"
              style={{ padding: "4px 9px" }}
              onClick={() => setCredentialTarget(entry)}
            >
              + key
            </button>
            <button
              className="danger"
              style={{ padding: "4px 9px" }}
              onClick={() => void removeEntry(entry)}
            >
              remove
            </button>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="secondary" onClick={() => setAddingEntry(true)}>
          + Add entry
        </button>
        <span className="small faint">Alt+↑ / Alt+↓ reorders without the mouse.</span>
      </div>

      {addingEntry ? (
        <AddEntryModal
          chain={chain}
          onClose={() => setAddingEntry(false)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}

      {credentialTarget ? (
        <AddCredentialModal
          entry={credentialTarget}
          onClose={() => setCredentialTarget(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}

      {editingEntry ? (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}
