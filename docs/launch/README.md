# Launch materials

**Launch date: Wed 2026-04-29.** Start time **9:45pm Taipei = 9:45am ET**. Reply window ends ~1:45am Thu Taipei.

Paste-ready copy for the mcp-probe v0.2.1 launch. One file per channel.

## Launch day (in order)

1. **Discord** — `docs/launch/discord.md` — AM PT, MCP community first
2. **Show HN** — `docs/launch/show-hn.md` — 8–10am ET Tue/Wed
3. **r/mcp** — `docs/launch/reddit-mcp.md` — immediately after HN
4. **r/ClaudeAI** — `docs/launch/reddit-claudeai.md` — parallel with r/mcp
5. **Twitter/X thread** — `docs/launch/twitter-thread.md` — parallel with HN (pin tweet 1)

## Day 2

6. **r/LocalLLaMA** — `docs/launch/reddit-localllama.md` — after you have HN/Reddit signal to reference
7. **LinkedIn** — `docs/launch/linkedin.md` — morning Taipei time

## Week 2

8. Blog post: *"I ran mcp-probe against 20 MCP servers. Here's what broke."* (draft using `docs/scorecards/` data)
9. YouTube / Loom walkthrough (8–12 min)
10. dev.to tutorial: "Add MCP server health checks to your GitHub Actions in 5 minutes" (link to `docs/ci-example.md`)

## Live scorecards

Real data captured 2026-04-19 from 4 official Node MCP servers — see `docs/scorecards/`. (Anthropic's `fetch` server is Python-only, not on npm — never include in "broken on npm" framing.) 2 / 4 servers pass clean; the other 2 fail in ways traceable to missing `description` fields on schema properties. Use these as evidence during launch discussions.

## Hard rules

- NO hype words ("revolutionary", "game-changing", "AI-powered")
- NO emoji on HN
- NO @ tagging Anthropic staff asking for boosts
- NO cross-posting to multiple Discord channels
- Reply window = 30 min for HN, 1 hour for Reddit, 48 hours for everything else
- Give 72h heads-up to any server maintainer before publishing failure data about their server
