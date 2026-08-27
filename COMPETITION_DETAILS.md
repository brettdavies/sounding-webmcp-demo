# Sounding Judge Guide

This file is the first-pass fixture for the [anc.dev WebMCP audit](https://anc.dev/web-audit), not application
documentation. The incomplete Worker is the commit tagged `competition-baseline`.

At that commit the default export fails these three MUST rows:

1. **`openapi`:** the root page advertises `/openapi.json` with `rel="service-desc"`, but the default handler returns
   `404` for that path.
2. **`mcp-initialize`:** the MCP server card points to `/mcp`, but the `initialize` result omits the required
   `serverInfo` object.
3. **`mcp-tools-list`:** the `tools/list` result omits the required `tools` array.

`createSoundingHandler({ complete: true })` supplies those three surfaces for focused tests. The default export stays
`createSoundingHandler({ complete: false })` at this tag so a first audit reproduces the rows above.

## Repair target

A repair of this fixture must:

1. Serve a valid OpenAPI document from `/openapi.json`.
2. Include `serverInfo` in the `initialize` response.
3. Return a `tools` array from `tools/list`.

Deploy the repaired Worker and run the audit again. The worksheet should contain no MUST failures.

If the live Worker already passes those three rows, someone already completed the loop. Restore the first pass with:

```bash
git checkout competition-baseline
npx wrangler deploy
```

## Judge walkthrough

Live audit: https://anc.dev/web-audit

Live target: https://sounding.brettdavies.workers.dev

Result page after an audit: https://anc.dev/web/sounding.brettdavies.workers.dev

The result-page WebMCP tools read the scorecard on screen. They do not start an audit, submit the form, or make network
requests. A person still clicks **Audit** and completes Turnstile.

### ChatGPT in-app browser

Open `https://anc.dev/web-audit` in ChatGPT's in-app browser, then give Codex this prompt:

```text
Use the website audit at https://anc.dev/web-audit to review https://sounding.brettdavies.workers.dev. Fix all the critical items, test and deploy the changes, then run the audit again to confirm the fixes worked. After you're done, clearly explain what changed and anything still outstanding.
```

Codex can prepare the form and drive the repair. You still click **Audit** and complete Turnstile.

### Chrome with WebMCP testing

Enable `chrome://flags/#enable-webmcp-testing`, restart Chrome, open `https://anc.dev/web-audit`, and paste this into
DevTools Console.

`executeTool` takes an object (the spec). Older Chrome builds still want a JSON string, so the helper tries the object
first. This lists the page tools, fills the Sounding URL, and posts a short plan. It does not click Audit.

```js
await (async () => {
  const tools = await document.modelContext.getTools();
  console.table(tools.map(({ name, description, annotations }) => ({ name, description, annotations })));

  const run = async (name, input = {}) => {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Missing WebMCP tool: ${name}`);
    try {
      return await document.modelContext.executeTool(tool, input);
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (msg.includes('parse input') || msg.includes('JSON')) {
        return await document.modelContext.executeTool(tool, JSON.stringify(input));
      }
      throw err;
    }
  };

  console.log(await run('fill_audit_url', { url: 'https://sounding.brettdavies.workers.dev' }));
  console.log(await run('set_plan', { text: 'Review the agent-readiness findings, then prepare the smallest safe remediation set.' }));
})();
```

Click **Audit** yourself and complete Turnstile. On the resulting `/web/sounding.brettdavies.workers.dev` page, paste
the second script.

Chrome returns a serialized MCP envelope, so the helper peels encoding until it has the tool's JSON body. It then drains
`get_worksheet({ keywords: ['must'] })`, following `next_offset`, prints cache freshness, and prints each remediable
`get_fix_prompt`. It does not issue a network request or start another audit.

On a first-pass fixture the MUST table should include `openapi`, `mcp-initialize`, and `mcp-tools-list`.

```js
await (async () => {
  const tools = await document.modelContext.getTools();

  const run = async (name, input = {}) => {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Missing WebMCP tool: ${name}`);
    try {
      return await document.modelContext.executeTool(tool, input);
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (msg.includes('parse input') || msg.includes('JSON')) {
        return await document.modelContext.executeTool(tool, JSON.stringify(input));
      }
      throw err;
    }
  };

  const peel = (value) => {
    let current = value;
    for (let i = 0; i < 4; i += 1) {
      if (typeof current === 'string') {
        const trimmed = current.trim();
        if (!(trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"'))) break;
        try {
          current = JSON.parse(current);
          continue;
        } catch {
          break;
        }
      }
      const text = current?.content?.[0]?.text;
      if (text == null) break;
      current = text;
    }
    return current;
  };

  const drain = async (name, input = {}) => {
    const items = [];
    let offset = 0;
    let meta = {};
    for (;;) {
      const page = peel(await run(name, { ...input, offset }));
      if (page?.ok === false) throw new Error(page.error?.message ?? `WebMCP ${name} failed`);
      items.push(...(page.items ?? []));
      meta = page;
      if (page.next_offset == null) return { ...meta, items };
      offset = page.next_offset;
    }
  };

  const worksheet = await drain('get_worksheet', { keywords: ['must'] });
  console.log({
    cached: worksheet.cached,
    scored_at: worksheet.scored_at,
    refresh_after: worksheet.refresh_after,
  });
  console.table(
    worksheet.items.map(({ id, keyword, status, remediable }) => ({ id, keyword, status, remediable })),
  );

  const prompts = [];
  for (const row of worksheet.items.filter((item) => item.remediable)) {
    const fix = peel(await run('get_fix_prompt', { id: row.id }));
    prompts.push({ id: row.id, status: row.status, prompt: fix.prompt ?? fix.reason });
    console.log(`\n=== ${row.id} (${row.status}) ===\n${fix.prompt ?? fix.reason}`);
  }
  return { findings: worksheet.items, prompts };
})();
```
