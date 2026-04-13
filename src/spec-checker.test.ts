import { describe, it, expect } from "vitest";
import { checkCompliance, type ComplianceContext } from "./spec-checker.js";

function makeCtx(overrides: Partial<ComplianceContext> = {}): ComplianceContext {
  return {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    tools: [],
    resources: [],
    prompts: [],
    ...overrides,
  };
}

describe("checkCompliance", () => {
  it("returns no issues for a well-formed server", () => {
    const issues = checkCompliance(makeCtx({
      tools: [{ name: "echo", inputSchema: { type: "object", properties: { msg: { type: "string" } }, required: ["msg"] } }],
      resources: [{ uri: "file:///test.txt", name: "test" }],
      prompts: [{ name: "greet", arguments: [{ name: "name", required: true }] }],
    }));
    expect(issues).toEqual([]);
  });

  it("flags tools without advertised capability", () => {
    const issues = checkCompliance(makeCtx({
      capabilities: {},
      tools: [{ name: "echo", inputSchema: { type: "object" } }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      check: "capabilities-match",
      severity: "error",
    }));
  });

  it("warns when capability advertised but no items returned", () => {
    const issues = checkCompliance(makeCtx({
      capabilities: { tools: {} },
      tools: [],
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      check: "capabilities-match",
      severity: "warning",
    }));
  });

  it("flags resource URI without scheme", () => {
    const issues = checkCompliance(makeCtx({
      resources: [{ uri: "no-scheme-path" }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      check: "resource-uri",
      severity: "warning",
    }));
  });

  it("flags duplicate prompt argument names", () => {
    const issues = checkCompliance(makeCtx({
      prompts: [{ name: "test", arguments: [{ name: "x" }, { name: "x" }] }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      check: "prompt-args",
      message: expect.stringContaining("duplicate"),
    }));
  });

  it("flags tool with required field not in properties", () => {
    const issues = checkCompliance(makeCtx({
      tools: [{ name: "bad", inputSchema: { type: "object", properties: {}, required: ["missing"] } }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      check: "tool-schema",
      message: expect.stringContaining("missing"),
    }));
  });
});
