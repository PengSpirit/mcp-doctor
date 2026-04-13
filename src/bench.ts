import { Client } from "@modelcontextprotocol/sdk/client";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import ora from "ora";
import type { BenchResult, BenchToolResult, BenchOptions, ToolInfo } from "./types.js";
import { generateSampleArgs } from "./sample-args.js";
import { printBenchResult } from "./bench-printer.js";

export function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function benchServer(
  transport: Transport,
  options: BenchOptions
): Promise<BenchResult> {
  const startTime = Date.now();
  const spinner = ora("Connecting to MCP server...").start();

  const client = new Client({
    name: "mcp-doctor",
    version: "0.2.0",
  });

  try {
    await withTimeout(client.connect(transport), options.timeout, "Connection timed out");
    spinner.succeed("Connected to MCP server");

    const capabilities = client.getServerCapabilities();
    const serverVersion = client.getServerVersion();

    const tools: ToolInfo[] = [];
    if (capabilities?.tools) {
      const s = ora("Listing tools...").start();
      const resp = await withTimeout(client.listTools(), options.timeout, "listTools timed out");
      tools.push(
        ...resp.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        }))
      );
      s.succeed(`Found ${tools.length} tools`);
    }

    const toolResults: BenchToolResult[] = [];

    for (const tool of tools) {
      const s = ora(`Benchmarking ${tool.name} (${options.iterations} iterations)...`).start();
      const sampleArgs = generateSampleArgs(tool.inputSchema);
      const latencies: number[] = [];
      let errors = 0;

      for (let i = 0; i < options.iterations; i++) {
        const callStart = Date.now();
        try {
          await withTimeout(
            client.callTool({ name: tool.name, arguments: sampleArgs }),
            options.timeout,
            `Tool "${tool.name}" timed out`
          );
          latencies.push(Date.now() - callStart);
        } catch (_err) {
          errors++;
          latencies.push(Date.now() - callStart);
        }
      }

      latencies.sort((a, b) => a - b);
      const totalTime = latencies.reduce((sum, l) => sum + l, 0);

      toolResults.push({
        tool: tool.name,
        latencies,
        p50: computePercentile(latencies, 50),
        p95: computePercentile(latencies, 95),
        p99: computePercentile(latencies, 99),
        min: latencies[0] ?? 0,
        max: latencies[latencies.length - 1] ?? 0,
        throughput: totalTime > 0 ? (latencies.length / totalTime) * 1000 : 0,
        errors,
      });

      s.succeed(`${tool.name}: p50=${computePercentile(latencies, 50)}ms p95=${computePercentile(latencies, 95)}ms (${errors} errors)`);
    }

    const result: BenchResult = {
      serverName: serverVersion?.name,
      tools: toolResults,
      iterations: options.iterations,
      durationMs: Date.now() - startTime,
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printBenchResult(result);
    }

    await client.close();
    return result;
  } catch (error) {
    spinner.fail("Benchmark failed");
    await client.close().catch(() => {});
    throw error;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
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
