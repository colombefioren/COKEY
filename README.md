<div align="center">

<img src="./docs/assets/cokey-logo.svg" alt="COKEY" width="440" />

<br />
<br />

**An LLM credential pool and chain-fallback gateway.**

Point any OpenAI-compatible tool at `http://localhost:8787/v1` and let COKEY rotate your free API
keys, across accounts, across models, across providers, without ever leaking a key or inventing a
quota.

[![License: MIT](https://img.shields.io/badge/License-MIT-F482B4?style=flat-square&labelColor=2B1A2F)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D%2020.10-DD5C95?style=flat-square&labelColor=2B1A2F)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-F482B4?style=flat-square&labelColor=2B1A2F)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-passing-DD5C95?style=flat-square&labelColor=2B1A2F)](tests)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-F482B4?style=flat-square&labelColor=2B1A2F)](https://github.com/colombefioren/COKEY/pulls)
[![No telemetry](https://img.shields.io/badge/telemetry-none-DD5C95?style=flat-square&labelColor=2B1A2F)](#-security)
[![Price](https://img.shields.io/badge/price-%240.00-F482B4?style=flat-square&labelColor=2B1A2F)](#-every-free-lab-through-one-endpoint)

<sub><b>a tool for broke lads made by a broke princess</b></sub>

<br />

> **If it's not free, it's not in COKEY.** Every provider in the catalog advertises a real,
> self-replenishing free tier — no trial credit that quietly runs out, no "free" that needs a card
> on file.

</div>

---

<div align="center">

## 📺 A word from our sponsor (there isn't one)

</div>

> **TIRED of watching your one good free-tier key expire mid-refactor at 2 AM?** STOP paying $0.00
> a month and getting $0.00 of reliability for it! Introducing **COKEY** — the gateway that pools
> the free keys you already collected and rotates them *for* you, so you don't have to keep eleven
> provider dashboards open like some kind of unpaid intern.
>
> ✅ No subscription — there is nothing to subscribe to.
> ✅ No credit card — we would have nowhere to put it.
> ✅ No "Contact Sales" button — there is no sales.
>
> *Terms and conditions: there are no terms, and there are no conditions. Offer valid for as long as
> free tiers exist, which — per the catalog below — is a surprisingly aggressive number of
> providers. COKEY is not responsible for you finally shipping that side project.*

---

<div align="center">

## 🧭 What it actually does

</div>

<img src="./docs/assets/chain-flow.svg" alt="A request entering COKEY, spending every key of node one, then falling back to node two" width="980" />

COKEY runs wherever you put it — your laptop, a container, a hosting platform — keeps your keys
encrypted at rest, and exposes one OpenAI-compatible endpoint. When a provider rate-limits a key,
COKEY cools that key down and retries the next one **inside the same node** - only falling through
to the next node once every key of the current one is spent.

<table>
  <tr>
    <td align="center" width="33%">
      <b>🔁 Key-first rotation</b><br />
      <sub>429, invalid key and provider 5xx rotate the key, not the chain</sub>
    </td>
    <td align="center" width="33%">
      <b>🧱 Node fallback</b><br />
      <sub>a node that cannot serve is skipped, in the order you chose</sub>
    </td>
    <td align="center" width="33%">
      <b>🌐 One endpoint</b><br />
      <sub>every client keeps working when a key rotates underneath it</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <b>🩺 Live route</b><br />
      <sub>the topbar chip's dot pulses while a request is in flight, and announces every switch</sub>
    </td>
    <td align="center" width="33%">
      <b>🛡️ Per-key egress</b><br />
      <sub>two keys of one provider never share an exit IP</sub>
    </td>
    <td align="center" width="33%">
      <b>📊 Honest quotas</b><br />
      <sub>no rate-limit header means <code>Quota: Unknown</code>, never a guess</sub>
    </td>
  </tr>
</table>

---

<div align="center">

## 🔌 Every client you already use

**One base URL. Whatever you point at COKEY keeps working when a key rotates underneath it.**

</div>

<table>
  <tr>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/opencode" width="28" height="28" alt="opencode" /><br />
      <b>opencode</b><br />
      <sub>the reference client</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/claude" width="28" height="28" alt="Claude Code" /><br />
      <b>Claude Code</b><br />
      <sub>Anthropic wire format</sub>
    </td>
    <td align="center" width="25%">
      <img src="./docs/assets/plate.svg" width="28" height="28" alt="Codex CLI" /><br />
      <b>Codex CLI</b><br />
      <sub>OpenAI-compatible base URL</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://cdn.jsdelivr.net/gh/gilbarbara/logos@main/logos/visual-studio-code.svg" width="28" height="28" alt="VS Code" /><br />
      <b>VS Code</b><br />
      <sub>Cline, Roo, Copilot Chat</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/cursor" width="28" height="28" alt="Cursor" /><br />
      <b>Cursor</b><br />
      <sub>custom OpenAI provider</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/jetbrains" width="28" height="28" alt="JetBrains" /><br />
      <b>JetBrains IDEs</b><br />
      <sub>AI Assistant endpoint</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/cline" width="28" height="28" alt="Cline" /><br />
      <b>Cline and forks</b><br />
      <sub>OpenAI-compatible</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/gnometerminal" width="28" height="28" alt="Any CLI" /><br />
      <b>Any other CLI</b><br />
      <sub>base URL and a placeholder key like your_cokey_api_key</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/windsurf" width="28" height="28" alt="Windsurf" /><br />
      <b>Windsurf</b><br />
      <sub>Cascade with a custom endpoint</sub>
    </td>
    <td align="center" width="25%">
      <img src="https://cdn.simpleicons.org/zedindustries" width="28" height="28" alt="Zed" /><br />
      <b>Zed</b><br />
      <sub>OpenAI-compatible provider</sub>
    </td>
    <td align="center" width="25%">
      <img src="./docs/assets/plate.svg" width="28" height="28" alt="Continue" /><br />
      <b>Continue</b><br />
      <sub>VS Code and JetBrains extension</sub>
    </td>
    <td align="center" width="25%">
      <img src="./docs/assets/plate.svg" width="28" height="28" alt="Kilo Code" /><br />
      <b>Kilo Code</b><br />
      <sub>agent frameworks</sub>
    </td>
  </tr>
</table>

---

<div align="center">

## 🧠 Every free lab, through one endpoint

**57 providers, every one of them free. Connect a key once and chain it anywhere.**

</div>

<table>
  <tr>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/googlegemini" width="26" height="26" alt="Google Gemini" /><br />
      <sub><b>Google Gemini</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/mistralai" width="26" height="26" alt="Mistral AI" /><br />
      <sub><b>Mistral AI</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/nvidia" width="26" height="26" alt="NVIDIA NIM" /><br />
      <sub><b>NVIDIA NIM</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/cloudflare" width="26" height="26" alt="Cloudflare Workers AI" /><br />
      <sub><b>Cloudflare</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/huggingface" width="26" height="26" alt="Hugging Face" /><br />
      <sub><b>Hugging Face</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/openrouter" width="26" height="26" alt="OpenRouter" /><br />
      <sub><b>OpenRouter</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/ollama" width="26" height="26" alt="Ollama Cloud" /><br />
      <sub><b>Ollama Cloud</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/opencode" width="26" height="26" alt="OpenCode Zen" /><br />
      <sub><b>OpenCode Zen</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/amd" width="26" height="26" alt="AMD Radeon API" /><br />
      <sub><b>AMD Radeon</b></sub>
    </td>
    <td align="center" width="20%">
      <img src="https://cdn.simpleicons.org/alibabacloud" width="26" height="26" alt="ModelScope" /><br />
      <sub><b>ModelScope</b></sub>
    </td>
  </tr>
</table>

<sub>Brand marks come from [Simple Icons](https://simpleicons.org) and belong to their owners.</sub>

<details>
<summary><b>+ 47 more free hubs</b> — click to unfold the rest of the catalog</summary>

<br />

Most of these are small, independent free-tier resellers with no public brand mark to borrow, so
the COKEY plate stands in for all of them alike:

<table>
<tr>
<td width="20%">

<img src="./docs/assets/plate.svg" width="16" height="16" /> AION Labs<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Agnes AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> AI 121628 Free<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> AIHubMix<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> AnyAPI AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Auriko<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> BazaarLink<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Cerebras<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Cohere AI<br />

</td>
<td width="20%">

<img src="./docs/assets/plate.svg" width="16" height="16" /> ElectronHub<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> EvolveX<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> FastRouter<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> FH Router<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Free.ai<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> FreeInference<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Gonka Broker<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Groq API<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> HelixMind<br />

</td>
<td width="20%">

<img src="./docs/assets/plate.svg" width="16" height="16" /> Intern AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Kilo Gateway<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> LiteRouter<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> LLM.Kiwi<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> LLM7.IO<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> MegaNova AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Mixlayer<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Naga AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> NaraRouter<br />

</td>
<td width="20%">

<img src="./docs/assets/plate.svg" width="16" height="16" /> Odirouter<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Orcarouter<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Poixe AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Pollinations<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Pooled AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Poolside<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> QZZ API<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Requesty<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Routeway AI<br />

</td>
<td width="20%">

<img src="./docs/assets/plate.svg" width="16" height="16" /> SEA-LION<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> TokenHarbor<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> TokenReply<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> TokenRouter<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Void AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> WusRouter<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> xKiro AI<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Yolo-Auto<br />
<img src="./docs/assets/plate.svg" width="16" height="16" /> Z.AI (Zhipu AI)<br />

</td>
</tr>
</table>

...and Zydit AI, Zylo API rounding things out. The full catalog, with each provider's real free-tier
rate limit (RPD, RPM, TPD — whatever they actually publish) and dossier, is in the app under
**Providers**.

</details>

---

<div align="center">

## 🩺 Resilience - three self-healing layers

**The right layer for the right failure, so one dead key never costs a whole chain.**

</div>

<img src="./docs/assets/resilience-layers.svg" alt="Layer one: chain fallback. Layer two: key cooldown. Layer three: model gating" width="980" />

Every failure COKEY knows about is contained at exactly one scope, and a scope that was not affected
is never disturbed. A lower-priority node is **never** tried while a higher-priority node still has
an eligible, unattempted key for the current request.

| Layer | Scope | Handles | You see |
| :---- | :---- | :------ | :------ |
| **1** | whole chain | a node that cannot serve at all | the request walks on to the next node |
| **2** | one key | `429`, invalid key, provider `5xx` | that key cools down, its siblings keep serving |
| **3** | one model | a model whose key is not verified | the model is offered only when it can run |

Two exceptions exist, and both are deliberate:

| Error | Behaviour |
| :---- | :-------- |
| `context_too_large`, `invalid_request` | Request-shaped. Stop immediately, rotating would fail identically. |
| `model_unavailable` | Node-shaped. Skip the node's remaining keys, the other nodes may still work. |

---

<div align="center">

## ⚡ Why COKEY

**Stop juggling dashboards, dead API keys and surprise bills.**

</div>

<table>
  <tr>
    <th align="left" width="50%">❌ The daily pain</th>
    <th align="left" width="50%">✅ How COKEY fixes it</th>
  </tr>
  <tr>
    <td>❌ A free tier dies mid-session and the tool just errors</td>
    <td>✅ <b>Key-first failover</b> - the next key of the same node serves the request</td>
  </tr>
  <tr>
    <td>❌ Every provider wants its own config, in its own format</td>
    <td>✅ <b>One base URL</b> - the provider is always <code>COKEY</code>, the model is your alias</td>
  </tr>
  <tr>
    <td>❌ Rate limits are per key <i>and</i> per IP, so rotating does nothing</td>
    <td>✅ <b>Automatic egress pool</b> - keys of one provider leave from different IPs</td>
  </tr>
  <tr>
    <td>❌ A key that looks fine fails the moment it is used</td>
    <td>✅ <b>Verified keys only</b> - proven against the provider before it joins a chain</td>
  </tr>
  <tr>
    <td>❌ Quota numbers in most tools are made up</td>
    <td>✅ <b>Honest quotas</b> - unknown is reported as unknown</td>
  </tr>
  <tr>
    <td>❌ You cannot tell two keys of the same provider apart</td>
    <td>✅ <b>Per-key throughput</b> - measured requests per minute and a trailing-minute sparkline</td>
  </tr>
  <tr>
    <td>❌ Failover is invisible until something breaks</td>
    <td>✅ <b>The live route</b> - the node, key and exit IP in use right now, over SSE</td>
  </tr>
  <tr>
    <td>❌ Your keys sit in a plaintext file somewhere</td>
    <td>✅ <b>Encrypted at rest</b> - AES-256-GCM, master key in the OS keychain or an env var</td>
  </tr>
  <tr>
    <td>❌ You have to trust someone else's cloud with your prompts</td>
    <td>✅ <b>No telemetry</b> - your keys, your prompts, no phone-home, wherever you run it</td>
  </tr>
</table>

---

<div align="center">

## 🖥️ Where COKEY runs - anywhere

**Same app, your rules. From a laptop, to a container, to a platform that builds it for you.**

</div>

| Platform | Install | Highlights |
| :------- | :------ | :--------- |
| 📦 **npm (global)** | `npm install -g cokey` | one command, any OS |
| <img src="https://cdn.simpleicons.org/docker" width="16" height="16" valign="middle" /> **Docker** | `docker run -p 8787:8787 -v cokey:/data colombefioren/cokey` | multi-arch, data volume on `/data`, `0.0.0.0` baked in |
| <img src="https://cdn.simpleicons.org/render" width="16" height="16" valign="middle" /> **Render / Railway / Fly** | build `npm install && npm run build`, start `npm start` | reads the platform's own `PORT` automatically |
| 🧑‍💻 **From source** | `npm install && npm run build && npm start` | hack on it, contribute |
| 🍓 **ARM / Raspberry Pi** | `native arm64` | runs on ARM hosts, Apple Silicon and small boxes |
| 🖨️ **Any OpenAI-compatible client** | base URL only | editors, CLIs, agents, your own code |
| 🧩 **Programmatic API** | `import { Cokey } from "cokey"` | embed the gateway in a script or test |

Local, containerized or platform-hosted, the privacy story does not change: SQLite on disk, secrets
encrypted with AES-256-GCM, nothing phoned home. "Local by default" just means `COKEY_HOST` starts
at `127.0.0.1` until you tell it otherwise — the Dockerfile and the platform builds above already do.

---

<div align="center">

## 📖 Contents

</div>

<table>
  <tr>
    <td align="right"><b>Start</b></td>
    <td><a href="#-quick-start">Quick start</a></td>
    <td><a href="#-client-configuration">Client config</a></td>
    <td><a href="#-cli">CLI</a></td>
  </tr>
  <tr>
    <td align="right"><b>Concepts</b></td>
    <td><a href="#-the-invariant">The invariant</a></td>
    <td><a href="#-how-a-request-is-routed">Routing</a></td>
    <td><a href="#-the-live-route">Live route</a></td>
  </tr>
  <tr>
    <td align="right"><b>Features</b></td>
    <td><a href="#-features">Features</a></td>
    <td><a href="#-automatic-egress-pool">Egress pool</a></td>
    <td><a href="#-management-api">API</a></td>
  </tr>
  <tr>
    <td align="right"><b>Clients</b></td>
    <td><a href="#-every-client-you-already-use">Tools</a></td>
    <td><a href="#-every-free-lab-through-one-endpoint">Providers</a></td>
    <td><a href="#-resilience---three-self-healing-layers">Resilience</a></td>
  </tr>
  <tr>
    <td align="right"><b>Project</b></td>
    <td><a href="#-architecture">Architecture</a></td>
    <td><a href="#-credits">Credits</a></td>
    <td><a href="#-contributing">Contributing</a></td>
  </tr>
</table>

---

<div align="center">

## 🚀 Quick start

</div>

```bash
# from the repository
npm install
npm run build
npm start            # UI and gateway on http://127.0.0.1:8787

# or install globally
npm install -g cokey
cokey

# or a container
docker run -p 8787:8787 -v cokey:/data colombefioren/cokey
```

Running `cokey` prints the logo and starts everything. The mark is rasterised from the same
geometry as the SVG, so the loops come out round in a terminal instead of squashed:

```
                                  ####
                               #####
        ####             #########
    ############     ############ ####
  #####      ##### #####      #####         ##     ##  ######### ##      ##
 ####          #######          ####        ##   ####  ######### ###    ###
####            #####            ####       #######     ##        ########
###              ###              ###       ####       #######      ####
####            #####            ####       ####       #######       ##
 ####          #######          ####        #######     ##           ##
  #####      ##### #####      #####         ##   ####  #########     ##
    ############     ############           ##     ##  #########     ##
        ####             ####

  C O K E Y  v0.1.0
  a tool for broke lads made by a broke princess

  gateway:  http://127.0.0.1:8787/v1
  ui:       http://127.0.0.1:8787/
```

Then open <http://localhost:8787> and:

1. **Chains** → create a chain, for example `cokey-best`.
2. **Providers** → paste an API key, COKEY verifies it inline. Keys land in the chain's **Keys** tab.
3. Add nodes to the chain, pick the keys each node may use, drag them into your order.
4. Point your tool at `http://127.0.0.1:8787/v1` with any placeholder API key, for example
   `your_cokey_api_key`.

Then watch the dashboard's **Live route** and **Resilience** panels: the first shows where a request
went, the second shows which layer caught what.

<!---->

> **Contact, bug reports and provider tips** live inside the app under **Terms** (and **About**),
> because that is where someone running COKEY actually is. The README carries no contact block.

---

<div align="center">

## 🔌 Client configuration

</div>

Any OpenAI-compatible tool needs only a base URL. The provider is always `COKEY` and the model is
whatever you called your chain.

```jsonc
// OpenCode / Kilo Code style provider entry — apiKey is any placeholder value
{
  "provider": "cokey",
  "baseURL": "http://127.0.0.1:8787/v1",
  "apiKey": "your_cokey_api_key"
}
```

> Verify the exact key names against your tool's current documentation. COKEY only cares about the
> base URL and that the client sends an OpenAI-shaped request. The `your_cokey_api_key` value is a
> placeholder: COKEY ignores it unless you also created a gateway API key in the app.

Per-tool walkthroughs for Claude Code, Cursor, JetBrains, Cline, Continue, opencode, Hermes Agent,
OpenClaw, Codex CLI and other CLIs live in the app under **Tutorial**.

---

<div align="center">

## 🧱 The invariant

</div>

Routing priority is, without exception:

```
node -> key -> next key -> next node
```

A lower-priority node is **never** attempted while a higher-priority node still has an eligible,
unattempted key for the current request. Everything else rotates to the next key of the same node
first: `429`, quota exhaustion, invalid keys, provider `5xx`, network errors.

---

<div align="center">

## ✨ Features

</div>

- **Key-first failover** with a user-controlled node order (drag, keyboard, or buttons).
- **Verified keys only.** A key is proven against the provider, and against the exact model where
  the provider validates per model, before it may join a chain.
- **The live route.** A dashboard diagram draws the chain as it is walked, lighting up the node
  and the exact key serving the current request. The topbar chip narrates every key or model
  change the moment it happens, over SSE from `/api/events`.
- **Resilience you can see.** The dashboard names the three containment layers - chain fallback,
  key cooldown, model gating - and which failure trips which one.
- **Automatic egress pool.** Add proxies once and COKEY spreads them so two keys of the *same*
  provider never share an exit IP, while keys of different providers may share one. No manual
  wiring, stable across restarts, and off by default until you turn it on.
- **Per-key throughput.** Locally measured requests-per-minute and a trailing-minute sparkline per
  credential, so two keys of the same provider are never indistinguishable.
- **Model test button.** The play button in Models sends one real hello through a working key and
  only turns green on a `200`, with the reply and latency shown.
- **Rankings you can audit.** Coding skill, rate limits and a combined board, each row naming its
  source so a third-party blog post is never mistaken for provider documentation.
- **Honest quotas.** When a provider exposes no rate-limit headers, COKEY says `Quota: Unknown`. It
  never fabricates numbers.
- **57 free-tier providers**, curated free models only, each annotated with context window, best use
  and measured latency.
- **Your name for the model.** A node's display label is free text you type. COKEY never invents
  something like `DeepSeek V4 Pro (xKiro)`.
- **OpenAI-compatible API** including streaming, plus a full management API and CLI.
- **Encrypted at rest**, AES-256-GCM, with the master key in the OS keychain or an env var.

---

<div align="center">

## 🔀 How a request is routed

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

---

<div align="center">

## 📡 The live route

</div>

`GET /api/events` streams server-sent events. The first frame is a snapshot, so a UI that connects
mid-request still renders correctly - it's the same stream that makes the dashboard's topbar chip
light up the instant a key or node changes, no polling involved:

```
data: {"kind":"snapshot","route":{...},"recent":[...]}

data: {"kind":"event","event":{"type":"route.attempt", ...}}
data: {"kind":"event","event":{"type":"chain.state","message":"chain changed state: cokey-best now on ..."}}
data: {"kind":"event","event":{"type":"credential.cooldown","data":{"cooldownUntil":...}}}
```

`GET /api/status` returns the same snapshot plus recent events for polling clients. Every event is
local-only. There is no telemetry anywhere in COKEY.

---

<div align="center">

## 🌐 Automatic egress pool

</div>

Provider limits are usually tracked per **key and per IP**, so rotating keys from one address still
trips them. The pool fixes that without any manual wiring:

- every key of a provider gets a different pool entry, so two keys of one provider never share an
  exit IP;
- two keys of *different* providers may share an entry, because nothing correlates them upstream;
- the mapping is derived from the provider id and the pool order, so it is stable across restarts;
- it stays off until you opt in - **Settings → Automatic egress pool** - so a fresh install never
  routes traffic through proxies you did not add.

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

## 🧰 Management API

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

## ⌨️ CLI

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

## 🧩 Programmatic API

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

## 🔒 Security

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
- No telemetry, no phone-home, no analytics - on your laptop, in a container, or on a host you
  don't control. `COKEY_HOST` starts at `127.0.0.1` and only widens when you say so.

---

<div align="center">

## 📚 Provider dossiers and rankings

</div>

Who runs a provider, whether their free tier is infrastructure or a demo, and which models are
worth your time — that is all reference data compiled straight into `src/catalog/`
(`dossiers.ts`, `models.ts`, `rankings.ts`). Correcting it is a normal pull request against COKEY
itself, so a fresh clone is useful with zero setup and nothing to check out alongside it.

The ranking boards are the one exception: free-tier availability drifts faster than a release
cycle, so the Rankings screen has a **"check for updates"** button that fetches one published
JSON bundle and replaces the boards (and the dashboard's Insights fun facts) with it — nothing
else. It is never fetched automatically, never on a timer, never on startup; the compiled boards
keep serving until that button is clicked and succeeds. The published bundle lives at
[`colombefioren/COKEY--BUNDLE`](https://github.com/colombefioren/COKEY--BUNDLE) as a single
`content/rankings.json` file — edit it, commit, push, and the button picks it up for everyone.
See [Updating the rankings](#updating-the-rankings) below for its exact shape.

<a id="updating-the-rankings"></a>

### Updating the rankings

The published bundle is one JSON file:
[`content/rankings.json`](https://github.com/colombefioren/COKEY--BUNDLE/blob/main/content/rankings.json)
in the `COKEY--BUNDLE` repository. It has no build step and no schema tooling — edit the file
directly, in place, and commit it.

Its shape mirrors `RankingsView` in `src/catalog/rankings.ts` exactly:

```json
{
  "tiers": [{ "name": "S", "label": "…", "blurb": "…" }],
  "skill": [{ "model": "…", "providerId": "…", "tierName": "S", "sweScore": 62.4, "reason": "…" }],
  "rateLimit": [
    {
      "providerId": "…",
      "provider": "…",
      "tier": 1,
      "quota": "…",
      "provenance": "operator",
      "reliability": "solid"
    }
  ],
  "combined": [{ "rank": 1, "providerId": "…", "model": "…", "tier": 1, "why": "…" }],
  "redundancy": [{ "family": "…", "alsoOn": ["…"], "keep": "…", "fallback": "…" }],
  "dropList": [{ "provider": "…", "reason": "…" }],
  "bottomLine": "…",
  "disclaimer": "…",
  "sources": [{ "label": "…", "url": "https://…" }],
  "funFacts": ["…", "…"]
}
```

`funFacts` is optional — short strings shown one at a time in the dashboard's Insights corner.

To publish an update:

1. Edit `content/rankings.json` in the `COKEY--BUNDLE` repository.
2. Commit and push to `main`.
3. In COKEY, open **Models → Rankings** and click **check for updates**.

That fetch is validated the same way the compiled boards are typed — a malformed file is refused
with the specific reason, and the boards already being served keep serving. Point
`COKEY_RANKINGS_URL` at a different URL (a fork, a mirror, a local file server) to publish from
somewhere else instead.

---

<div align="center">

## 🧪 Testing

</div>

```bash
npm test          # vitest
npm run typecheck # server, tests and web UI
```

The suite covers the routing invariant (key rotation before node fallback, cross-node fallback
order, request-scoped early exit, user reordering, cooldown skipping), live event emission, proxy
parsing and wiring, per-credential rate tracking, model-availability gating, model discovery and
reconciliation, the guidance rules, and the ranking-bundle fetch's tolerance of a bad response.

---

<div align="center">

## 🏗️ Architecture

</div>

```
src/
├── catalog/          curated provider + free-model data, dossiers and rankings
├── cli/              command-line interface and the ASCII logo
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

Adding a provider is a data change: append to the catalog. No router, adapter or UI code needs to
change for another OpenAI-compatible service.

---

<div align="center">

## 📚 Credits

</div>

The provider and free-tier catalog is built in part from
**[awesome-free-byok-models](https://github.com/velo4705/awesome-free-byok-models)** by
[velo4705](https://github.com/velo4705). Thank you for collecting and keeping that list honest.

The automatic egress pool's free-proxy import pulls from
**[proxifly/free-proxy-list](https://github.com/proxifly/free-proxy-list)** - a community-maintained
list, refreshed continuously and pulled by COKEY straight off jsDelivr, no key and no quota.

Rate limits and capabilities change constantly, so every ranking board in the app names its source
and leaves the judgement to you.

---

<div align="center">

## 🤝 Contributing

</div>

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

---

<div align="center">

## 🧱 Stack

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
