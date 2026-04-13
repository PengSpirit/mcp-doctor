import { describe, it, expect } from "vitest";
import { parseTarget } from "./transport.js";

describe("parseTarget", () => {
  it("treats http:// targets as streamable HTTP by default", () => {
    const spec = parseTarget("http://localhost:3000/mcp", {});
    expect(spec.kind).toBe("http");
    if (spec.kind === "http" || spec.kind === "sse") {
      expect(spec.url.href).toBe("http://localhost:3000/mcp");
      expect(spec.headers).toEqual({});
    }
  });

  it("treats https:// targets as streamable HTTP by default", () => {
    const spec = parseTarget("https://api.example.com/mcp", {});
    expect(spec.kind).toBe("http");
  });

  it("honors --transport sse override for URL targets", () => {
    const spec = parseTarget("https://api.example.com/mcp", { transport: "sse" });
    expect(spec.kind).toBe("sse");
  });

  it("parses command strings as stdio targets", () => {
    const spec = parseTarget("npx -y @modelcontextprotocol/server-everything", {});
    expect(spec.kind).toBe("stdio");
    if (spec.kind === "stdio") {
      expect(spec.command).toBe("npx");
      expect(spec.args).toEqual(["-y", "@modelcontextprotocol/server-everything"]);
    }
  });

  it("parses headers array into record", () => {
    const spec = parseTarget("https://x/mcp", {
      headers: ["Authorization: Bearer abc", "X-Trace: 1"],
    });
    if (spec.kind === "http") {
      expect(spec.headers).toEqual({
        Authorization: "Bearer abc",
        "X-Trace": "1",
      });
    }
  });

  it("throws if --transport stdio is given with a URL", () => {
    expect(() => parseTarget("https://x/mcp", { transport: "stdio" })).toThrow(
      /stdio.*URL/i
    );
  });

  it("throws if --transport http is given with a command", () => {
    expect(() => parseTarget("npx server", { transport: "http" })).toThrow(
      /http.*URL/i
    );
  });
});
