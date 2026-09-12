<div align="center">

<img src="./docs/assets/cokey-logo.svg" alt="COKEY" width="440" />

<br />
<br />

**Local LLM credential pool and chain-fallback gateway.**

Point any OpenAI-compatible tool at `http://localhost:8787/v1` and let COKEY rotate your free API
keys, across accounts, across models, across providers, without ever leaking a key or inventing a
quota.

[![License: MIT](https://img.shields.io/badge/License-MIT-D9A9CC?style=flat-square&labelColor=0E1140)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D%2020.10-9672A6?style=flat-square&labelColor=0E1140)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-9672A6?style=flat-square&labelColor=0E1140)](https://www.typescriptlang.org/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-D9A9CC?style=flat-square&labelColor=0E1140)](https://github.com/colombefioren/COKEY/pulls)
[![No telemetry](https://img.shields.io/badge/telemetry-none-9672A6?style=flat-square&labelColor=0E1140)](#security)

<sub><b>a tool for broke lads made by a broke princess</b></sub>

<br />

<img src="./docs/assets/cokey-mark.svg" alt="COKEY mark" width="120" />

</div>

---

<div align="center">

## What it actually does

</div>

```
your editor / CLI / agent
          |
          v
   +--------------+        one OpenAI-compatible endpoint, one alias per chain
   |    COKEY     |
   +--------------+
          |
          v
   chain "cokey-best"
     |
     +-- node 1   groq / qwen3.8-27b          keys: (o) (o) (o)   left to right
     |                                          |
     |                                          +-- exhausted, cool the key down
     |
     +-- node 2   openrouter / deepseek:free   keys: (o) (o)
     |
     +-- node 3   cloudflare / gpt-oss-120b    keys: (o)
```

A lower-priority node is **never** tried while a higher-priority node still has an eligible key for
the current request. Keys rotate first, nodes only after.

<br />

<div align="center">

## Contents

</div>

<table>
  <tr>
    <td align="right"><b>Start</b></td>
    <td><a href="#quick-start">Quick start</a></td>
    <td><a href="#client-configuration">Client config</a></td>
    <td><a href="#cli">CLI</a></td>
  </tr>
  <tr>
    <td align="right"><b>Concepts</b></td>
    <td><a href="#the-invariant">The invariant</a></td>
    <td><a href="#how-a-request-is-routed">Routing</a></td>
    <td><a href="#the-live-route">Live route</a></td>
  </tr>
  <tr>
    <td align="right"><b>Features</b></td>
    <td><a href="#features">Features</a></td>
    <td><a href="#automatic-egress-pool">Egress pool</a></td>
    <td><a href="#management-api">API</a></td>
  </tr>
  <tr>
    <td align="right"><b>Project</b></td>
    <td><a href="#architecture">Architecture</a></td>
    <td><a href="#credits">Credits</a></td>
    <td><a href="#contact-the-creator">Contact</a></td>
  </tr>
</table>

---

<div align="center">

## The invariant

</div>

Routing priority is, without exception:

```
node -> key -> next key -> next node
```

A lower-priority node is **never** attempted while a higher-priority node still has an eligible,
unattempted key for the current request. Two exceptions exist, and both are deliberate:

| Error | Behaviour |
| :---- | :-------- |
| `context_too_large`, `invalid_request` | Request-shaped. Stop immediately, rotating would fail identically. |
| `model_unavailable` | Node-shaped. Skip the node's remaining keys, the other nodes may still work. |

Everything else rotates to the next key of the same node first: `429`, quota exhaustion, invalid
keys, provider `5xx`, network errors.

---

<div align="center">

## Features

</div>

- **Key-first failover** with a user-controlled node order (drag, keyboard, or buttons).
- **Verified keys only.** A key is proven against the provider, and against the exact model where
  the provider validates per model, before it may join a chain.
- **The live route.** A dashboard diagram draws the chain as it is walked, lighting up the node
  and the exact key serving the current request. The topbar chip narrates every key or model
  change the moment it happens, over SSE from `/api/events`.
- **Automatic egress pool.** Add proxies once and COKEY spreads them so two keys of the *same*
  provider never share an exit IP, while keys of different providers may share one. No manual
  wiring, stable across restarts.
- **Per-key throughput.** Locally measured requests-per-minute and a trailing-minute sparkline per
  credential, so two keys of the same provider are never indistinguishable.
- **Model test button.** The play button in Models sends one real hello through a working key and
  only turns green on a `200`, with the reply and latency shown.
- **Rankings you can audit.** Coding skill, rate limits and a combined board, each row naming its
  source so a third-party blog post is never mistaken for provider documentation.
- **Honest quotas.** When a provider exposes no rate-limit headers, COKEY says `Quota: Unknown`. It
  never fabricates numbers.
- **340 curated free models across 45 providers**, each annotated with context window, best use and
  measured latency.
- **Your name for the model.** A node's display label is free text you type. COKEY never invents
  something like `DeepSeek V4 Pro (xKiro)`.
- **OpenAI-compatible API** including streaming, plus a full management API and CLI.
- **Encrypted at rest**, AES-256-GCM, with the master key in the OS keychain or an env var.

---

<div align="center">

## Quick start

</div>

```bash
# from the repository
npm install
npm run build
npm start            # UI and gateway on http://127.0.0.1:8787

# or install globally
npm install -g cokey
cokey
```

Running `cokey` prints the logo and starts everything:

```
                             ,/,
                           ,'  /
   _.-''''-._          _.-''''-._
 .'          '.      .'          '.
/              \    /              \
|               \  /               |
|                \/                |
|                /\                |
|               /  \               |
\              /    \              /
 '.          .'      '.          '.
   '-......-'          '-......-'

  C O K E Y  v0.1.0
  a tool for broke lads made by a broke princess

  gateway:  http://127.0.0.1:8787/v1
  ui:       http://127.0.0.1:8787/
```

Then open <http://localhost:8787> and:

1. **Chains** -> create a chain, for example `cokey-best`.
2. **Chains -> Keys**, or **Providers**, -> paste an API key, COKEY verifies it inline.
3. Add nodes to the chain, pick the keys each node may use, drag them into your order.
4. Point your tool at `http://127.0.0.1:8787/v1` with any placeholder API key.

<br />

<div align="center">

## Client configuration

</div>

Any OpenAI-compatible tool needs only a base URL. The provider is always `COKEY` and the model is
whatever you called your chain.

```jsonc
// OpenCode / Kilo Code style provider entry
{
  "provider": "cokey",
  "baseURL": "http://127.0.0.1:8787/v1",
  "apiKey": "unused-but-required-by-the-client"
}
```

> Verify the exact key names against your tool's current documentation. COKEY only cares about the
> base URL and that the client sends an OpenAI-shaped request.

Per-tool walkthroughs for Claude Code, Cursor, JetBrains, Cline, Continue, opencode, Hermes Agent,
OpenClaw, Codex CLI and other CLIs live in the app under **Tutorial**.

---

<div align="center">

## How a request is routed

</div>

1. The client asks for a chain alias (`model: "cokey-best"`).
2. Each node is tried in the user's order.
3. Inside a node, keys are ordered by the node's strategy:
   - **sequential**, the order you bound them in;
   - **round-robin**, rotated per request, preferring the least-contended key so concurrent
     requests never stampede the same credential.
4. On a credential-scoped failure the key is cooled down, honouring `Retry-After` when present and
   otherwise using exponential backoff with jitter, and the next key is tried.
5. `X-Cokey-*` response headers record the decision:

```
X-Cokey-Provider: COKEY
X-Cokey-Chain: cokey-best
X-Cokey-Entry: groq/qwen3.8-27b
X-Cokey-Credential: main-account
X-Cokey-Fallback: true
X-Cokey-Fallback-Reason: rate_limit
X-Cokey-State: chain changed state: cokey-best now on groq/qwen3.8-27b via main-account (rate_limit)
```

Headers never contain a secret. Clients that surface headers, which most CLIs do, pick up the state
change notification from `X-Cokey-State` without any integration work.

<br />

<div align="center">

## The live route

</div>

`GET /api/events` streams server-sent events. The first frame is a snapshot, so a UI that connects
mid-request still renders correctly:

```
data: {"kind":"snapshot","route":{...},"recent":[...]}

data: {"kind":"event","event":{"type":"route.attempt", ...}}
data: {"kind":"event","event":{"type":"chain.state","message":"chain changed state: cokey-best now on ..."}}
data: {"kind":"event","event":{"type":"credential.cooldown","data":{"cooldownUntil":...}}}
```

`GET /api/status` returns the same snapshot plus recent events for polling clients. Every event is
local-only. There is no telemetry anywhere in COKEY.

<br />

<div align="center">

## Automatic egress pool

</div>

Provider limits are usually tracked per **key and per IP**, so rotating keys from one address still
trips them. The pool fixes that without any manual wiring:

- every key of a provider gets a different pool entry, so two keys of one provider never share an
  exit IP;
- two keys of *different* providers may share an entry, because nothing correlates them upstream;
- the mapping is derived from the provider id and the pool order, so it is stable across restarts.

```bash
# seed a pool without touching the UI
COKEY_PROXY_POOL="socks5://user:pass@host:1080,http://host:3128" cokey
```

Or bind a single key by hand, which pins it and takes it out of the pool:

```bash
curl -X PATCH http://localhost:8787/api/credentials/<id> \
  -H 'content-type: application/json' \
  -d '{"proxyUrl":"socks5://user:pass@host:1080"}'
```

- `socks5://`, `socks://`, `socks5h://` and `http(s)://` are supported (SOCKS5 via undici's
  `Socks5ProxyAgent`, HTTP CONNECT via `ProxyAgent`).
- Dispatchers are pooled per proxy URL. One key, one pool, one exit IP.
- Proxy credentials are stored with the key and are **never** returned by the API. Responses expose
  `host:port` only.
- `proxyUrl: null` returns the key to direct egress.

---

<div align="center">

## Management API

</div>

```
GET    /api/models                    # curated free models + availability
POST   /api/models/probe              # real hello through a working key
GET    /api/providers                 # catalog + connection status
POST   /api/providers/:id/connect     # { secret, description, accountId?, proxyUrl? }

GET    /api/catalog/rankings          # skill, rate, combined and redundancy boards
GET    /api/catalog/providers         # provider dossiers

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

GET    /api/proxy-pool                # pool entries + assignment plan
POST   /api/proxy-pool
PATCH  /api/proxy-pool/:id
DELETE /api/proxy-pool/:id

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

<div align="center">

## CLI

</div>

```bash
cokey                        # start the gateway and UI
cokey start                  # same, explicit
cokey stop                   # stop a background gateway
cokey status                 # gateway, chain and credential summary
cokey doctor                 # local diagnostics
cokey chains                 # list chains; also create/delete/add/remove/reorder/move
cokey entries                # every node across all chains
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

<div align="center">

## Programmatic API

</div>

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

<div align="center">

## Security

</div>

- Secrets are encrypted with **AES-256-GCM**. The on-disk value is
  `v1:` + `base64(iv, authTag, ciphertext)`.
- The master key comes from `COKEY_MASTER_KEY`, a passphrase (`COKEY_PASSPHRASE`), the OS keychain,
  or a `0600` key file, in that order.
- The log redactor drops sensitive field names and rewrites token-shaped values, so an
  `Authorization` header cannot reach a log line.
- A credential is never serialised raw. HTTP responses use a masked projection.
- Custom endpoints pass an SSRF guard. Private ranges are refused unless explicitly allowed in
  settings.
- Redirects are never followed, so an upstream cannot bounce an `Authorization` header to another
  origin.
- Local-only by default. No telemetry, no phone-home.

---

<div align="center">

## Testing

</div>

```bash
npm test          # vitest
npm run typecheck # server, tests and web UI
```

The suite covers the routing invariant (key rotation before node fallback, cross-node fallback
order, request-scoped early exit, user reordering, cooldown skipping), live event emission, proxy
parsing and wiring, per-credential rate tracking, and model-availability gating.

---

<div align="center">

## Architecture

</div>

```
src/
├── catalog/          curated provider + free-model data, dossiers and rankings
├── cli/              command-line interface and the ASCII banner
├── core/
│   ├── chains/       chain and node ordering
│   ├── credentials/  lifecycle, cooldowns, selection, rate tracking
│   ├── crypto/       AES-256-GCM vault and master-key resolution
│   ├── db/           SQLite schema, migrations, repositories
│   ├── errors/       provider error classification
│   ├── events/       routing event bus
│   ├── models/       model catalog, availability and live probes
│   ├── providers/    adapters, HTTP executor, proxy dispatchers, egress pool
│   ├── quota/        rate-limit header parsing
│   ├── router/       the fallback engine
│   └── security/     SSRF guard
├── server/           Fastify: OpenAI surface, management API, SSE
└── web/              React + Vite UI
```

Adding a provider is a data change: append to the catalog. No router, adapter or UI code needs to
change for another OpenAI-compatible service.

---

<div align="center">

## Credits

</div>

The provider and free-tier catalog is built in part from
**[awesome-free-byok-models](https://github.com/velo4705/awesome-free-byok-models)** by
[velo4705](https://github.com/velo4705). Thank you for collecting and keeping that list honest.

Rate limits and capabilities change constantly, so every ranking board in the app names its source
and leaves the judgement to you.

---

<div align="center">

## Contact the creator

</div>

COKEY is built and maintained by **colombefioren**. Bug reports, provider tips and pull requests
are all welcome.

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-colombefioren-D9A9CC?style=for-the-badge&logo=github&logoColor=0E1140&labelColor=0E1140)](https://github.com/colombefioren)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-colombefioren-9672A6?style=for-the-badge&logo=linkedin&logoColor=0E1140&labelColor=0E1140)](https://www.linkedin.com/in/colombefioren)
[![Facebook](https://img.shields.io/badge/Facebook-colombe.fioren-9672A6?style=for-the-badge&logo=facebook&logoColor=0E1140&labelColor=0E1140)](https://www.facebook.com/colombe.fioren)
[![Source](https://img.shields.io/badge/Source-colombefioren%2FCOKEY-D9A9CC?style=for-the-badge&logo=github&logoColor=0E1140&labelColor=0E1140)](https://github.com/colombefioren/COKEY)

</div>

### Contributing

COKEY is MIT licensed and open source. Fork it, branch, and open a pull request:

```bash
git clone https://github.com/colombefioren/COKEY.git
cd COKEY
npm install
npm run typecheck && npm test
```

1. Fork the repository.
2. Create your branch (`git checkout -b feat/amazing-feature`).
3. Run `npm run typecheck` and `npm test` before pushing.
4. Open a pull request with a clear description of what changed and why.

<br />

<div align="center">

## Stack

</div>

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2020%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![React](https://img.shields.io/badge/React%2018-61DAFB?style=flat-square&logo=react&logoColor=0E1140)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

</div>

---

<div align="center">

## License

MIT. See [LICENSE](LICENSE).

<img src="./docs/assets/cokey-mark.svg" alt="COKEY" width="72" />

<sub>a tool for broke lads made by a broke princess</sub>

</div>
