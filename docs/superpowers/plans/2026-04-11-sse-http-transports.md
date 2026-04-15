# SSE + Streamable HTTP Transport Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `mcp-doctor` inspect remote MCP servers over SSE and Streamable HTTP, not just local stdio processes. Closes issue #1.

**Architecture:** Introduce a transport factory (`src/transport.ts`) that returns an SDK `Transport` given a parsed target spec. `inspectServer` takes the pre-built transport instead of constructing one. CLI auto-detects URLs vs commands and exposes `--transport <stdio|sse|http>` + `--header <k:v>` for explicit override and auth.

**Tech Stack:** `@modelcontextprotocol/sdk/client/stdio`, `.../client/sse`, `.../client/streamableHttp`, commander, vitest.

---

## File Structure

- Create: `src/transport.ts` — transport factory + target parser
- Create: `src/transport.test.ts` — unit tests for factory/parser
- Modify: `src/client.ts` — accept `Transport` instead of building one; drop `command` string arg
- Modify: `src/index.ts` — CLI: accept URL or command, add `--transport` and `--header`, build transport, pass to `inspectServer`
- Modify: `src/types.ts` — add `TransportKind`, `TransportSpec`, update `InspectOptions`
- Modify: `package.json` — bump version to `0.2.0`
- Modify: `README.md` — document remote server usage

---

### Task 1: Transport types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add transport types to `src/types.ts`**

Append to the file:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add TargetSpec for multi-transport support"
```

---

### Task 2: Target parser (URL vs command) — TDD

**Files:**
- Create: `src/transport.ts`
- Create: `src/transport.test.ts`

- [ ] **Step 1: Write failing tests**

Write `src/transport.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect red**

Run: `npx vitest run src/transport.test.ts`
Expected: FAIL — `parseTarget` not exported.

- [ ] **Step 3: Implement `parseTarget`**

Create `src/transport.ts`:

```ts
import type { TargetSpec, TransportKind } from "./types.js";

export interface ParseTargetOptions {
  transport?: TransportKind;
  headers?: string[];
}

export function parseTarget(
  target: string,
  opts: ParseTargetOptions
): TargetSpec {
  const isUrl = /^https?:\/\//i.test(target);

  if (isUrl) {
    if (opts.transport === "stdio") {
      throw new Error(
        "--transport stdio is incompatible with a URL target. Pass a command instead."
      );
    }
    const kind: "sse" | "http" = opts.transport === "sse" ? "sse" : "http";
    return {
      kind,
      url: new URL(target),
      headers: parseHeaders(opts.headers ?? []),
    };
  }

  if (opts.transport === "sse" || opts.transport === "http") {
    throw new Error(
      `--transport ${opts.transport} requires a URL target (http:// or https://).`
    );
  }

  const parts = target.split(/\s+/).filter(Boolean);
  return {
    kind: "stdio",
    command: parts[0],
    args: parts.slice(1),
  };
}

function parseHeaders(raw: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of raw) {
    const idx = h.indexOf(":");
    if (idx === -1) {
      throw new Error(`Invalid --header "${h}". Expected "Name: value".`);
    }
    const name = h.slice(0, idx).trim();
    const value = h.slice(idx + 1).trim();
    if (!name) throw new Error(`Invalid --header "${h}". Missing name.`);
    out[name] = value;
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect green**

Run: `npx vitest run src/transport.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/transport.ts src/transport.test.ts
git commit -m "feat(transport): add parseTarget for stdio/sse/http targets"
```

---

### Task 3: Transport factory

**Files:**
- Modify: `src/transport.ts`
- Modify: `src/transport.test.ts`

- [ ] **Step 1: Add failing test for factory**

Append to `src/transport.test.ts`:

```ts
import { createTransport } from "./transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

describe("createTransport", () => {
  it("builds a StdioClientTransport for stdio specs", () => {
    const t = createTransport({
      kind: "stdio",
      command: "echo",
      args: ["hi"],
    });
    expect(t).toBeInstanceOf(StdioClientTransport);
  });

  it("builds an SSEClientTransport for sse specs", () => {
    const t = createTransport({
      kind: "sse",
      url: new URL("https://example.com/mcp"),
      headers: {},
    });
    expect(t).toBeInstanceOf(SSEClientTransport);
  });

  it("builds a StreamableHTTPClientTransport for http specs", () => {
    const t = createTransport({
      kind: "http",
      url: new URL("https://example.com/mcp"),
      headers: {},
    });
    expect(t).toBeInstanceOf(StreamableHTTPClientTransport);
  });
});
```

- [ ] **Step 2: Run — expect red**

Run: `npx vitest run src/transport.test.ts`
Expected: FAIL — `createTransport` not exported.

- [ ] **Step 3: Implement `createTransport`**

Append to `src/transport.ts`:

```ts
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";

export function createTransport(spec: TargetSpec): Transport {
  if (spec.kind === "stdio") {
    return new StdioClientTransport({
      command: spec.command,
      args: spec.args,
      stderr: "pipe",
    });
  }

  const requestInit: RequestInit =
    Object.keys(spec.headers).length > 0 ? { headers: spec.headers } : {};

  if (spec.kind === "sse") {
    return new SSEClientTransport(spec.url, {
      requestInit,
      eventSourceInit:
        Object.keys(spec.headers).length > 0
          ? {
              fetch: (input, init) =>
                fetch(input, { ...init, headers: { ...init?.headers, ...spec.headers } }),
            }
          : undefined,
    });
  }

  // kind === "http"
  return new StreamableHTTPClientTransport(spec.url, { requestInit });
}
```

- [ ] **Step 4: Run — expect green**

Run: `npx vitest run src/transport.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/transport.ts src/transport.test.ts
git commit -m "feat(transport): add createTransport factory for stdio/sse/http"
```

---

### Task 4: Refactor `inspectServer` to accept a pre-built transport

**Files:**
- Modify: `src/client.ts`

- [ ] **Step 1: Change signature + stderr handling**

Replace the top of `src/client.ts` (imports + function signature through line 48) with:

```ts
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
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
```

Leave the rest of the file (the `try { … }` body) unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0 (errors in `src/index.ts` are fine — fixed in Task 5).

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: all pre-existing unit tests still PASS (they don't import `client.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/client.ts
git commit -m "refactor(client): accept pre-built Transport instead of command string"
```

---

### Task 5: CLI — accept URL or command, wire transport flags

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace `src/index.ts`**

Overwrite `src/index.ts` with:

```ts
#!/usr/bin/env node

import { Command } from "commander";
import { inspectServer } from "./client.js";
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

program.parse();
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0, `dist/` updated.

- [ ] **Step 4: Smoke test against a real stdio MCP server**

Run: `node dist/index.js test "npx -y @modelcontextprotocol/server-everything" --timeout 20000`
Expected: connects, lists tools/resources/prompts, prints scorecard. Exit code may be non-zero if the server has flaky tools — that's fine, what matters is it runs end-to-end.

- [ ] **Step 5: Smoke test CLI validation**

Run: `node dist/index.js test "https://example.com/mcp" --transport stdio`
Expected: exits non-zero with error message mentioning "stdio" and "URL".

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): accept URL targets, add --transport and --header flags"
```

---

### Task 6: Full test suite + version bump + README

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests PASS (schema-validator, sample-args, transport).

- [ ] **Step 2: Bump version**

Edit `package.json`: change `"version": "0.1.0"` to `"version": "0.2.0"`.

- [ ] **Step 3: Update README usage section**

In `README.md`, replace the existing usage/example section so it documents both transports. Add a block that looks like:

````markdown
## Usage

### Local stdio server

```bash
npx mcp-doctor test "npx -y @modelcontextprotocol/server-everything"
```

### Remote server (Streamable HTTP)

```bash
npx mcp-doctor test https://your-server.example.com/mcp
```

### Remote server (SSE)

```bash
npx mcp-doctor test https://your-server.example.com/mcp --transport sse
```

### Authenticated remote server

```bash
npx mcp-doctor test https://your-server.example.com/mcp \
  --header "Authorization: Bearer $TOKEN"
```

### Options

| Flag | Description |
|---|---|
| `--json` | Output results as JSON |
| `--timeout <ms>` | Per-operation timeout (default 30000) |
| `--transport <kind>` | Force `stdio`, `sse`, or `http` (auto-detected from target) |
| `--header <Name: value>` | Add header to remote transport. Repeatable. |
````

Preserve the existing intro, demo GIF, and roadmap sections.

- [ ] **Step 4: Final build + test + lint-style typecheck**

Run: `npm run build && npx vitest run && npx tsc --noEmit`
Expected: all three exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "chore: release v0.2.0 with SSE + Streamable HTTP support"
```

- [ ] **Step 6: Tag release**

```bash
git tag v0.2.0
```

(Do not push the tag yet — wait for user confirmation before `git push` / `npm publish`.)

---

## Self-Review

**Spec coverage (Issue #1 = "Support SSE and Streamable HTTP transports"):**
- SSE transport: Task 3 factory + Task 5 CLI
- Streamable HTTP transport: Task 3 factory + Task 5 CLI (default for URL targets)
- Backward-compat with stdio: Task 2 parser defaults, Task 4 refactor preserves stdio path, Task 5 CLI accepts commands as before
- Auth for remote servers: `--header` flag (Task 5), wired through `createTransport` (Task 3)

**Placeholder scan:** All code blocks are complete. No TBDs. Every file path is exact.

**Type consistency:** `TargetSpec`/`TransportKind`/`parseTarget`/`createTransport` names match across Tasks 1–5. `inspectServer(transport, options)` signature is consistent between Task 4 definition and Task 5 call site.
