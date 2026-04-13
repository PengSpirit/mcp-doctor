import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import ora from "ora";
import type {
  InspectResult,
  InspectOptions,
  ToolInfo,
  ToolCallResult,
  ResourceInfo,
  ResourceReadResult,
  PromptInfo,
  PromptGetResult,
} from "./types.js";
import { validateToolSchemas } from "./schema-validator.js";
import { generateSampleArgs } from "./sample-args.js";
import { printResult } from "./printer.js";
import { checkCompliance } from "./spec-checker.js";

export async function inspectServer(
  transport: Transport,
  options: InspectOptions
): Promise<InspectResult> {
  const startTime = Date.now();

  const spinner = ora("Connecting to MCP server...").start();

  const client = new Client({
    name: "mcp-doctor",
    version: "0.2.0",
  });

  // Collect stderr for stdio transports only — remote transports don't have it.
  const stderrChunks: string[] = [];
  if (transport instanceof StdioClientTransport) {
    const stderrStream = transport.stderr;
    if (stderrStream && "on" in stderrStream) {
      (stderrStream as NodeJS.ReadableStream).on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk.toString());
      });
    }
  }

  try {
    // Connect with timeout
    await withTimeout(
      client.connect(transport),
      options.timeout,
      "Connection timed out"
    );
    spinner.succeed("Connected to MCP server");

    const capabilities = client.getServerCapabilities();
    const serverVersion = client.getServerVersion();

    const result: InspectResult = {
      serverName: serverVersion?.name,
      tools: [],
      resources: [],
      prompts: [],
      toolResults: [],
      resourceResults: [],
      promptResults: [],
      schemaIssues: [],
      complianceIssues: [],
      score: {
        toolsCallable: 0,
        toolsTotal: 0,
        resourcesReadable: 0,
        resourcesTotal: 0,
        promptsGettable: 0,
        promptsTotal: 0,
        schemaWarnings: 0,
        schemaErrors: 0,
        complianceErrors: 0,
        complianceWarnings: 0,
      },
      durationMs: 0,
    };

    // ── Phase 1: Discovery ──────────────────────────────────────

    if (capabilities?.tools) {
      const s = ora("Listing tools...").start();
      const resp = await withTimeout(
        client.listTools(),
        options.timeout,
        "listTools timed out"
      );
      result.tools = resp.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      }));
      s.succeed(`Found ${result.tools.length} tools`);
    }

    if (capabilities?.resources) {
      const s = ora("Listing resources...").start();
      const resp = await withTimeout(
        client.listResources(),
        options.timeout,
        "listResources timed out"
      );
      result.resources = resp.resources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
      }));
      s.succeed(`Found ${result.resources.length} resources`);
    }

    if (capabilities?.prompts) {
      const s = ora("Listing prompts...").start();
      const resp = await withTimeout(
        client.listPrompts(),
        options.timeout,
        "listPrompts timed out"
      );
      result.prompts = resp.prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      }));
      s.succeed(`Found ${result.prompts.length} prompts`);
    }

    // ── Phase 2: Schema validation ──────────────────────────────

    if (result.tools.length > 0) {
      const s = ora("Validating tool schemas...").start();
      result.schemaIssues = validateToolSchemas(result.tools);
      const errors = result.schemaIssues.filter((i) => i.severity === "error").length;
      const warnings = result.schemaIssues.filter((i) => i.severity === "warning").length;
      if (errors > 0 || warnings > 0) {
        s.warn(`Schema: ${errors} errors, ${warnings} warnings`);
      } else {
        s.succeed("All tool schemas valid");
      }
    }

    // ── Phase 2.5: Spec compliance ───────────��───────────────────
    {
      const s = ora("Checking MCP spec compliance...").start();
      result.complianceIssues = checkCompliance({
        capabilities: capabilities as Record<string, unknown> | undefined,
        tools: result.tools,
        resources: result.resources,
        prompts: result.prompts,
      });
      const errors = result.complianceIssues.filter((i) => i.severity === "error").length;
      const warnings = result.complianceIssues.filter((i) => i.severity === "warning").length;
      if (errors > 0 || warnings > 0) {
        s.warn(`Compliance: ${errors} errors, ${warnings} warnings`);
      } else {
        s.succeed("MCP spec compliance OK");
      }
    }

    // ── Phase 3: Call every tool ─────────────────��───────────────

    if (result.tools.length > 0) {
      const s = ora("Calling tools...").start();
      for (const tool of result.tools) {
        s.text = `Calling tool: ${tool.name}...`;
        const callResult = await callTool(client, tool, options.timeout);
        result.toolResults.push(callResult);
      }
      const passed = result.toolResults.filter((r) => r.success).length;
      if (passed === result.toolResults.length) {
        s.succeed(`All ${passed} tools callable`);
      } else {
        s.warn(`${passed}/${result.toolResults.length} tools callable`);
      }
    }

    // ── Phase 4: Read every resource ─────────────────────────────

    if (result.resources.length > 0) {
      const s = ora("Reading resources...").start();
      for (const resource of result.resources) {
        s.text = `Reading resource: ${resource.uri}...`;
        const readResult = await readResource(client, resource, options.timeout);
        result.resourceResults.push(readResult);
      }
      const passed = result.resourceResults.filter((r) => r.success).length;
      if (passed === result.resourceResults.length) {
        s.succeed(`All ${passed} resources readable`);
      } else {
        s.warn(`${passed}/${result.resourceResults.length} resources readable`);
      }
    }

    // ── Phase 5: Get every prompt ────────────────────────────────

    if (result.prompts.length > 0) {
      const s = ora("Getting prompts...").start();
      for (const prompt of result.prompts) {
        s.text = `Getting prompt: ${prompt.name}...`;
        const getResult = await getPrompt(client, prompt, options.timeout);
        result.promptResults.push(getResult);
      }
      const passed = result.promptResults.filter((r) => r.success).length;
      if (passed === result.promptResults.length) {
        s.succeed(`All ${passed} prompts gettable`);
      } else {
        s.warn(`${passed}/${result.promptResults.length} prompts gettable`);
      }
    }

    // ── Compute scores ───────────────────────────────────────────

    result.score = {
      toolsCallable: result.toolResults.filter((r) => r.success).length,
      toolsTotal: result.tools.length,
      resourcesReadable: result.resourceResults.filter((r) => r.success).length,
      resourcesTotal: result.resources.length,
      promptsGettable: result.promptResults.filter((r) => r.success).length,
      promptsTotal: result.prompts.length,
      schemaErrors: result.schemaIssues.filter((i) => i.severity === "error").length,
      schemaWarnings: result.schemaIssues.filter((i) => i.severity === "warning").length,
      complianceErrors: result.complianceIssues.filter((i) => i.severity === "error").length,
      complianceWarnings: result.complianceIssues.filter((i) => i.severity === "warning").length,
    };
    result.durationMs = Date.now() - startTime;

    // ── Output ───────────────────────────────────────────────────

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printResult(result);
    }

    await client.close();
    return result;
  } catch (error) {
    spinner.fail("Failed to inspect MCP server");
    if (stderrChunks.length > 0) {
      console.error("Server stderr:", stderrChunks.join(""));
    }
    await client.close().catch(() => {});
    throw error;
  }
}

// ── Helpers ────────────────────────────────────────────────────

async function callTool(
  client: Client,
  tool: ToolInfo,
  timeout: number
): Promise<ToolCallResult> {
  const start = Date.now();
  try {
    const sampleArgs = generateSampleArgs(tool.inputSchema);
    const response = await withTimeout(
      client.callTool({ name: tool.name, arguments: sampleArgs }),
      timeout,
      `Tool "${tool.name}" timed out`
    );
    const isError = response.isError === true;
    return {
      tool: tool.name,
      success: !isError,
      content: response.content as Array<{ type: string; text?: string }>,
      error: isError ? extractErrorText(response.content) : undefined,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      tool: tool.name,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

async function readResource(
  client: Client,
  resource: ResourceInfo,
  timeout: number
): Promise<ResourceReadResult> {
  const start = Date.now();
  try {
    const response = await withTimeout(
      client.readResource({ uri: resource.uri }),
      timeout,
      `Resource "${resource.uri}" timed out`
    );
    const firstContent = response.contents[0];
    const text = firstContent && "text" in firstContent ? firstContent.text : undefined;
    return {
      uri: resource.uri,
      success: true,
      contentType: firstContent?.mimeType,
      contentLength: text ? text.length : undefined,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      uri: resource.uri,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

async function getPrompt(
  client: Client,
  prompt: PromptInfo,
  timeout: number
): Promise<PromptGetResult> {
  const start = Date.now();
  try {
    // Build required arguments with sample values
    const promptArgs: Record<string, string> = {};
    if (prompt.arguments) {
      for (const arg of prompt.arguments) {
        if (arg.required) {
          promptArgs[arg.name] = "test";
        }
      }
    }

    const response = await withTimeout(
      client.getPrompt({ name: prompt.name, arguments: promptArgs }),
      timeout,
      `Prompt "${prompt.name}" timed out`
    );
    return {
      name: prompt.name,
      success: true,
      messageCount: response.messages.length,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: prompt.name,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

function extractErrorText(content: unknown): string {
  if (!Array.isArray(content)) return "Unknown error";
  for (const item of content) {
    if (typeof item === "object" && item !== null && "type" in item && item.type === "text" && "text" in item) {
      return String(item.text);
    }
  }
  return "Unknown error";
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
