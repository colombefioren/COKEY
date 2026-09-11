import type { ProviderStatus } from "../types.js";

/**
 * A single catalog card.
 *
 * Deliberately not a form: the user picks a provider, and only then is asked
 * for a key. Base URLs and auth schemes are never typed by hand.
 */
export function ProviderCard({
  provider,
  onConnect,
}: {
  provider: ProviderStatus;
  onConnect: (provider: ProviderStatus) => void;
}) {
  const free = provider.freeTier.advertised;
  const credentialLabel =
    provider.credentialFields.includes("accountId") ? "API token + account id" : "API key";

  return (
    <div className="card">
      <div className="title">
        {provider.displayName}
        {free ? <span className="badge">Free</span> : <span className="badge neutral">Billed</span>}
      </div>
      <div className="sub">{provider.freeTier.summary}</div>
      <div className="sub mono" style={{ overflowWrap: "anywhere" }}>
        {provider.knownModels.length} models · {credentialLabel}
      </div>

      {provider.notes ? <div className="sub faint">{provider.notes}</div> : null}

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => onConnect(provider)}>Connect</button>
        {provider.signupUrl ? (
          <a className="small" href={provider.signupUrl} target="_blank" rel="noreferrer">
            Get a free key ↗
          </a>
        ) : null}
        <span className="spacer" style={{ flex: 1 }} />
        <span className="small faint">
          {provider.connected ? `${provider.credentialCount} connected` : "not connected"}
        </span>
      </div>
    </div>
  );
}
