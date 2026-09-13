import { useEffect, useRef, useState } from "react";
import { api, timeAgo } from "../api.js";
import type { CokeyEvent, LiveRouteSnapshot } from "../types.js";
import { useToast } from "./Toast.js";

/** Keep the notification feed bounded; the router is chatty by nature. */
const MAX_EVENTS = 40;

/**
 * The live routing strip.
 *
 * COKEY silently rotates credentials, so a client cannot tell that their
 * request moved from a depleted Groq key to a fresh one. This component makes
 * that visible: the chip always names the model, the key and the exit IP in
 * play, and switches are announced as notifications the moment they happen.
 *
 * Data arrives over SSE (`/api/events`); a snapshot frame seeds the view so a
 * reload never starts blank.
 */
export function LiveStatus() {
  const toast = useToast();
  const [route, setRoute] = useState<LiveRouteSnapshot | null>(null);
  const [events, setEvents] = useState<CokeyEvent[]>([]);
  const [open, setOpen] = useState(false);

  // Event ids are stable, so a reconnecting EventSource cannot double-notify.
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let closed = false;

    const accept = (incoming: CokeyEvent[]) => {
      const fresh = incoming.filter((event) => !seen.current.has(event.id));
      for (const event of fresh) seen.current.add(event.id);
      if (fresh.length === 0) return;
      setEvents((current) => [...current, ...fresh].slice(-MAX_EVENTS));
    };

    void api
      .status(MAX_EVENTS)
      .then((snapshot) => {
        if (closed) return;
        setRoute(snapshot.route);
        for (const event of snapshot.recent) seen.current.add(event.id);
        setEvents(snapshot.recent.slice(-MAX_EVENTS));
      })
      .catch(() => {
        // The gateway may still be starting; SSE will carry the state.
      });

    const source = new EventSource(api.eventsUrl());

    source.onmessage = (message) => {
      let payload: unknown;
      try {
        payload = JSON.parse(message.data);
      } catch {
        return;
      }
      const frame = payload as
        | { kind: "snapshot"; route: LiveRouteSnapshot; recent: CokeyEvent[] }
        | { kind: "event"; event: CokeyEvent };

      if (frame.kind === "snapshot") {
        setRoute(frame.route);
        accept(frame.recent ?? []);
        return;
      }

      const event = frame.event;
      if (!event || seen.current.has(event.id)) return;

      if (event.type === "route.attempt" || event.type === "route.start") {
        setRoute((current) => ({
          active: true,
          fallback: current?.fallback ?? false,
          attempts: current?.attempts ?? 0,
          updatedAt: Date.now(),
          chainAlias: event.chainAlias ?? current?.chainAlias,
          providerId: event.providerId ?? current?.providerId,
          model: event.model ?? current?.model,
          credentialId: event.credentialId ?? current?.credentialId,
          credentialDescription: event.credentialDescription ?? current?.credentialDescription,
          proxyLabel: event.proxyLabel ?? current?.proxyLabel,
        }));
      }

      if (event.type === "route.success") {
        setRoute((current) =>
          current
            ? {
                ...current,
                active: false,
                lastOutcome: "success",
                providerId: event.providerId ?? current.providerId,
                model: event.model ?? current.model,
                credentialId: event.credentialId ?? current.credentialId,
                credentialDescription: event.credentialDescription ?? current.credentialDescription,
                proxyLabel: event.proxyLabel ?? current.proxyLabel,
              }
            : current,
        );
      }

      if (event.type === "route.switch") {
        const changedModel =
          event.previous?.model !== undefined && event.previous.model !== event.model;
        const label = changedModel ? "Model changed" : "Key changed";
        const from = event.previous?.credentialDescription
          ? `${event.previous.providerId ?? "?"}/${event.previous.model ?? "?"} · ${event.previous.credentialDescription}`
          : undefined;
        toast.info(
          `${label} → ${event.message.replace(/^Switched:\s*/, "")}${from ? ` (was ${from})` : ""}`,
        );
      }

      if (event.type === "credential.cooldown") toast.info(event.message);
      if (event.type === "credential.invalid") toast.err(event.message);

      accept([event]);
    };

    source.onerror = () => {
      // EventSource reconnects on its own; nothing to do beyond letting it.
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [toast]);

  const model = route?.model ? `${route.providerId ?? "?"}/${route.model}` : "no traffic yet";
  const key = route?.credentialDescription ?? "—";

  return (
    <div className="live">
      <button
        type="button"
        className={`live-chip ${route?.active ? "active" : "idle"}`}
        onClick={() => setOpen((value) => !value)}
        title={route?.active ? "A request is being routed right now" : "Last routed request"}
      >
        <span className="live-dot" aria-hidden>
          ●
        </span>
        <span className="live-model mono">{model}</span>
        <span className="live-sep">·</span>
        <span className="live-key">{key}</span>
        {route?.maskedSecret ? <span className="live-mask mono">{route.maskedSecret}</span> : null}
        {route?.proxyLabel ? <span className="live-proxy mono">via {route.proxyLabel}</span> : null}
        {route?.fallback ? <span className="badge warn">fallback</span> : null}
        {route?.lastOutcome === "error" && !route.active ? (
          <span className="badge bad">last error</span>
        ) : null}
        <span className="live-count">{events.length}</span>
      </button>

      {open ? (
        <div className="live-panel">
          <div className="live-panel-head">
            <strong>Routing feed</strong>
            <span className="spacer" />
            <span className="small faint">
              {route?.active
                ? `attempt ${route.attempts + 1} in flight`
                : route?.updatedAt
                  ? `idle · updated ${timeAgo(route.updatedAt)}`
                  : "idle"}
            </span>
          </div>
          {events.length === 0 ? (
            <div className="empty small">No routing activity yet.</div>
          ) : (
            <ul className="live-list">
              {[...events].reverse().map((event) => (
                <li key={event.id} className={`live-item ${event.level}`}>
                  <span className="live-time mono">{new Date(event.at).toLocaleTimeString()}</span>
                  <span className="live-type">{event.type}</span>
                  <span className="live-msg">{event.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
