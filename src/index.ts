#!/usr/bin/env node

import { Command } from "commander";
import { inspectServer } from "./client.js";
import { benchServer } from "./bench.js";
import { parseTarget, createTransport } from "./transport.js";
import type { TransportKind } from "./types.js";

const program = new Command();

program
  .name("mcp-doctor")
  .description("One command to diagnose your MCP server (stdio, SSE, or Streamable HTTP)")
  .version("0.2.0");

program
  .command("test")
  .description("Connect to an MCP server and run a full inspection")
  .argument(
    "<target>",
    'MCP server target. A command (e.g. "npx -y @modelcontextprotocol/server-everything") for stdio, or a URL (e.g. "https://example.com/mcp") for remote servers.'
  )
  .option("--json", "Output results as JSON", false)
  .option("--timeout <ms>", "Timeout per operation in milliseconds", "30000")
  .option("--html <path>", "Save HTML report to file")
  .option(
    "--transport <kind>",
    "Force transport: stdio | sse | http (auto-detected from target by default)"
  )
  .option(
    "--header <header>",
    'Header for remote transports, "Name: value". Repeatable.',
    (value: string, prev: string[] = []) => [...prev, value],
    [] as string[]
  )
  .action(
    async (
      target: string,
      opts: {
        json: boolean;
        timeout: string;
        html?: string;
        transport?: string;
        header: string[];
      }
    ) => {
      try {
        if (
          opts.transport &&
          !["stdio", "sse", "http"].includes(opts.transport)
        ) {
          throw new Error(
            `Invalid --transport "${opts.transport}". Expected stdio, sse, or http.`
          );
        }

        const spec = parseTarget(target, {
          transport: opts.transport as TransportKind | undefined,
          headers: opts.header,
        });
        const transport = createTransport(spec);

        const result = await inspectServer(transport, {
          json: opts.json,
          timeout: parseInt(opts.timeout, 10),
          html: opts.html,
        });

        const { score } = result;
        const allPassed =
          score.toolsCallable === score.toolsTotal &&
          score.resourcesReadable === score.resourcesTotal &&
          score.promptsGettable === score.promptsTotal &&
          score.schemaErrors === 0;

        if (!allPassed) {
          process.exit(1);
        }
      } catch (error) {
        console.error(
          "Error:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    }
  );

program
  .command("bench")
  .description("Benchmark tool latency on an MCP server")
  .argument("<target>", "MCP server target (command or URL)")
  .option("--iterations <n>", "Number of iterations per tool", "10")
  .option("--json", "Output results as JSON", false)
  .option("--timeout <ms>", "Timeout per operation in milliseconds", "30000")
  .option("--transport <kind>", "Force transport: stdio | sse | http")
  .option(
    "--header <header>",
    'Header for remote transports. Repeatable.',
    (value: string, prev: string[] = []) => [...prev, value],
    [] as string[]
  )
  .action(
    async (
      target: string,
      opts: {
        iterations: string;
        json: boolean;
        timeout: string;
        transport?: string;
        header: string[];
      }
    ) => {
      try {
        if (opts.transport && !["stdio", "sse", "http"].includes(opts.transport)) {
          throw new Error(`Invalid --transport "${opts.transport}".`);
        }
        const spec = parseTarget(target, {
          transport: opts.transport as TransportKind | undefined,
          headers: opts.header,
        });
        const transport = createTransport(spec);
        await benchServer(transport, {
          iterations: parseInt(opts.iterations, 10),
          json: opts.json,
          timeout: parseInt(opts.timeout, 10),
        });
      } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
        process.exit(1);
      }
    }
  );

program.parse();
