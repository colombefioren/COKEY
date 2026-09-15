import { useEffect, useState } from "react";
import { api, ApiError } from "../api.js";
import type { ChainEntryView, ChainView } from "../types.js";
import { AddCredentialModal } from "./AddCredentialModal.js";
import { AddEntryModal } from "./AddEntryModal.js";
import { ConfirmModal, Tooltip } from "./Primitives.js";
import { EditEntryModal } from "./EditEntryModal.js";
import { ViewEntryModal } from "./ViewEntryModal.js";
import { useToast } from "./Toast.js";
import { useChainRefresh, type RefreshState } from "./useChainRefresh.js";
import { useLang } from "../lang.js";

export function ChainCard({
  chain,
  index,
  total,
  onMove,
  onChanged,
}: {
  chain: ChainView;
  index: number;
  total: number;
  onMove: (id: string, delta: number) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { t } = useLang();
  const [entries, setEntries] = useState<ChainEntryView[]>(chain.entries);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [aliasDraft, setAliasDraft] = useState(chain.alias);
  const [addingEntry, setAddingEntry] = useState(false);
  const [credentialTargetId, setCredentialTargetId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [viewingEntryId, setViewingEntryId] = useState<string | null>(null);
  const [removingEntry, setRemovingEntry] = useState<ChainEntryView | null>(null);
  const [deletingChain, setDeletingChain] = useState(false);
  const sweep = useChainRefresh(chain, onChanged);

  useEffect(() => {
    setEntries(chain.entries);
    setAliasDraft(chain.alias);
  }, [chain]);

  const credentialTarget = credentialTargetId
    ? (entries.find((entry) => entry.id === credentialTargetId) ?? null)
    : null;
  const editingEntry = editingEntryId
    ? (entries.find((entry) => entry.id === editingEntryId) ?? null)
    : null;
  const viewingEntry = viewingEntryId
    ? (entries.find((entry) => entry.id === viewingEntryId) ?? null)
    : null;

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
      toast.ok(t("Entry duplicated"));
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
      toast.ok(`${t("Renamed to")} ${next}`);
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
      toast.ok(`${t("Deleted")} ${chain.alias}`);
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
            <button onClick={() => void saveAlias()}>{t("Save")}</button>
            <button className="secondary" onClick={() => setRenaming(false)}>
              {t("Cancel")}
            </button>
          </>
        ) : (
          <>
            <span className="alias mono">{chain.alias}</span>
            <span className="mono small faint" style={{ marginLeft: 8 }}>
              ID: {chain.id.slice(0, 8)}
            </span>
            {chain.enabled ? null : <span className="badge warn">{t("disabled")}</span>}
            <span className="small faint">
              {entries.length} {entries.length === 1 ? t("entry") : t("entries")} ·{" "}
              {t("model id for clients")}
            </span>
          </>
        )}
        <span className="spacer" />
        <Tooltip label={t("Move this chain up")}>
          <button
            className="ghost"
            aria-label={t("Move this chain up")}
            disabled={index <= 0}
            onClick={() => onMove(chain.id, -1)}
          >
            ▲
          </button>
        </Tooltip>
        <Tooltip label={t("Move this chain down")}>
          <button
            className="ghost"
            aria-label={t("Move this chain down")}
            disabled={index >= total - 1}
            onClick={() => onMove(chain.id, 1)}
          >
            ▼
          </button>
        </Tooltip>
        <button
          className="ghost"
          onClick={() => void sweep.refresh()}
          disabled={sweep.busy}
          title={
            sweep.busy ? t("Testing nodes…") : t("Test every node and go to the first that answers")
          }
        >
          {sweep.busy ? t("testing…") : `⟳ ${t("refresh")}`}
        </button>
        <button className="ghost" onClick={() => setRenaming(true)} title={t("Rename")}>
          {t("rename")}
        </button>
        <button className="ghost" onClick={() => void toggleChain()}>
          {chain.enabled ? t("disable") : t("enable")}
        </button>
        <button className="danger" onClick={() => setDeletingChain(true)}>
          {t("delete")}
        </button>
      </div>

      <div className="entries">
        {entries.length === 0 ? (
          <div className="drop-hint">
            {t("No entries yet. Add a provider and model to start building the fallback order.")}
          </div>
        ) : null}

        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className={`entry-node ${draggingId === entry.id ? "dragging" : ""} ${
              entry.enabled ? "" : "disabled"
            }${sweep.states[entry.id] && sweep.states[entry.id] !== "idle" ? ` sweep-${sweep.states[entry.id]}` : ""}${
              sweep.winnerId === entry.id ? " sweep-current" : ""
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
            title={t("Drag to reorder, or Alt+↑ / Alt+↓")}
          >
            <div className="entry-reorder">
              <button
                className="ghost"
                title={t("Move up (Alt+↑)")}
                onClick={() => move(entry.id, -1)}
              >
                ▲
              </button>
              <button
                className="ghost"
                title={t("Move down (Alt+↓)")}
                onClick={() => move(entry.id, 1)}
              >
                ▼
              </button>
            </div>

            <div className="entry-model">
              <span className="priority">{index + 1}.</span>
                <button
                  className="model-name"
                  title={t("View details")}
                  onClick={() => setViewingEntryId(entry.id)}
                >
                {entry.label ?? entry.model}
              </button>
              {entry.label ? <span className="small faint mono">{entry.model}</span> : null}
              <span className="small faint" title={`${t("Provider")}: ${entry.providerId}`}>
                {entry.providerId}
              </span>
              {entry.credentials.length > 0 ? (
                <span className="badge neutral" title={t("Keys bound to this node")}>
                  {entry.healthyCount}/{entry.credentials.length} {t("keys")}
                </span>
              ) : (
                <span className="badge bad">{t("no keys")}</span>
              )}
              {sweepStateBadge(sweep.states[entry.id], sweep.winnerId === entry.id, t)}
              {entry.credentials.some((credential) => credential.proxy.auto) ? (
                <span
                  className="badge neutral"
                  title={t("Automatic egress pool is assigning exits")}
                >
                  {t("auto proxy")}
                </span>
              ) : null}
              {!entry.enabled && <span className="badge warn">{t("disabled")}</span>}
            </div>

            <div className="entry-actions">
              <Tooltip label={t("View details")}>
                <button
                  className="ghost"
                  aria-label={t("View details")}
                  onClick={() => setViewingEntryId(entry.id)}
                >
                  👁
                </button>
              </Tooltip>
              <Tooltip label={t("Edit")}>
                <button
                  className="ghost"
                  aria-label={t("Edit")}
                  onClick={() => setEditingEntryId(entry.id)}
                >
                  ✎
                </button>
              </Tooltip>
              <Tooltip label={t("Duplicate")}>
                <button
                  className="ghost"
                  aria-label={t("Duplicate")}
                  onClick={() => void duplicate(entry)}
                >
                  ⧉
                </button>
              </Tooltip>
              <Tooltip label={entry.enabled ? t("Disable") : t("Enable")}>
                <button
                  className="ghost"
                  aria-label={entry.enabled ? t("Disable") : t("Enable")}
                  onClick={() => void toggleEntry(entry)}
                >
                  {entry.enabled ? "⊘" : "✓"}
                </button>
              </Tooltip>
              <button
                className="danger"
                style={{ fontSize: 12 }}
                onClick={() => setRemovingEntry(entry)}
              >
                {t("remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="entry-add-row">
        <button className="secondary" onClick={() => setAddingEntry(true)}>
          + {t("Add entry")}
        </button>
        <span className="small faint">
          {t(
            "Nodes run top to bottom. Drag or Alt+↑ / Alt+↓ to reorder; click a model to view, edit, or test its keys.",
          )}
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
          onClose={() => setCredentialTargetId(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}

      {editingEntry ? (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntryId(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}

      {viewingEntry ? (
        <ViewEntryModal
          entry={viewingEntry}
          onClose={() => setViewingEntryId(null)}
          onChanged={() => {
            onChanged();
          }}
        />
      ) : null}

      {removingEntry ? (
        <ConfirmModal
          title={t("Remove entry")}
          message={`${t("Remove")} ${removingEntry.providerId}/${removingEntry.model} ${t("from")} ${chain.alias}?`}
          onConfirm={() => void removeEntry(removingEntry)}
          onClose={() => setRemovingEntry(null)}
          actionLabel={t("Remove")}
        />
      ) : null}

      {deletingChain ? (
        <ConfirmModal
          title={t("Delete chain")}
          message={`${t("Delete chain")} ${chain.alias} ${t("and all of its entries?")}`}
          onConfirm={() => void deleteChain()}
          onClose={() => setDeletingChain(false)}
          actionLabel={t("Delete")}
        />
      ) : null}
    </div>
  );
}

function sweepStateBadge(
  state: RefreshState | undefined,
  current: boolean,
  t: (text: string) => string,
) {
  if (current) {
    return (
      <span className="badge ok" title={t("first node that answered OK")}>
        ← {t("current")}
      </span>
    );
  }
  if (state === "testing") {
    return (
      <span className="badge neutral" title={t("Testing this node's key")}>
        {t("testing…")}
      </span>
    );
  }
  if (state === "ok") {
    return (
      <span className="badge ok" title={t("Answered OK")}>
        {t("ok")}
      </span>
    );
  }
  if (state === "fail") {
    return (
      <span className="badge bad" title={t("Failed")}>
        {t("fail")}
      </span>
    );
  }
  return null;
}
