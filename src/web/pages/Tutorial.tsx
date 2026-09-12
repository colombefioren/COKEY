import { useState } from "react";
import { Panel } from "../components/Primitives.js";

interface Recipe {
  id: string;
  name: string;
  kind: "Editor" | "Editor extension" | "CLI" | "Agent framework";
  blurb: string;
  /** Steps in order. `code` is a snippet, `text` a sentence. */
  steps: Array<{ text: string; code?: string; lang?: string }>;
  notes?: string;
}

const BASE_URL = "http://127.0.0.1:8787/v1";

/**
 * Setup guides, one per client.
 *
 * Every recipe ends at the same place: point the client at the gateway's base
 * URL and give it any placeholder key. COKEY holds the real keys, so nothing
 * else in the client's configuration has to change when a credential rotates.
 */
const RECIPES: Recipe[] = [
  {
    id: "opencode",
    name: "opencode",
    kind: "CLI",
    blurb:
      "The reference client for this setup. Use the chain alias as the model, keep the provider named COKEY, and watch for the chain state notification when a node moves.",
    steps: [
      {
        text: "Add COKEY as an OpenAI-compatible provider in your opencode config:",
        lang: "json",
        code: `{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "cokey": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "COKEY",
      "options": { "baseURL": "${BASE_URL}" },
      "models": {
        "cokey-best": { "name": "My best chain" }
      }
    }
  },
  "model": "cokey/cokey-best"
}`,
      },
      {
        text: "Authenticate with any placeholder. COKEY ignores it unless you also created a gateway API key:",
        lang: "bash",
        code: "opencode auth login   # choose COKEY, paste any value such as 'unused'",
      },
      {
        text: "Ask once, then watch the state line. Every switch prints a notification rather than an error:",
        lang: "text",
        code: "chain changed state: cokey-best on groq/qwen3.8-27b via Main account (rate_limit)",
      },
    ],
    notes:
      "The provider name is COKEY on purpose. Set it that way and the model picker never mentions an upstream vendor, even when the answer came from one.",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "CLI",
    blurb:
      "Claude Code speaks the Anthropic wire format. Point its base URL at COKEY and it will use whichever chain you aliased, including failover.",
    steps: [
      {
        text: "Export the base URL and a placeholder key for the session:",
        lang: "bash",
        code: `export ANTHROPIC_BASE_URL="http://127.0.0.1:8787"
export ANTHROPIC_API_KEY="unused-but-required"`,
      },
      {
        text: "Start it as usual and select the chain alias when asked for a model:",
        lang: "bash",
        code: "claude --model cokey-best",
      },
    ],
    notes:
      "If your version also sends a beta header the gateway does not recognise, COKEY forwards unknown headers upstream untouched, so nothing breaks.",
  },
  {
    id: "codex",
    name: "Codex CLI",
    kind: "CLI",
    blurb: "Codex reads an OpenAI-compatible provider block from its config.",
    steps: [
      {
        text: "Add a provider entry in ~/.codex/config.toml:",
        lang: "toml",
        code: `model = "cokey-best"
model_provider = "cokey"

[model_providers.cokey]
name = "COKEY"
base_url = "${BASE_URL}"
env_key = "COKEY_API_KEY"`,
      },
      {
        text: "Set the placeholder key the config refers to:",
        lang: "bash",
        code: 'export COKEY_API_KEY="unused-but-required"',
      },
    ],
  },
  {
    id: "vscode",
    name: "VS Code",
    kind: "Editor",
    blurb:
      "VS Code itself has no model setting, so the base URL goes in whichever AI extension you run. The two blocks below cover Copilot Chat's BYOK path and the generic OpenAI-compatible setting most extensions expose.",
    steps: [
      {
        text: "Open Settings and search for the extension's API base URL field, or set it in settings.json:",
        lang: "json",
        code: `{
  "github.copilot.chat.byok.baseUrl": "${BASE_URL}",
  "github.copilot.chat.byok.apiKey": "unused-but-required",
  "github.copilot.chat.byok.model": "cokey-best"
}`,
      },
      {
        text: "Reload the window. The model picker gains a COKEY entry using your chain alias.",
      },
    ],
    notes:
      "Extension setting names change between releases. The value is always the same three things: base URL, placeholder key, chain alias.",
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: "Editor",
    blurb:
      "Cursor accepts an OpenAI-compatible base URL in its model settings and verifies it with a test call.",
    steps: [
      {
        text: "Settings, Models, then add an OpenAI-compatible model:",
        lang: "text",
        code: `Base URL:  ${BASE_URL}
API key:   unused-but-required
Model:     cokey-best`,
      },
      {
        text: "Press Verify. Cursor issues a small completion through COKEY, which is exactly what the play button in the Models tab does.",
      },
    ],
    notes:
      "Turn off any 'override OpenAI base URL' setting you may have enabled for another proxy, or the two will fight.",
  },
  {
    id: "jetbrains",
    name: "JetBrains IDEs",
    kind: "Editor",
    blurb:
      "JetBrains AI Assistant and the plugin ecosystem both take a custom OpenAI-compatible endpoint under Settings, Tools, AI Assistant, Models.",
    steps: [
      {
        text: "Add a custom model provider:",
        lang: "text",
        code: `Provider:  OpenAI compatible
URL:       ${BASE_URL}
API key:   unused-but-required
Model:     cokey-best`,
      },
      { text: "Apply, then run any inline AI action to confirm traffic reaches the gateway." },
    ],
  },
  {
    id: "cline",
    name: "Cline and forks",
    kind: "Editor extension",
    blurb:
      "Cline, Roo Code and the forks built on it all use the same settings shape: an OpenAI-compatible provider plus a base URL.",
    steps: [
      {
        text: "In the extension settings choose API Provider: OpenAI Compatible.",
        lang: "text",
        code: `Base URL:   ${BASE_URL}
API Key:    unused-but-required
Model ID:   cokey-best`,
      },
      {
        text: "Enable 'model supports images' only if your chain's model does. COKEY forwards the request either way.",
      },
    ],
    notes:
      "Agentic extensions send tools and structured output. Drop providers that fail structured output from your chain, or a tool call will break mid-task.",
  },
  {
    id: "continue",
    name: "Continue",
    kind: "Editor extension",
    blurb: "Continue takes a YAML model block with an OpenAI-compatible provider.",
    steps: [
      {
        text: "Add the model to ~/.continue/config.yaml:",
        lang: "yaml",
        code: `models:
  - name: COKEY best chain
    provider: openai
    model: cokey-best
    apiBase: ${BASE_URL}
    apiKey: unused-but-required`,
      },
      { text: "Reload Continue. The model appears in the chat and autocomplete pickers." },
    ],
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    kind: "Agent framework",
    blurb:
      "Hermes Agent reads an OpenAI-compatible endpoint from its environment, so the base URL is the whole configuration.",
    steps: [
      {
        text: "Export the endpoint and a placeholder key before launching:",
        lang: "bash",
        code: `export OPENAI_BASE_URL="${BASE_URL}"
export OPENAI_API_KEY="unused-but-required"
export HERMES_MODEL="cokey-best"`,
      },
      {
        text: "Long tool-calling loops benefit most from failover: raise maxRetriesPerCredential in Settings if a run keeps hitting one provider's limit.",
      },
    ],
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    kind: "Agent framework",
    blurb: "OpenClaw is configured with a provider map, same as opencode.",
    steps: [
      {
        text: "Register COKEY as an OpenAI-compatible provider:",
        lang: "json",
        code: `{
  "providers": {
    "cokey": {
      "type": "openai",
      "baseUrl": "${BASE_URL}",
      "apiKey": "unused-but-required",
      "model": "cokey-best"
    }
  }
}`,
      },
      { text: "Restart the agent and confirm the first request shows up in the Usage tab." },
    ],
  },
  {
    id: "other-cli",
    name: "Any other CLI tool",
    kind: "CLI",
    blurb:
      "Anything that can speak OpenAI-compatible chat completions works. These are the two environment variables almost every tool reads.",
    steps: [
      {
        text: "Set the generic variables:",
        lang: "bash",
        code: `export OPENAI_BASE_URL="${BASE_URL}"
export OPENAI_API_KEY="unused-but-required"`,
      },
      {
        text: "Verify the endpoint by hand with curl. A 200 here means the gateway, not the client, is the next thing to look at:",
        lang: "bash",
        code: `curl -s ${BASE_URL}/chat/completions \\
  -H 'content-type: application/json' \\
  -d '{"model":"cokey-best","messages":[{"role":"user","content":"hello"}]}'`,
      },
      {
        text: "List what COKEY currently serves, owned by COKEY rather than the upstream vendor:",
        lang: "bash",
        code: `curl -s http://127.0.0.1:8787/v1/models`,
      },
    ],
  },
];

const KIND_ORDER: Recipe["kind"][] = ["CLI", "Editor", "Editor extension", "Agent framework"];

export function Tutorial() {
  const [openId, setOpenId] = useState<string>("opencode");

  return (
    <>
      <Panel title="Getting started">
        <ol className="steps-list">
          <li>
            <strong>Connect two or three providers.</strong> Open the Providers tab and paste a key
            for each. COKEY verifies every key before storing it, so a typo is caught immediately.
          </li>
          <li>
            <strong>Create one chain.</strong> Chains, then <em>New chain</em>. Name it whatever you
            will type into your editor, for example <code>cokey-best</code>.
          </li>
          <li>
            <strong>Add nodes in the order you want them tried.</strong> Each node is a provider
            plus a model plus the keys bound to it. Every key of a node is exhausted before the next
            node runs.
          </li>
          <li>
            <strong>Press play in the Models tab.</strong> A green check means a real 200 came back
            through a real key, not that a database row says healthy.
          </li>
          <li>
            <strong>Point your client at the gateway.</strong> Use one of the recipes below. The
            base URL is always <code>{BASE_URL}</code>.
          </li>
        </ol>
      </Panel>

      <Panel title="Editor and CLI recipes">
        <div className="recipe-list">
          {KIND_ORDER.flatMap((kind) => RECIPES.filter((recipe) => recipe.kind === kind)).map(
            (recipe) => {
              const open = openId === recipe.id;
              return (
                <article key={recipe.id} className={`recipe${open ? " open" : ""}`}>
                  <button
                    type="button"
                    className="recipe-head"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? "" : recipe.id)}
                  >
                    <span className="recipe-name">{recipe.name}</span>
                    <span className="badge neutral">{recipe.kind}</span>
                    <span className="spacer" />
                    <span className="recipe-toggle">{open ? "\u2212" : "+"}</span>
                  </button>

                  {open ? (
                    <div className="recipe-body">
                      <p className="small muted">{recipe.blurb}</p>
                      <ol className="recipe-steps">
                        {recipe.steps.map((step, index) => (
                          <li key={index}>
                            <div className="small">{step.text}</div>
                            {step.code ? <CodeBlock code={step.code} lang={step.lang} /> : null}
                          </li>
                        ))}
                      </ol>
                      {recipe.notes ? <div className="hint-box">{recipe.notes}</div> : null}
                    </div>
                  ) : null}
                </article>
              );
            },
          )}
        </div>
      </Panel>

      <Panel title="Automatic egress proxies">
        <p className="small muted" style={{ marginTop: 0 }}>
          Provider limits are usually tracked per key <em>and</em> per IP, so rotating five keys
          from one address still trips the same limit. Fill the pool once and COKEY assigns the
          exits for you:
        </p>
        <ul className="bullet-list">
          <li>Every key of one provider gets a different exit IP.</li>
          <li>
            Keys of different providers may share an entry, because nothing correlates them
            upstream.
          </li>
          <li>
            The mapping is stable across restarts, so a key does not appear to move cities every
            boot.
          </li>
          <li>A proxy you set by hand is never overwritten by the pool.</li>
        </ul>
        <p className="small faint">
          Add entries under Settings, Egress pool, or supply a comma-separated list through{" "}
          <code>COKEY_PROXY_POOL</code> before first start.
        </p>
      </Panel>

      <div className="closing">
        <strong>COKEY</strong>
        <span>a tool for broke lads made by a broke princess</span>
      </div>
    </>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="faint small">{lang ?? "text"}</span>
        <span className="spacer" />
        <button
          type="button"
          className="ghost small"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
