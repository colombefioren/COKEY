<div align="center">

<img src="./docs/assets/cokey-logo.svg" alt="COKEY" width="440" />

<br />
<br />

**a tool for broke lads made by a broke princess**

<br />

[![npm](https://img.shields.io/npm/v/cokey?style=flat-square&color=DD5C95&labelColor=2B1A2F&logo=npm&logoColor=white)](https://www.npmjs.com/package/cokey)
[![Docker Hub](https://img.shields.io/docker/v/cocofiore/cokey?style=flat-square&color=F482B4&labelColor=2B1A2F&logo=docker&logoColor=white&label=docker)](https://hub.docker.com/r/cocofiore/cokey)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F9D74?style=flat-square&labelColor=2B1A2F)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D%2020.10-6B86E8?style=flat-square&labelColor=2B1A2F)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-7452F0?style=flat-square&labelColor=2B1A2F)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-passing-2F9D74?style=flat-square&labelColor=2B1A2F)](tests)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-D98830?style=flat-square&labelColor=2B1A2F)](https://github.com/colombefioren/COKEY/pulls)
[![No telemetry](https://img.shields.io/badge/telemetry-none-7452F0?style=flat-square&labelColor=2B1A2F)](#-security)
[![Price](https://img.shields.io/badge/price-%240.00-F482B4?style=flat-square&labelColor=2B1A2F)](#-every-free-lab-one-endpoint)

<br />

<br />
<br />

# 🔑 400+ free models &middot; 50+ providers, one key

### No subscription. No credit card. Not a dime.

OpenAI-compatible access to GPT-oss, Mistral, DeepSeek, Qwen, Gemini, GLM and dozens more — every single one of them through a real, self-replenishing free tier, stitched behind one endpoint that never tells your editor a key just died.

**100% free, always.** No trial credit that quietly runs out, no "free" that needs a card on file.

</div>

---

<div align="center">

## 🧠 What COKEY actually does

</div>

<img src="./docs/assets/chain-flow.svg" alt="A request entering COKEY, spending every key of node one, then falling back to node two" width="980" />

You build a **chain**: an ordered list of nodes, each one a model on a provider you've connected. Point your tool at that chain's alias instead of a single model name.

Each node can hold more than one key. When a key hits its free tier limit, COKEY doesn't stop — it rotates to the next key bound to that same node and retries. Only once every key on a node is exhausted does the chain fall through to the next node in your order.

- A key runs out, the next key on the same node picks up the request.
- Every key on a node is spent, the chain moves to the next node.
- A whole provider goes down, that node is skipped and the rest of the chain is untouched.

You write code. COKEY absorbs the rate limits, the dead keys and the outages behind one endpoint.

There's one more wall free tiers hit that key rotation alone can't solve: most providers cap usage per IP as well as per key, so cycling through keys from the same address just trips the same limit again. Turn on COKEY's automatic egress pool and every key gets its own exit IP, so two keys of the same provider never share an address, and rotating a key also rotates the limit tied to it. It's off by default and opt-in from Settings.

<table align="center">
  <tr>
    <td align="center"><b>Key-first rotation</b><br /><sub>429, invalid key and provider 5xx rotate the key, not the chain</sub></td>
    <td align="center"><b>Node fallback</b><br /><sub>a node that can't serve is skipped, in the order you chose</sub></td>
    <td align="center"><b>One endpoint</b><br /><sub>every client keeps working when a key rotates underneath it</sub></td>
  </tr>
  <tr>
    <td align="center"><b>Live route</b><br /><sub>watch which node and key are serving right now, live</sub></td>
    <td align="center"><b>Per-key egress</b><br /><sub>two keys of one provider never share an exit IP</sub></td>
    <td align="center"><b>Honest quotas</b><br /><sub>no rate-limit header means Quota: Unknown, never a guess</sub></td>
  </tr>
</table>

---

<div align="center">

## 🧩 Every client you already use

One base URL. Take an API key from COKEY (or use a placeholder) and point any of these at it.

</div>

<table align="center">
  <tr>
    <td align="center"><img src="https://cdn.simpleicons.org/opencode" width="28" height="28" alt="opencode" /><br /><b>opencode</b><br /><sub>the reference client</sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/claude" width="28" height="28" alt="Claude Code" /><br /><b>Claude Code</b><br /><sub>Anthropic wire format</sub></td>
    <td align="center"><img src="./docs/assets/plate.svg" width="28" height="28" alt="Codex CLI" /><br /><b>Codex CLI</b><br /><sub>OpenAI-compatible base URL</sub></td>
    <td align="center"><img src="https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/visual-studio-code.svg" width="28" height="28" alt="VS Code" /><br /><b>VS Code</b><br /><sub>Cline, Roo, Copilot Chat</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://cdn.simpleicons.org/cursor" width="28" height="28" alt="Cursor" /><br /><b>Cursor</b><br /><sub>custom OpenAI provider</sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/jetbrains" width="28" height="28" alt="JetBrains" /><br /><b>JetBrains IDEs</b><br /><sub>AI Assistant endpoint</sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/cline" width="28" height="28" alt="Cline" /><br /><b>Cline and forks</b><br /><sub>OpenAI-compatible</sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/gnometerminal" width="28" height="28" alt="Any CLI" /><br /><b>Any other CLI</b><br /><sub>base URL and a placeholder key</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://cdn.simpleicons.org/windsurf" width="28" height="28" alt="Windsurf" /><br /><b>Windsurf</b><br /><sub>Cascade with a custom endpoint</sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/zedindustries" width="28" height="28" alt="Zed" /><br /><b>Zed</b><br /><sub>OpenAI-compatible provider</sub></td>
    <td align="center"><img src="./docs/assets/plate.svg" width="28" height="28" alt="Continue" /><br /><b>Continue</b><br /><sub>VS Code and JetBrains extension</sub></td>
    <td align="center"><img src="./docs/assets/plate.svg" width="28" height="28" alt="Kilo Code" /><br /><b>Kilo Code</b><br /><sub>agent frameworks</sub></td>
  </tr>
</table>

---

<div align="center">

## 🌐 Every free lab, one endpoint

50+ providers, every one of them free. Connect a key once and use it from any chain.

</div>

<table align="center">
  <tr>
    <td align="center"><img src="https://cdn.simpleicons.org/googlegemini" width="26" height="26" alt="Google Gemini" /><br /><sub><b>Google Gemini</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/mistralai" width="26" height="26" alt="Mistral AI" /><br /><sub><b>Mistral AI</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/nvidia" width="26" height="26" alt="NVIDIA NIM" /><br /><sub><b>NVIDIA NIM</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/cloudflare" width="26" height="26" alt="Cloudflare Workers AI" /><br /><sub><b>Cloudflare</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/huggingface" width="26" height="26" alt="Hugging Face" /><br /><sub><b>Hugging Face</b></sub></td>
  </tr>
  <tr>
    <td align="center"><img src="https://cdn.simpleicons.org/openrouter" width="26" height="26" alt="OpenRouter" /><br /><sub><b>OpenRouter</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/ollama" width="26" height="26" alt="Ollama Cloud" /><br /><sub><b>Ollama Cloud</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/opencode" width="26" height="26" alt="OpenCode Zen" /><br /><sub><b>OpenCode Zen</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/amd" width="26" height="26" alt="AMD Radeon API" /><br /><sub><b>AMD Radeon</b></sub></td>
    <td align="center"><img src="https://cdn.simpleicons.org/alibabacloud" width="26" height="26" alt="ModelScope" /><br /><sub><b>ModelScope</b></sub></td>
  </tr>
</table>

<div align="center"><sub>...and many more.</sub></div>

Every provider's real free tier limits — RPD, RPM, TPD, whatever they publish — are documented in the app under **Providers**, not guessed.

---

<div align="center">

## 🛡️ Resilience

</div>

<img src="./docs/assets/resilience-layers.svg" alt="Layer one: chain fallback. Layer two: key cooldown. Layer three: model gating" width="980" />

<table align="center">
  <tr>
    <td align="center"><b>Layer</b></td>
    <td align="center"><b>Scope</b></td>
    <td align="center"><b>Handles</b></td>
    <td align="center"><b>You see</b></td>
  </tr>
  <tr>
    <td align="center"><b>1</b></td>
    <td align="center">whole chain</td>
    <td align="center">a node that can't serve at all</td>
    <td align="center">the request walks on to the next node</td>
  </tr>
  <tr>
    <td align="center"><b>2</b></td>
    <td align="center">one key</td>
    <td align="center"><code>429</code>, invalid key, provider <code>5xx</code></td>
    <td align="center">that key cools down, its siblings keep serving</td>
  </tr>
  <tr>
    <td align="center"><b>3</b></td>
    <td align="center">one model</td>
    <td align="center">a model whose key isn't verified</td>
    <td align="center">the model is offered only when it can run</td>
  </tr>
</table>

---

<div align="center">

## ⚔️ Why COKEY

</div>

<table align="center">
  <tr>
    <td align="center"><b>❌ Without COKEY</b></td>
    <td align="center"><b>✅ With COKEY</b></td>
  </tr>
  <tr>
    <td align="center">A free tier dies mid-session and the tool just errors</td>
    <td align="center">The next key on the same node picks up the request</td>
  </tr>
  <tr>
    <td align="center">Every provider wants its own config, in its own format</td>
    <td align="center">One base URL. The provider is always COKEY, the model is your alias</td>
  </tr>
  <tr>
    <td align="center">Rate limits are per key and per IP, so rotating keys does nothing</td>
    <td align="center">Keys of one provider get separate exit IPs, automatically</td>
  </tr>
  <tr>
    <td align="center">A key that looks fine fails the moment you use it</td>
    <td align="center">Keys are proven against the provider before they can join a chain</td>
  </tr>
  <tr>
    <td align="center">Quota numbers in most tools are made up</td>
    <td align="center">Unknown is reported as unknown, never invented</td>
  </tr>
  <tr>
    <td align="center">You can't tell two keys of the same provider apart</td>
    <td align="center">Per-key throughput, measured requests per minute</td>
  </tr>
  <tr>
    <td align="center">Failover is invisible until something breaks</td>
    <td align="center">The live route shows exactly which node and key are serving, live</td>
  </tr>
  <tr>
    <td align="center">Your keys sit in a plaintext file somewhere</td>
    <td align="center">Encrypted at rest with AES-256-GCM</td>
  </tr>
</table>

---

<div align="center">

## 🖥️ Where COKEY runs

</div>

<table align="center">
  <tr>
    <td align="center"><b>Platform</b></td>
    <td align="center"><b>Command</b></td>
  </tr>
  <tr>
    <td align="center">npm (global)</td>
    <td align="center"><code>npm install -g cokey &amp;&amp; cokey</code></td>
  </tr>
  <tr>
    <td align="center">Docker</td>
    <td align="center"><code>docker run -p 8787:8787 -v cokey:/data cocofiore/cokey</code></td>
  </tr>
  <tr>
    <td align="center">Render / Railway / Fly</td>
    <td align="center">build <code>npm install &amp;&amp; npm run build</code>, start <code>npm start</code></td>
  </tr>
  <tr>
    <td align="center">From source</td>
    <td align="center"><code>npm install &amp;&amp; npm run build &amp;&amp; npm start</code></td>
  </tr>
  <tr>
    <td align="center">Any OpenAI-compatible client</td>
    <td align="center">just the base URL, nothing to install</td>
  </tr>
  <tr>
    <td align="center">Programmatic API</td>
    <td align="center"><code>import { Cokey } from "cokey"</code></td>
  </tr>
</table>

Local, containerized or platform-hosted, the privacy story doesn't change: SQLite on disk, secrets encrypted with AES-256-GCM, nothing phoned home. `COKEY_HOST` starts at `127.0.0.1` until you tell it otherwise.

---

## ⚙️ Client configuration

Any OpenAI-compatible tool needs only a base URL. The provider is always `COKEY`, the model is whatever you named your chain.

```jsonc
{
  "provider": "cokey",
  "baseURL": "http://127.0.0.1:8787/v1",
  "apiKey": "your_cokey_api_key"
}
```

COKEY ignores the API key value unless you've created a gateway key of your own. Per-tool walkthroughs for Claude Code, Cursor, JetBrains, Cline, Continue, opencode and other CLIs live in the app under **Tutorial**.

Contact, bug reports and provider tips live in the app under **Terms** and **About**, since that's where someone running COKEY actually is.

---

## 📐 The invariant

Routing priority, without exception:

```
node -> key -> next key -> next node
```

A lower-priority node is never attempted while a higher-priority node still has an eligible, unattempted key. Everything else rotates to the next key on the same node first: `429`, quota exhaustion, invalid keys, provider `5xx`, network errors.

---

## 🔀 How a request is routed

1. The client asks for a chain alias (`model: "cokey-best"`).
2. Each node is tried in your order.
3. Inside a node, keys are ordered by strategy: **sequential** (the order you bound them) or **round-robin** (rotated per request, favoring the least-contended key).
4. On a credential-scoped failure the key cools down, honoring `Retry-After` when present, and the next key is tried.
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

Headers never contain a secret.

---

## 📡 The live route

`GET /api/events` streams server-sent events. The first frame is a snapshot, so a UI that connects mid-request still renders correctly.

```
data: {"kind":"snapshot","route":{...},"recent":[...]}

data: {"kind":"event","event":{"type":"route.attempt", ...}}
data: {"kind":"event","event":{"type":"chain.state","message":"chain changed state: cokey-best now on ..."}}
data: {"kind":"event","event":{"type":"credential.cooldown","data":{"cooldownUntil":...}}}
```

`GET /api/status` returns the same snapshot plus recent events for polling clients. Every event is local-only, there is no telemetry anywhere in COKEY.

---

## 🕵️ Automatic egress pool

Provider limits are usually tracked per key and per IP, so rotating keys from one address still trips them. The pool fixes that without manual wiring:

- every key of a provider gets a different pool entry, so two keys of one provider never share an exit IP
- two keys of different providers may share an entry, since nothing correlates them upstream
- the mapping is derived from the provider id and pool order, so it's stable across restarts
- it stays off until you opt in, Settings → Automatic egress pool, so a fresh install never routes traffic through proxies you didn't add

```bash
COKEY_PROXY_POOL="socks5://user:pass@host:1080,http://host:3128" cokey
```

Or bind a single key by hand, which pins it and takes it out of the pool:

```bash
curl -X PATCH http://localhost:8787/api/credentials/<id> \
  -H 'content-type: application/json' \
  -d '{"proxyUrl":"socks5://user:pass@host:1080"}'
```

`socks5://`, `socks://`, `socks5h://` and `http(s)://` are all supported. Proxy credentials are stored with the key and never returned by the API; responses expose `host:port` only. Set `proxyUrl` to `null` to return a key to direct egress.

---

## 🔌 Management API

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

## ⌨️ CLI

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
cokey keys create <name>     # a management API key clients authenticate with
cokey keys test <id>         # re-verify one credential
cokey requests               # local request history
cokey stats                  # aggregate usage
cokey config                 # open the web UI
cokey endpoints              # list custom OpenAI-compatible endpoints
cokey export [file]          # portable config (never secrets)
cokey import <file>          # import config
cokey credentials <file>     # create credentials declared in a file
cokey catalog                # dump the provider catalog
```

---

## 🧑‍💻 Programmatic API

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

## 🔒 Security

- Secrets are encrypted with **AES-256-GCM**. The on-disk value is `v1:` + `base64(iv, authTag, ciphertext)`.
- The master key comes from `COKEY_MASTER_KEY`, a passphrase (`COKEY_PASSPHRASE`), the OS keychain, or a `0600` key file, in that order.
- The log redactor drops sensitive field names and rewrites token-shaped values, so an `Authorization` header can't reach a log line.
- A credential is never serialised raw. HTTP responses use a masked projection.
- Custom endpoints pass an SSRF guard. Private ranges are refused unless explicitly allowed in settings.
- Redirects are never followed, so an upstream can't bounce an `Authorization` header to another origin.
- No telemetry, no phone-home, no analytics, on your laptop, in a container, or on a host you don't control.

---

## 📚 Provider dossiers and rankings

Who runs a provider, and which models are worth your time, is reference data compiled into `src/catalog/` (`dossiers.ts`, `models.ts`, `rankings.ts`). Correcting it is a normal pull request against COKEY itself.

The ranking boards are the exception: free tier availability drifts faster than a release cycle, so **Rankings → check for updates** fetches one published JSON bundle from [`colombefioren/COKEY--BUNDLE`](https://github.com/colombefioren/COKEY--BUNDLE) and replaces the boards with it. It's never fetched automatically, never on a timer, never on startup. Edit `content/rankings.json` in that repo, commit, and the button picks it up for everyone. Point `COKEY_RANKINGS_URL` at your own copy to publish from somewhere else.

---

## ✅ Testing

```bash
npm test          # vitest
npm run typecheck # server, tests and web UI
```

The suite covers the routing invariant (key rotation before node fallback, cross-node fallback order, request-scoped early exit, user reordering, cooldown skipping), live event emission, proxy parsing and wiring, per-credential rate tracking, model-availability gating, and the ranking-bundle fetch's tolerance of a bad response.

---

## 🏗️ Architecture

```
src/
├── catalog/          curated provider + free-model data, dossiers and rankings
├── cli/               command-line interface and the ASCII logo
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
│   ├── remote-rankings.ts  the one on-demand fetch: a published ranking bundle
│   ├── router/       the fallback engine
│   └── security/     SSRF guard
├── server/           Fastify: OpenAI surface, management API, SSE
└── web/              React + Vite UI
```

Adding a provider is a data change: append to the catalog. No router, adapter or UI code needs to change for another OpenAI-compatible service.

---

## 🙏 Credits

The provider and free-tier catalog is built in part from [awesome-free-byok-models](https://github.com/velo4705/awesome-free-byok-models) by [velo4705](https://github.com/velo4705).

The automatic egress pool's free-proxy import pulls from [proxifly/free-proxy-list](https://github.com/proxifly/free-proxy-list), a community-maintained list, refreshed continuously, no key and no quota.

Rate limits and capabilities change constantly, so every ranking board in the app names its source and leaves the judgement to you.

---

## 🤝 Contributing

COKEY is MIT licensed and open source.

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

---

<div align="center">

## 🧰 Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js%2020%2B-339933?style=flat-square&logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![React](https://img.shields.io/badge/React%2018-61DAFB?style=flat-square&logo=react&logoColor=150F3D)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

</div>

---

<div align="center">

## 📄 License

MIT. See [LICENSE](LICENSE).

<img src="./docs/assets/cokey-mark.svg" alt="COKEY" width="72" />

<sub>a tool for broke lads made by a broke princess</sub>

</div>
