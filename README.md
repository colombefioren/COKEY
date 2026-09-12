<h1 align="center">COKEY</h1>

<p align="center">
  <strong>Local LLM credential pool and chain-fallback gateway.</strong><br />
  Point any OpenAI-compatible tool at <code>http://localhost:8787/v1</code> and let COKEY rotate
  your free API keys - across accounts, across models, across providers - without ever
  leaking a key or inventing a quota.
</p>

```
OpenCode / Kilo Code / any OpenAI-compatible client
                    ↓
                 COKEY
                    ↓
┌──────────────────────────────────────────────┐
│ Chain "cokey-best"                           │
│                                              │
│   groq / qwen3.8-27b                         │
│     Key1 → Key2 → Key3     (keys first)      │
│   ↓ only when every key is exhausted         │
│   openrouter / deepseek-v4-flash:free        │
│     Key1 → Key2                              │
└──────────────────────────────────────────────┘
```

COKEY is a local gateway, not a service. It runs on your machine, keeps your keys
encrypted at rest, and exposes one OpenAI-compatible endpoint. When a provider
rate-limits a key, COKEY cools that key down and retries the next one **inside the
same entry** - only falling through to the next entry once every key of the
current one is spent.

---

## The invariant

Routing priority is, without exception:

```
entry → credential → next credential → next entry
```

A lower-priority entry is **never** attempted while a higher-priority entry still
has an eligible, unattempted credential for the current request. Two exceptions
exist, and both are deliberate:

| Error | Behaviour |
| :-- | :-- |
| `context_too_large`, `invalid_request` | Request-shaped. Stop immediately; rotating would fail identically. |
| `model_unavailable` | Entry-shaped. Skip the entry's remaining keys; the other entries may still work. |

Everything else - `429`, quota exhaustion, invalid keys, provider 5xx, network
errors - rotates to the next key of the same entry first.

---

## Features

- **Credential-first failover** with a user-controlled entry order (drag, keyboard, or buttons).
- **Verified keys only.** A key is proven against the provider (and, where the provider
  validates per model, against the exact model) before it may join a chain.
- **Live routing feed.** A status strip names the model, key and exit IP in use right
  now, and raises a notification the moment the key or the model changes underneath a
  client. Streamed over SSE from `/api/events`.
- **Per-key egress proxies.** Bind a `socks5://` or `http://` proxy to each credential.
  Several keys from one provider only fail over *independently* when they leave through
  different IPs - otherwise they share the provider's IP-level limit.
- **Per-key throughput.** Locally measured requests-per-minute and a trailing-minute
  sparkline per credential, so two keys of the same provider are never indistinguishable.
- **340 curated free models across 45 providers**, each annotated with context window,
  best use and measured latency. A model is clickable only when its provider has a
  working key.
- **Honest quotas.** When a provider exposes no rate-limit headers, COKEY says
  `Quota: Unknown`. It never fabricates numbers.
- **OpenAI-compatible API**, including streaming, plus a full management API and CLI.
- **Encrypted at rest**, AES-256-GCM, with the master key in the OS keychain or an env var.

---

## Quick start

```bash
# from the repository
npm install
npm run build
npm start            # serves the UI and the gateway on http://127.0.0.1:8787

# or install globally
npm install -g cokey
cokey
```

Then open <http://localhost:8787> and:

1. **Providers** → pick a provider card, paste a key, COKEY verifies it inline.
   (Optionally give the key its own proxy.)
2. **Models** → pick a model. Only models whose provider has a working key are clickable.
3. **Chains** → name the chain `cokey-best`, add more entries, drag them into your order.
4. Point your tool at `http://127.0.0.1:8787/v1` with any placeholder API key.

### Client configuration

Any OpenAI-compatible tool needs only a base URL.

```jsonc
// OpenCode / Kilo Code style provider entry
{
  "provider": "cokey",
  "baseURL": "http://127.0.0.1:8787/v1",
  "apiKey": "unused-but-required-by-the-client"
}
```

> Verify the exact key names against your tool's current documentation - COKEY itself
> only cares about the base URL and that the client sends an OpenAI-shaped request.

---

## Proxy support

Provider rate limits are usually tracked per **key and per IP**, so rotating keys
from one address still trips them. Bind a distinct proxy per credential:

```bash
# in the UI: Keys → Egress → set proxy
# or over the API
curl -X PATCH http://localhost:8787/api/credentials/<id> \
  -H 'content-type: application/json' \
  -d '{"proxyUrl":"socks5://user:pass@host:1080"}'
```

- `socks5://`, `socks://`, `socks5h://` and `http(s)://` are supported (SOCKS5 via
  undici's `Socks5ProxyAgent`, HTTP CONNECT via `ProxyAgent`).
- Dispatchers are pooled per proxy URL; one key, one pool, one exit IP.
- Proxy credentials are stored with the key and are **never** returned by the API -
  responses expose `host:port` only.
- `proxyUrl: null` returns the key to direct egress.

---

## Live status and notifications

`GET /api/events` streams server-sent events. The first frame is a snapshot, so a UI
that connects mid-request still renders correctly:

```
data: {"kind":"snapshot","route":{...},"recent":[...]}

data: {"kind":"event","event":{"type":"route.attempt", ...}}
data: {"kind":"event","event":{"type":"route.switch","message":"Switched: key → Backup",
        "previous":{"credentialDescription":"Main"},"data":{"changedCredential":true}}}
data: {"kind":"event","event":{"type":"credential.cooldown","data":{"cooldownUntil":...}}}
```

`GET /api/status` returns the same snapshot plus recent events for polling clients.
Every event is local-only; there is no telemetry anywhere in COKEY.

---

## How a request is routed

1. The client asks for a chain alias (`model: "cokey-best"`).
2. Each entry is tried in the user's order.
3. Inside an entry, keys are ordered by the entry's strategy:
   - **sequential** - the order you bound them in;
   - **round-robin** - rotated per request, preferring the least-contended key so
     concurrent requests never stampede the same credential.
4. On a credential-scoped failure the key is cooled down (honouring `Retry-After`
   when present, otherwise exponential backoff with jitter) and the next key is tried.
5. `X-Cokey-*` response headers record the decision:

```
X-Cokey-Chain: cokey-best
X-Cokey-Entry: groq/qwen3.8-27b
X-Cokey-Credential: main-account
X-Cokey-Fallback: true
X-Cokey-Fallback-Reason: rate_limit
```

Headers never contain a secret.

---

## Management API

```
GET    /api/models                    # curated free models + availability
GET    /api/providers                 # catalog + connection status
POST   /api/providers/:id/connect     # { secret, description, accountId?, proxyUrl? }

GET    /api/chains
POST   /api/chains
PATCH  /api/chains/:id
DELETE /api/chains/:id
POST   /api/chains/:id/reorder        # { entryIds: [...] }

GET    /api/chains/:id/entries
POST   /api/chains/:id/entries
PATCH  /api/entries/:id
DELETE /api/entries/:id
POST   /api/entries/:id/duplicate
POST   /api/entries/:id/move

GET    /api/entries/:id/credentials
POST   /api/entries/:id/credentials   # { secret, description, proxyUrl?, addAnyway? }
DELETE /api/entries/:id/credentials/:credentialId

GET    /api/credentials
PATCH  /api/credentials/:id           # { description?, secret?, status?, proxyUrl? }
DELETE /api/credentials/:id
POST   /api/credentials/:id/test
GET    /api/credentials/:id/quota

GET    /api/status                    # live route + recent events
GET    /api/events                    # SSE: routing notifications
GET    /api/stats
GET    /api/requests
DELETE /api/requests
GET    /api/settings
PATCH  /api/settings
GET    /api/nudge                     # free-provider coverage suggestions
GET    /api/config/export
```

No response ever contains a stored secret.

---

## CLI

```bash
cokey                        # start the gateway and UI
cokey start                  # same, explicit
cokey stop                   # stop a background gateway
cokey status                 # gateway, chain and credential summary
cokey doctor                 # local diagnostics
cokey chains                 # list chains; also create/delete/add/remove/reorder/move
cokey entries                # every entry across all chains
cokey providers              # catalog + free tier + connection state
cokey models [provider]      # curated free models, marking usable providers
cokey keys                   # credential inventory with per-key rate and egress
cokey keys test <id>         # re-verify one credential
cokey requests               # local request history
cokey stats                  # aggregate usage
cokey config                 # open the web UI
cokey export [file]          # portable config (never secrets)
cokey import <file>          # import config
cokey credentials <file>     # create credentials declared in a file
cokey catalog                # dump the provider catalog
```

---

## Programmatic API

```ts
import { Cokey } from "cokey";

const cokey = new Cokey({ port: 8787 });
cokey.start();

await cokey.addChain({
  alias: "cokey-best",
  entries: [
    {
      provider: "groq",
      model: "qwen/qwen3.8-27b",
      credentials: [
        { env: "GROQ_KEY_1", description: "Main" },
        { env: "GROQ_KEY_2", description: "Backup" },
      ],
    },
  ],
});
```

---

## Security

- Secrets are encrypted with **AES-256-GCM**; the on-disk value is
  `v1:` + `base64(iv ‖ authTag ‖ ciphertext)`.
- The master key comes from `COKEY_MASTER_KEY`, a passphrase
  (`COKEY_PASSPHRASE`), the OS keychain, or a `0600` key file - in that order.
- The log redactor drops sensitive field names and rewrites token-shaped values,
  so an `Authorization` header cannot reach a log line.
- A credential is never serialised raw: HTTP responses use a masked projection.
- Custom endpoints pass an SSRF guard; private ranges are refused unless explicitly
  allowed in settings.
- Redirects are never followed, so an upstream cannot bounce an `Authorization`
  header to another origin.
- Local-only by default. No telemetry, no phone-home.

---

## Testing

```bash
npm test          # vitest
npm run typecheck # server, tests and web UI
```

The suite covers the routing invariant (key rotation before entry fallback,
cross-entry fallback order, request-scoped early exit, user reordering, cooldown
skipping), live event emission, proxy parsing and wiring, per-credential rate
tracking, and model-availability gating.

---

## Architecture

```
src/
├── catalog/          curated provider + free-model data (data, not code paths)
├── cli/              command-line interface
├── core/
│   ├── chains/       chain and entry ordering
│   ├── credentials/  lifecycle, cooldowns, selection, rate tracking
│   ├── crypto/       AES-256-GCM vault and master-key resolution
│   ├── db/           SQLite schema, migrations and repositories
│   ├── errors/       provider error classification
│   ├── events/       routing event bus
│   ├── models/       model catalog × credential availability
│   ├── providers/    adapters, HTTP executor, proxy dispatchers
│   ├── quota/        rate-limit header parsing
│   ├── router/       the fallback engine
│   └── security/     SSRF guard
├── server/           Fastify: OpenAI surface, management API, SSE
└── web/              React + Vite UI
```

Adding a provider is a data change: append to the catalog. No router, adapter or UI
code needs to change for another OpenAI-compatible service.

---

## License

MIT.
