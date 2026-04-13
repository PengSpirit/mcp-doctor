import chalk from "chalk";
import type { BenchResult } from "./types.js";

export function printBenchResult(result: BenchResult): void {
  console.log("");
  console.log(chalk.bold("═══════════════════════════════════════════════════════════════"));
  console.log(chalk.bold("  MCP Server Benchmark Report"));
  if (result.serverName) {
    console.log(chalk.dim(`  Server: ${result.serverName}`));
  }
  console.log(chalk.dim(`  Iterations: ${result.iterations}`));
  console.log(chalk.bold("═══════════════════════════════════════════════════════════════"));
  console.log("");

  console.log(
    chalk.bold(
      padRight("Tool", 30) +
      padRight("p50", 10) +
      padRight("p95", 10) +
      padRight("p99", 10) +
      padRight("min", 10) +
      padRight("max", 10) +
      padRight("ops/s", 10) +
      "errors"
    )
  );
  console.log(chalk.dim("─".repeat(100)));

  for (const t of result.tools) {
    const errColor = t.errors > 0 ? chalk.red : chalk.green;
    console.log(
      chalk.white(padRight(t.tool, 30)) +
      chalk.cyan(padRight(`${t.p50}ms`, 10)) +
      chalk.yellow(padRight(`${t.p95}ms`, 10)) +
      chalk.red(padRight(`${t.p99}ms`, 10)) +
      chalk.dim(padRight(`${t.min}ms`, 10)) +
      chalk.dim(padRight(`${t.max}ms`, 10)) +
      chalk.green(padRight(t.throughput.toFixed(1), 10)) +
      errColor(String(t.errors))
    );
  }

  console.log("");
  console.log(chalk.dim(`  Total time: ${result.durationMs}ms`));
  console.log("");
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}
