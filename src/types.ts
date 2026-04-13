export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

export interface ToolCallResult {
  tool: string;
  success: boolean;
  content?: Array<{ type: string; text?: string }>;
  error?: string;
  durationMs: number;
}

export interface ResourceInfo {
  uri: string;
  name?: string;
  description?: string;
}

export interface ResourceReadResult {
  uri: string;
  success: boolean;
  contentType?: string;
  contentLength?: number;
  error?: string;
  durationMs: number;
}

export interface PromptInfo {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface PromptGetResult {
  name: string;
  success: boolean;
  messageCount?: number;
  error?: string;
  durationMs: number;
}

export interface SchemaIssue {
  tool: string;
  issue: string;
  severity: "error" | "warning";
}

export interface InspectResult {
  serverName?: string;
  tools: ToolInfo[];
  resources: ResourceInfo[];
  prompts: PromptInfo[];
  toolResults: ToolCallResult[];
  resourceResults: ResourceReadResult[];
  promptResults: PromptGetResult[];
  schemaIssues: SchemaIssue[];
  score: {
    toolsCallable: number;
    toolsTotal: number;
    resourcesReadable: number;
    resourcesTotal: number;
    promptsGettable: number;
    promptsTotal: number;
    schemaWarnings: number;
    schemaErrors: number;
  };
  durationMs: number;
}

export interface InspectOptions {
  json: boolean;
  timeout: number;
}

export type TransportKind = "stdio" | "sse" | "http";

export interface StdioTargetSpec {
  kind: "stdio";
  command: string;
  args: string[];
}

export interface HttpTargetSpec {
  kind: "sse" | "http";
  url: URL;
  headers: Record<string, string>;
}

export type TargetSpec = StdioTargetSpec | HttpTargetSpec;
