# Sounding

A tiny public depth-reading API. Live Worker: <https://sounding.brettdavies.workers.dev>

This repo is the **audit patient** for the [anc.dev](https://anc.dev/web-audit) WebMCP clip. Judges collaborate on
anc.dev. This host is what they score.

## Broken state (what we deploy)

The page, `/api/reading`, `/llms.txt`, robots, the well-known MCP card, and MCP CORS already pass. Three MUST rows stay
red on purpose:

1. **`openapi`:** `<link rel="service-desc">` points at `/openapi.json`; the file is not served.
2. **`mcp-initialize`:** the card discovers `/mcp`; `initialize` omits `serverInfo`.
3. **`mcp-tools-list`:** `tools/list` omits `tools[]`.

Do not "fix" `mcp-cors-*`. CORS already ships.

Default export stays broken. `createSoundingHandler({ complete: true })` is the recording-day shape; do not ship it.

## Clip (two loops, one fix pass)

On production anc.dev `/web-audit` (ChatGPT in-app or Chrome with WebMCP):

1. Loop 1: `fill_audit_url` with this host. Human Audit. `get_worksheet` then `get_fix_prompt` for all three MUST ids.
   Never `mcp-cors-*`.
2. One pass in `src/index.ts`. Deploy.
3. Loop 2: Human Audit again. `get_worksheet` has no MUST rows.

`main` stays the broken patient. After a take:

```bash
git checkout -- src
npx wrangler deploy
```

## Deploy

```bash
npm install
npx wrangler deploy
```
