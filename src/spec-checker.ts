import type { ComplianceIssue, ToolInfo, ResourceInfo, PromptInfo } from "./types.js";

export interface ComplianceContext {
  capabilities: Record<string, unknown> | undefined;
  tools: ToolInfo[];
  resources: ResourceInfo[];
  prompts: PromptInfo[];
}

export function checkCompliance(ctx: ComplianceContext): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  checkCapabilitiesMatch(ctx, issues);
  checkToolSchemas(ctx, issues);
  checkResourceUris(ctx, issues);
  checkPromptArguments(ctx, issues);
  return issues;
}

function checkCapabilitiesMatch(ctx: ComplianceContext, issues: ComplianceIssue[]): void {
  const caps = ctx.capabilities ?? {};

  if ("tools" in caps && ctx.tools.length === 0) {
    issues.push({ check: "capabilities-match", message: "Server advertises tools capability but returned no tools", severity: "warning" });
  }
  if (!("tools" in caps) && ctx.tools.length > 0) {
    issues.push({ check: "capabilities-match", message: "Server returned tools but did not advertise tools capability", severity: "error" });
  }
  if ("resources" in caps && ctx.resources.length === 0) {
    issues.push({ check: "capabilities-match", message: "Server advertises resources capability but returned no resources", severity: "warning" });
  }
  if (!("resources" in caps) && ctx.resources.length > 0) {
    issues.push({ check: "capabilities-match", message: "Server returned resources but did not advertise resources capability", severity: "error" });
  }
  if ("prompts" in caps && ctx.prompts.length === 0) {
    issues.push({ check: "capabilities-match", message: "Server advertises prompts capability but returned no prompts", severity: "warning" });
  }
  if (!("prompts" in caps) && ctx.prompts.length > 0) {
    issues.push({ check: "capabilities-match", message: "Server returned prompts but did not advertise prompts capability", severity: "error" });
  }
}

function checkToolSchemas(ctx: ComplianceContext, issues: ComplianceIssue[]): void {
  for (const tool of ctx.tools) {
    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      issues.push({ check: "tool-schema", message: `Tool "${tool.name}": missing or invalid inputSchema`, severity: "error" });
      continue;
    }
    if (tool.inputSchema.type !== "object") {
      issues.push({ check: "tool-schema", message: `Tool "${tool.name}": inputSchema.type must be "object" per MCP spec, got "${tool.inputSchema.type}"`, severity: "error" });
    }
    if (!tool.name || tool.name.trim() === "") {
      issues.push({ check: "tool-schema", message: "Tool has empty name", severity: "error" });
    }
    const props = Object.keys(tool.inputSchema.properties ?? {});
    for (const req of tool.inputSchema.required ?? []) {
      if (!props.includes(req)) {
        issues.push({ check: "tool-schema", message: `Tool "${tool.name}": required field "${req}" not in properties`, severity: "error" });
      }
    }
  }
}

function checkResourceUris(ctx: ComplianceContext, issues: ComplianceIssue[]): void {
  for (const resource of ctx.resources) {
    if (!resource.uri || resource.uri.trim() === "") {
      issues.push({ check: "resource-uri", message: "Resource has empty URI", severity: "error" });
      continue;
    }
    if (!resource.uri.includes(":")) {
      issues.push({ check: "resource-uri", message: `Resource "${resource.uri}": URI missing scheme (expected format like "file:///path" or "custom://resource")`, severity: "warning" });
    }
  }
}

function checkPromptArguments(ctx: ComplianceContext, issues: ComplianceIssue[]): void {
  for (const prompt of ctx.prompts) {
    if (!prompt.name || prompt.name.trim() === "") {
      issues.push({ check: "prompt-args", message: "Prompt has empty name", severity: "error" });
    }
    if (prompt.arguments) {
      const names = new Set<string>();
      for (const arg of prompt.arguments) {
        if (!arg.name || arg.name.trim() === "") {
          issues.push({ check: "prompt-args", message: `Prompt "${prompt.name}": argument has empty name`, severity: "error" });
        }
        if (names.has(arg.name)) {
          issues.push({ check: "prompt-args", message: `Prompt "${prompt.name}": duplicate argument name "${arg.name}"`, severity: "error" });
        }
        names.add(arg.name);
      }
    }
  }
}
