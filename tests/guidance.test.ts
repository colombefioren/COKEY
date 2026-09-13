import { describe, expect, it } from "vitest";
import {
  deriveGuidance,
  guidanceSummary,
  type GuidanceInput,
  type GuidanceKind,
} from "../src/core/guidance.js";

const NOW = 1_700_000_000_000;

/** A healthy, fully configured gateway: the baseline every test deviates from. */
function input(overrides: Partial<GuidanceInput> = {}): GuidanceInput {
  return {
    now: NOW,
    chains: [
      {
        id: "chain-1",
        alias: "cokey-best",
        enabled: true,
        entries: [
          {
            id: "entry-1",
            providerId: "groq",
            providerName: "Groq",
            model: "model-a",
            enabled: true,
            credentialCount: 1,
            healthyCount: 1,
          },
        ],
      },
    ],
    credentials: [
      {
        id: "cred-1",
        providerId: "groq",
        providerName: "Groq",
        description: "Main",
        status: "healthy",
        consecutiveFailures: 0,
        lastVerifiedAt: NOW - 1_000,
        proxyAuto: false,
      },
    ],
    providers: [
      {
        id: "groq",
        displayName: "Groq",
        connected: true,
        credentialCount: 1,
        healthyCount: 1,
        inventoryCheckedAt: NOW - 60_000,
        staleModels: [],
        modelCount: 3,
      },
    ],
    egress: { enabled: false, poolSize: 0, saturatedProviders: [] },
    coverage: { connectedFree: 5, target: 3, suggestions: [] },
    // A content repository that is present, current and complete: the baseline
    // that the content rules below deviate from.
    content: { available: true, issues: [], staleDossiers: [], unsupported: [] },
    ...overrides,
  };
}

function kinds(notices: ReturnType<typeof deriveGuidance>): GuidanceKind[] {
  return notices.map((notice) => notice.kind);
}

describe("deriveGuidance", () => {
  it("says nothing when everything is healthy", () => {
    expect(deriveGuidance(input())).toEqual([]);
  });

  it("turns a rejected key into a critical notice that prefers re-verifying", () => {
    const notices = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "invalid",
            consecutiveFailures: 2,
            proxyAuto: false,
          },
        ],
      }),
    );

    const notice = notices.find((entry) => entry.kind === "credential.rejected")!;
    expect(notice.severity).toBe("critical");
    expect(notice.credentialId).toBe("cred-1");
    // Cheapest remedy first: one request beats a browser trip to the provider.
    expect(notice.actions[0]).toMatchObject({
      kind: "reverify-credential",
      credentialId: "cred-1",
    });
  });

  it("stays quiet about a short cooldown and speaks up about a long one", () => {
    const short = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "cooldown",
            cooldownUntil: NOW + 30_000,
            consecutiveFailures: 1,
            proxyAuto: false,
          },
        ],
      }),
    );
    expect(kinds(short)).not.toContain("credential.struggling");

    const long = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "cooldown",
            cooldownUntil: NOW + 20 * 60_000,
            consecutiveFailures: 1,
            proxyAuto: false,
          },
        ],
      }),
    );
    expect(kinds(long)).toContain("credential.struggling");
  });

  it("speaks up about a short cooldown once the failure streak is long enough", () => {
    const notices = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "cooldown",
            cooldownUntil: NOW + 5_000,
            consecutiveFailures: 4,
            proxyAuto: false,
          },
        ],
      }),
    );
    expect(kinds(notices)).toContain("credential.struggling");
  });

  it("flags a provider whose keys are all unusable, naming the worst one", () => {
    const notices = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "cooldown",
            cooldownUntil: NOW + 1_000,
            consecutiveFailures: 1,
            proxyAuto: false,
          },
          {
            id: "cred-2",
            providerId: "groq",
            providerName: "Groq",
            description: "Backup",
            status: "invalid",
            consecutiveFailures: 7,
            proxyAuto: false,
          },
        ],
        providers: [
          {
            id: "groq",
            displayName: "Groq",
            connected: true,
            credentialCount: 2,
            healthyCount: 0,
            inventoryCheckedAt: NOW - 60_000,
            staleModels: [],
            modelCount: 3,
          },
        ],
      }),
    );

    const notice = notices.find((entry) => entry.kind === "provider.all-keys-unusable")!;
    expect(notice).toBeDefined();
    // Highest failure streak first: that is the key least likely to recover.
    expect(notice.actions[0]).toMatchObject({ credentialId: "cred-2" });
  });

  it("reports retired models and the chain node that depends on one", () => {
    const notices = deriveGuidance(
      input({
        providers: [
          {
            id: "groq",
            displayName: "Groq",
            connected: true,
            credentialCount: 1,
            healthyCount: 1,
            inventoryCheckedAt: NOW - 60_000,
            staleModels: ["model-a"],
            modelCount: 2,
          },
        ],
      }),
    );

    expect(kinds(notices)).toContain("provider.models-stale");
    const chainNotice = notices.find((entry) => entry.kind === "chain.model-retired")!;
    expect(chainNotice.entryId).toBe("entry-1");
    // Re-checking is offered before editing the chain, because the provider may
    // simply have had a bad minute.
    expect(chainNotice.actions[0]).toMatchObject({ kind: "refresh-models" });
  });

  it("treats an unkeyed node as critical and a keyless-but-bound node as a warning", () => {
    const base = input().chains[0]!;
    const notices = deriveGuidance(
      input({
        chains: [
          {
            ...base,
            entries: [
              { ...base.entries[0]!, id: "entry-1", credentialCount: 0 },
              { ...base.entries[0]!, id: "entry-2", healthyCount: 0 },
            ],
          },
        ],
      }),
    );

    const unkeyed = notices.find((entry) => entry.entryId === "entry-1")!;
    expect(unkeyed.kind).toBe("chain.node-unkeyed");
    expect(unkeyed.severity).toBe("critical");

    const unhealthy = notices.find((entry) => entry.entryId === "entry-2")!;
    expect(unhealthy.kind).toBe("chain.node-unhealthy");
    expect(unhealthy.severity).toBe("warn");
  });

  it("notices a provider whose model list has never been checked", () => {
    const notices = deriveGuidance(
      input({
        providers: [
          {
            id: "groq",
            displayName: "Groq",
            connected: true,
            credentialCount: 1,
            healthyCount: 1,
            staleModels: [],
            modelCount: 3,
          },
        ],
      }),
    );
    expect(kinds(notices)).toContain("provider.models-never-checked");
  });

  it("notices a model list that has gone stale with age", () => {
    const notices = deriveGuidance(
      input({
        providers: [
          {
            id: "groq",
            displayName: "Groq",
            connected: true,
            credentialCount: 1,
            healthyCount: 1,
            inventoryCheckedAt: NOW - 30 * 24 * 60 * 60 * 1000,
            staleModels: [],
            modelCount: 3,
          },
        ],
      }),
    );
    expect(kinds(notices)).toContain("provider.models-outdated");
  });

  it("suggests creating a chain when there are none", () => {
    const notices = deriveGuidance(input({ chains: [] }));
    expect(kinds(notices)).toContain("chain.none");
  });

  it("mentions saturated egress and thin free-provider coverage", () => {
    const notices = deriveGuidance(
      input({
        egress: { enabled: true, poolSize: 2, saturatedProviders: ["Groq", "Mistral"] },
        coverage: {
          connectedFree: 1,
          target: 4,
          suggestions: [
            { id: "cerebras", displayName: "Cerebras" },
            { id: "cohere", displayName: "Cohere" },
          ],
        },
      }),
    );
    expect(kinds(notices)).toContain("egress.saturated");
    expect(kinds(notices)).toContain("coverage.free-providers");
  });

  it("speaks up about content files that could not be parsed", () => {
    const notices = deriveGuidance(
      input({
        content: {
          available: true,
          issues: [{ file: "providers/broken.json", message: "invalid JSON" }],
          staleDossiers: [],
          unsupported: [],
        },
      }),
    );

    const notice = notices.find((entry) => entry.kind === "content.files-broken")!;
    expect(notice.severity).toBe("warn");
    // The remedy is re-reading the directory, which is a button rather than a
    // trip to a terminal.
    expect(notice.actions[0]).toMatchObject({ kind: "reload-content" });
    expect(notice.detail).toContain("providers/broken.json");
  });

  it("stays quiet about content when every file parsed", () => {
    expect(kinds(deriveGuidance(input()))).not.toContain("content.files-broken");
  });

  it("names the dossiers whose review has gone stale", () => {
    const notices = deriveGuidance(
      input({
        content: { available: true, issues: [], staleDossiers: ["alpha", "beta"], unsupported: [] },
      }),
    );

    const notice = notices.find((entry) => entry.kind === "content.dossiers-outdated")!;
    expect(notice.severity).toBe("info");
    expect(notice.detail).toContain("alpha, beta");
  });

  it("names providers the content documents that this build cannot serve", () => {
    const notices = deriveGuidance(
      input({
        content: { available: true, issues: [], staleDossiers: [], unsupported: ["ghost"] },
      }),
    );

    const notice = notices.find((entry) => entry.kind === "content.unsupported")!;
    expect(notice.detail).toContain("ghost");
  });

  it("orders by severity and caps the list", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `cred-${index}`,
      providerId: "groq",
      providerName: "Groq",
      description: `Key ${index}`,
      status: "invalid" as const,
      consecutiveFailures: 1,
      proxyAuto: false,
    }));

    const notices = deriveGuidance(input({ credentials: many }), 5);
    expect(notices).toHaveLength(5);
    expect(notices.every((notice) => notice.severity === "critical")).toBe(true);
    // Every notice carries at least one action: a notice without one is a complaint.
    expect(notices.every((notice) => notice.actions.length > 0)).toBe(true);
  });

  it("gives every notice a stable id so a dismissal can be remembered", () => {
    const first = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "invalid",
            consecutiveFailures: 1,
            proxyAuto: false,
          },
        ],
      }),
    );
    const second = deriveGuidance(
      input({
        now: NOW + 5_000,
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "invalid",
            consecutiveFailures: 2,
            proxyAuto: false,
          },
        ],
      }),
    );

    expect(second[0]!.id).toBe(first[0]!.id);
  });
});

describe("guidanceSummary", () => {
  it("counts notices by severity", () => {
    const notices = deriveGuidance(
      input({
        credentials: [
          {
            id: "cred-1",
            providerId: "groq",
            providerName: "Groq",
            description: "Main",
            status: "invalid",
            consecutiveFailures: 1,
            proxyAuto: false,
          },
        ],
        egress: { enabled: true, poolSize: 1, saturatedProviders: ["Groq"] },
      }),
    );

    const summary = guidanceSummary(notices);
    expect(summary.critical).toBe(1);
    expect(summary.info).toBe(1);
    expect(summary.critical + summary.warn + summary.info).toBe(notices.length);
  });
});
