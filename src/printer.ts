import chalk from "chalk";
import type { InspectResult } from "./types.js";

export function printResult(result: InspectResult): void {
  const { score } = result;

  // Header
  console.log("");
  console.log(chalk.bold("═══════════════════════════════════════════"));
  console.log(chalk.bold(`  MCP Server Inspection Report`));
  if (result.serverName) {
    console.log(chalk.dim(`  Server: ${result.serverName}`));
  }
  console.log(chalk.bold("═══════════════════════════════════════════"));
  console.log("");

  // Tools
  if (result.tools.length > 0) {
    console.log(chalk.bold.underline("Tools:"));
    for (const tool of result.tools) {
      const callResult = result.toolResults.find((r) => r.tool === tool.name);
      const status = callResult
        ? callResult.success
          ? chalk.green("PASS")
          : chalk.red("FAIL")
        : chalk.yellow("SKIP");
      const duration = callResult ? chalk.dim(` (${callResult.durationMs}ms)`) : "";
      console.log(`  ${status} ${chalk.white(tool.name)} — ${tool.description ?? ""}${duration}`);
      if (callResult && !callResult.success && callResult.error) {
        console.log(`       ${chalk.red(callResult.error)}`);
      }
    }
    console.log("");
  }

  // Resources
  if (result.resources.length > 0) {
    console.log(chalk.bold.underline("Resources:"));
    for (const resource of result.resources) {
      const readResult = result.resourceResults.find((r) => r.uri === resource.uri);
      const status = readResult
        ? readResult.success
          ? chalk.green("PASS")
          : chalk.red("FAIL")
        : chalk.yellow("SKIP");
      const duration = readResult ? chalk.dim(` (${readResult.durationMs}ms)`) : "";
      const size = readResult?.contentLength
        ? chalk.dim(` [${readResult.contentLength} bytes]`)
        : "";
      console.log(`  ${status} ${chalk.blue(resource.uri)}${size}${duration}`);
      if (readResult && !readResult.success && readResult.error) {
        console.log(`       ${chalk.red(readResult.error)}`);
      }
    }
    console.log("");
  }

  // Prompts
  if (result.prompts.length > 0) {
    console.log(chalk.bold.underline("Prompts:"));
    for (const prompt of result.prompts) {
      const getResult = result.promptResults.find((r) => r.name === prompt.name);
      const status = getResult
        ? getResult.success
          ? chalk.green("PASS")
          : chalk.red("FAIL")
        : chalk.yellow("SKIP");
      const duration = getResult ? chalk.dim(` (${getResult.durationMs}ms)`) : "";
      const msgCount = getResult?.messageCount
        ? chalk.dim(` [${getResult.messageCount} messages]`)
        : "";
      console.log(`  ${status} ${chalk.magenta(prompt.name)} — ${prompt.description ?? ""}${msgCount}${duration}`);
      if (getResult && !getResult.success && getResult.error) {
        console.log(`       ${chalk.red(getResult.error)}`);
      }
    }
    console.log("");
  }

  // Schema issues
  if (result.schemaIssues.length > 0) {
    console.log(chalk.bold.underline("Schema Issues:"));
    for (const issue of result.schemaIssues) {
      const icon = issue.severity === "error" ? chalk.red("ERROR") : chalk.yellow("WARN ");
      console.log(`  ${icon} ${chalk.white(issue.tool)} — ${issue.issue}`);
    }
    console.log("");
  }

  // Compliance issues
  if (result.complianceIssues.length > 0) {
    console.log(chalk.bold.underline("Compliance Issues:"));
    for (const issue of result.complianceIssues) {
      const icon =
        issue.severity === "error"
          ? chalk.red("ERROR")
          : issue.severity === "warning"
          ? chalk.yellow("WARN ")
          : chalk.blue("INFO ");
      console.log(`  ${icon} [${issue.check}] ${issue.message}`);
    }
    console.log("");
  }

  // Score card
  console.log(chalk.bold("═══════════════════════════════════════════"));
  console.log(chalk.bold("  Health Check Score"));
  console.log(chalk.bold("═══════════════════════════════════════════"));
  console.log("");

  const toolScore = score.toolsTotal > 0
    ? `${score.toolsCallable}/${score.toolsTotal}`
    : "N/A";
  const resScore = score.resourcesTotal > 0
    ? `${score.resourcesReadable}/${score.resourcesTotal}`
    : "N/A";
  const promptScore = score.promptsTotal > 0
    ? `${score.promptsGettable}/${score.promptsTotal}`
    : "N/A";

  const toolColor = score.toolsCallable === score.toolsTotal ? chalk.green : chalk.yellow;
  const resColor = score.resourcesReadable === score.resourcesTotal ? chalk.green : chalk.yellow;
  const promptColor = score.promptsGettable === score.promptsTotal ? chalk.green : chalk.yellow;

  console.log(`  Tools callable:      ${toolColor(toolScore)}`);
  console.log(`  Resources readable:  ${resColor(resScore)}`);
  console.log(`  Prompts gettable:    ${promptColor(promptScore)}`);
  console.log(`  Schema errors:       ${score.schemaErrors > 0 ? chalk.red(String(score.schemaErrors)) : chalk.green("0")}`);
  console.log(`  Schema warnings:     ${score.schemaWarnings > 0 ? chalk.yellow(String(score.schemaWarnings)) : chalk.green("0")}`);
  console.log(`  Compliance errors:   ${score.complianceErrors > 0 ? chalk.red(String(score.complianceErrors)) : chalk.green("0")}`);
  console.log(`  Compliance warnings: ${score.complianceWarnings > 0 ? chalk.yellow(String(score.complianceWarnings)) : chalk.green("0")}`);
  console.log(`  Total time:          ${chalk.dim(`${result.durationMs}ms`)}`);
  console.log("");

  // Overall verdict
  const allPassed =
    score.toolsCallable === score.toolsTotal &&
    score.resourcesReadable === score.resourcesTotal &&
    score.promptsGettable === score.promptsTotal &&
    score.schemaErrors === 0;

  if (allPassed) {
    console.log(chalk.green.bold("  ALL CHECKS PASSED"));
  } else {
    console.log(chalk.red.bold("  SOME CHECKS FAILED"));
  }
  console.log("");
}
