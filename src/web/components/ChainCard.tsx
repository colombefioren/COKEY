import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, ChainView } from "../types.js";
import { AddCredentialModal } from "./AddCredentialModal.js";
import { AddEntryModal } from "./AddEntryModal.js";
import { ConfirmModal } from "./Primitives.js";
import { EditEntryModal } from "./EditEntryModal.js";
import { ViewEntryModal } from "./ViewEntryModal.js";
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
  const [viewingEntry, setViewingEntry] = useState<ChainEntryView | null>(null);
  const [removingEntry, setRemovingEntry] = useState<ChainEntryView | null>(null);
  const [deletingChain, setDeletingChain] = useState(false);

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
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, enabled: !entry.enabled } : e)),
      );
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
    try {
      await api.deleteEntry(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setRemovingEntry(null);
      onChanged();
    } catch (error) {
      toast.err(error instanceof ApiError ? error.message : String(error));
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
    try {
      await api.deleteChain(chain.id);
      toast.ok(`Deleted ${chain.alias}`);
      setDeletingChain(false);
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
        <button className="danger" onClick={() => setDeletingChain(true)}>
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
            className={`entry-node ${draggingId === entry.id ? "dragging" : ""} ${
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
            {/* Left: reorder buttons */}
            <div className="entry-reorder">
              <button className="ghost" title="Move up (Alt+↑)" onClick={() => move(entry.id, -1)}>
                ▲
              </button>
              <button className="ghost" title="Move down (Alt+↓)" onClick={() => move(entry.id, 1)}>
                ▼
              </button>
            </div>

            {/* Center: model name */}
            <div className="entry-model">
              <span className="priority">{index + 1}.</span>
              <button
                className="model-name"
                title="View details"
                onClick={() => setViewingEntry(entry)}
              >
                {entry.label ?? entry.model}
              </button>
              {entry.label ? <span className="small faint mono">{entry.model}</span> : null}
              <span className="small faint" title={`Provider: ${entry.providerId}`}>
                {entry.providerId}
              </span>
              {entry.credentials.length > 0 ? (
                <span className="badge neutral" title="Keys bound to this node">
                  {entry.healthyCount}/{entry.credentials.length} keys
                </span>
              ) : (
                <span className="badge bad">no keys</span>
              )}
              {entry.credentials.some((credential) => credential.proxy.auto) ? (
                <span className="badge neutral" title="Automatic egress pool is assigning exits">
                  auto proxy
                </span>
              ) : null}
              {!entry.enabled && <span className="badge warn">disabled</span>}
            </div>

            {/* Right: action buttons */}
            <div className="entry-actions">
              <button className="ghost" title="View details" onClick={() => setViewingEntry(entry)}>
                👁
              </button>
              <button className="ghost" title="Edit" onClick={() => setEditingEntry(entry)}>
                ✎
              </button>
              <button className="ghost" title="Duplicate" onClick={() => void duplicate(entry)}>
                ⧉
              </button>
              <button
                className="ghost"
                title={entry.enabled ? "Disable" : "Enable"}
                onClick={() => void toggleEntry(entry)}
              >
                {entry.enabled ? "⊘" : "✓"}
              </button>
              <button
                className="danger"
                style={{ fontSize: 12 }}
                onClick={() => setRemovingEntry(entry)}
              >
                remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="entry-add-row">
        <button className="secondary" onClick={() => setAddingEntry(true)}>
          + Add entry
        </button>
        <span className="small faint">
          Nodes run top to bottom. Drag or Alt+↑ / Alt+↓ to reorder; click a model to view, edit, or
          test its keys.
        </span>
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

      {viewingEntry ? (
        <ViewEntryModal
          entry={viewingEntry}
          onClose={() => setViewingEntry(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}

      {removingEntry ? (
        <ConfirmModal
          title="Remove entry"
          message={`Remove ${removingEntry.providerId}/${removingEntry.model} from ${chain.alias}?`}
          onConfirm={() => void removeEntry(removingEntry)}
          onClose={() => setRemovingEntry(null)}
          actionLabel="Remove"
        />
      ) : null}

      {deletingChain ? (
        <ConfirmModal
          title="Delete chain"
          message={`Delete chain ${chain.alias} and all of its entries?`}
          onConfirm={() => void deleteChain()}
          onClose={() => setDeletingChain(false)}
          actionLabel="Delete"
        />
      ) : null}
    </div>
  );
}
