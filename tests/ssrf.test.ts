import { describe, expect, it } from "vitest";
import { validateEndpointUrl } from "../src/core/security/ssrf.js";

describe("validateEndpointUrl", () => {
  it("accepts an ordinary public https endpoint", () => {
    expect(validateEndpointUrl("https://api.example.com/v1")).toEqual({ ok: true });
  });

  it("rejects non-http(s) schemes", () => {
    expect(validateEndpointUrl("ftp://example.com").ok).toBe(false);
  });

  it("rejects embedded credentials", () => {
    expect(validateEndpointUrl("https://user:pass@example.com").ok).toBe(false);
  });

  it("blocks cloud metadata hostnames unconditionally", () => {
    expect(validateEndpointUrl("http://metadata.google.internal/").ok).toBe(false);
    expect(validateEndpointUrl("http://metadata.google.internal/", { allowPrivate: true }).ok).toBe(
      false,
    );
  });

  it("blocks loopback and internal hostnames unless allowed", () => {
    expect(validateEndpointUrl("http://localhost/").ok).toBe(false);
    expect(validateEndpointUrl("http://localhost/", { allowPrivate: true }).ok).toBe(true);
    expect(validateEndpointUrl("http://svc.internal/", { allowPrivate: true }).ok).toBe(true);
  });

  it("blocks IPv4 link-local metadata addresses even with allowPrivate", () => {
    expect(validateEndpointUrl("http://169.254.169.254/", { allowPrivate: true }).ok).toBe(false);
  });

  it("blocks private IPv4 ranges unless allowed", () => {
    expect(validateEndpointUrl("http://192.168.1.1/").ok).toBe(false);
    expect(validateEndpointUrl("http://192.168.1.1/", { allowPrivate: true }).ok).toBe(true);
    expect(validateEndpointUrl("http://10.0.0.1/", { allowPrivate: true }).ok).toBe(true);
  });

  it("blocks IPv6 loopback and unique-local/link-local ranges unless allowed", () => {
    expect(validateEndpointUrl("http://[::1]/").ok).toBe(false);
    expect(validateEndpointUrl("http://[::1]/", { allowPrivate: true }).ok).toBe(true);
    expect(validateEndpointUrl("http://[fd00::1]/", { allowPrivate: true }).ok).toBe(true);
    expect(validateEndpointUrl("http://[fe80::1]/", { allowPrivate: true }).ok).toBe(true);
  });

  it("blocks an IPv4-mapped IPv6 address written in dotted-decimal form", () => {
    expect(validateEndpointUrl("http://[::ffff:192.168.1.1]/").ok).toBe(false);
    expect(validateEndpointUrl("http://[::ffff:192.168.1.1]/", { allowPrivate: true }).ok).toBe(
      true,
    );
  });

  it("blocks an IPv4-mapped IPv6 address written in hex-group form", () => {
    expect(validateEndpointUrl("http://[::ffff:a9fe:a9fe]/", { allowPrivate: true }).ok).toBe(
      false,
    );
    expect(validateEndpointUrl("http://[::ffff:c0a8:101]/").ok).toBe(false);
    expect(validateEndpointUrl("http://[::ffff:c0a8:101]/", { allowPrivate: true }).ok).toBe(true);
  });

  it("requires https for a remote endpoint unless private endpoints are allowed", () => {
    expect(validateEndpointUrl("http://api.example.com/v1").ok).toBe(false);
    expect(validateEndpointUrl("https://api.example.com/v1").ok).toBe(true);
  });
});
