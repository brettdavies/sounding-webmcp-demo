/**
 * Sounding — public depth / sea-state API with a kinetic buoy homepage.
 * Humans get the WebGL stage. Agents use /llms.txt, /api/reading, and the
 * well-known MCP card. Default export keeps incomplete OpenAPI + MCP handshake
 * surfaces; createSoundingHandler({ complete: true }) is for tests only.
 */

import { getReading } from './sea-state';

export type SoundingOptions = {
  /** Serve /openapi.json and complete the MCP initialize + tools/list handshake. */
  complete: boolean;
};

const RATE_LIMIT = {
  'RateLimit-Limit': '60',
  'RateLimit-Remaining': '59',
  'RateLimit-Reset': '60',
} as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, mcp-session-id',
} as const;

export function createSoundingHandler(opts: SoundingOptions = { complete: false }): ExportedHandler {
  return {
    fetch(request) {
      return handleSounding(request, opts);
    },
  };
}

export default createSoundingHandler({ complete: false });

export function soundingFetch(request: Request, opts: SoundingOptions = { complete: false }): Promise<Response> {
  return handleSounding(request, opts);
}

async function handleSounding(request: Request, opts: SoundingOptions): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const path = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'OPTIONS' && path === '/mcp') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (path === '/openapi.json') {
    if (!opts.complete) return jsonError(404, 'openapi_not_published');
    return json(openapiDoc(origin), 200);
  }

  if (path === '/api/reading') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonError(405, 'method_not_allowed');
    }
    return json(getReading(), 200);
  }

  if (path === '/llms.txt') {
    return text(llmsTxt(origin), 'text/plain; charset=utf-8');
  }

  if (path === '/robots.txt') {
    return text(ROBOTS, 'text/plain; charset=utf-8');
  }

  if (path === '/.well-known/mcp/server-card.json') {
    return json(serverCard(origin), 200);
  }

  if (
    path === '/.well-known/mcp' ||
    path === '/.well-known/mcp.json' ||
    path === '/mcp.json' ||
    (path === '/mcp' && request.method === 'GET' && wantsJson(request))
  ) {
    return redirect301(`${origin}/.well-known/mcp/server-card.json`);
  }

  if (path === '/mcp') {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, OPTIONS' } });
    }
    if (request.method !== 'POST') return jsonError(405, 'method_not_allowed');
    return handleMcp(request, opts.complete);
  }

  if (path === '/') {
    if (wantsMarkdown(request)) {
      return markdown(homeMarkdown(origin));
    }
    return html(homeHtml(origin), homeHeaders());
  }

  if (wantsMarkdown(request)) {
    return markdown(`# Not found\n\nNo such path. Try [llms.txt](${origin}/llms.txt).\n`, 404);
  }
  if (path === '/anc-web-audit-no-such-api' || path.startsWith('/api/')) {
    return jsonError(404, 'not_found');
  }
  return jsonError(404, 'not_found');
}

async function handleMcp(request: Request, complete: boolean): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error');
  }
  const msg = asRecord(body);
  const id = msg?.id ?? null;
  const method = typeof msg?.method === 'string' ? msg.method : '';

  if (method === 'notifications/initialized') {
    return new Response(null, { status: 202, headers: corsHeaders() });
  }
  if (method === 'initialize') {
    if (!complete) {
      return jsonRpc(id, { protocolVersion: '2025-06-18', capabilities: { tools: {} } });
    }
    return jsonRpc(id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'sounding', version: '0.1.0' },
    });
  }
  if (method === 'tools/list') {
    if (!complete) {
      return jsonRpc(id, { status: 'coming soon' });
    }
    return jsonRpc(id, {
      tools: [
        {
          name: 'get_reading',
          description: 'Return the current depth reading and sea state.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        },
      ],
    });
  }
  return jsonRpcError(id, -32601, 'Method not found');
}

function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  return /text\/markdown/i.test(accept) || /^\s*text\/plain\b/i.test(accept);
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get('Accept') ?? '';
  return /application\/json/i.test(accept);
}

function homeHeaders(): HeadersInit {
  return {
    Link: '</openapi.json>; rel="service-desc", </llms.txt>; rel="alternate"; type="text/plain", </.well-known/mcp/server-card.json>; rel="describedby"',
    Vary: 'Accept, User-Agent',
  };
}

function corsHeaders(): HeadersInit {
  return { ...CORS };
}

function json(body: unknown, status: number): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...RATE_LIMIT,
    },
  });
}

function jsonError(status: number, error: string): Response {
  return json({ error, status }, status);
}

function jsonRpc(id: unknown, result: unknown): Response {
  return new Response(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
      ...RATE_LIMIT,
    },
  });
}

function jsonRpcError(id: unknown, code: number, message: string): Response {
  return new Response(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS,
      ...RATE_LIMIT,
    },
  });
}

function text(body: string, contentType: string, extra?: HeadersInit): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType, ...RATE_LIMIT, ...extra },
  });
}

function html(body: string, extra?: HeadersInit): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...homeHeaders(), ...extra },
  });
}

function markdown(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept, User-Agent',
    },
  });
}

function redirect301(location: string): Response {
  return new Response(null, { status: 301, headers: { Location: location } });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function serverCard(origin: string): Record<string, unknown> {
  return {
    name: 'sounding',
    description: 'Current depth reading and sea state as JSON.',
    mcp_endpoint: `${origin}/mcp`,
    serverInfo: { name: 'sounding', version: '0.1.0' },
    transport: { type: 'streamable-http', endpoint: `${origin}/mcp` },
  };
}

function openapiDoc(origin: string): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Sounding',
      version: '0.1.0',
      description: 'Public depth-reading and sea-state API.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/reading': {
        get: {
          operationId: 'getReading',
          summary: 'Current depth reading and sea state',
          responses: {
            '200': {
              description: 'The current reading',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            '404': { description: 'Unknown path' },
          },
        },
      },
    },
  };
}

function llmsTxt(origin: string): string {
  return `# Sounding

> Public depth reading and sea state as JSON. Station keel-1 at Mavericks approaches, Pillar Point, CA.

## API

- [Current reading](${origin}/api/reading)

## Programmatic access

Use GET /api/reading for depth, wave climate, attitude, and heat set faces.
Homepage stage is a 2-minute compressed Mavericks heat archetype (face heights, not a dated contest day).
MCP is at ${origin}/mcp once the handshake is complete.

## When to use

Call the API when you need the current depth or sea state. Prefer /llms.txt over scraping the homepage.
`;
}

const ROBOTS = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

Content-Signal: ai-train=yes, search=yes, ai-input=yes
`;

function homeMarkdown(origin: string): string {
  const reading = getReading();
  return `---
title: Sounding
description: Public depth-reading JSON API with a kinetic buoy twin. Agent entry points are /llms.txt, /api/reading, and the MCP server card.
url: ${origin}/
---

# Sounding

Keel station at Mavericks approaches (Pillar Point). Current value is ${reading.meters} meters at ${reading.station}.
Homepage stage: 2-minute compressed Mavericks heat archetype (giant faces).

- [llms.txt](${origin}/llms.txt)
- [OpenAPI](${origin}/openapi.json)
- [MCP server card](${origin}/.well-known/mcp/server-card.json)
- [Current reading](${origin}/api/reading)
`;
}

function homeHtml(origin: string): string {
  const reading = getReading();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sounding — keel-1</title>
  <meta name="description" content="Public depth-reading JSON API. A kinetic buoy twin rides the sea on this page. Agents: /llms.txt, /api/reading, /.well-known/mcp/server-card.json.">
  <link rel="service-desc" href="/openapi.json">
  <link rel="alternate" type="text/plain" href="/llms.txt">
  <link rel="describedby" href="/.well-known/mcp/server-card.json">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Source+Sans+3:wght@400;500&display=swap" rel="stylesheet">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebAPI","name":"Sounding","description":"Public depth-reading JSON API","url":"${origin}/","documentation":"${origin}/llms.txt"}
  </script>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/"
    }
  }
  </script>
  <style>
    :root {
      color-scheme: dark;
      --ink: #e8eef4;
      --muted: rgba(232, 238, 244, 0.68);
      --faint: rgba(232, 238, 244, 0.42);
      --panel: rgba(6, 14, 22, 0.42);
      --line: rgba(232, 238, 244, 0.14);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; overflow: hidden; background: #02080f; color: var(--ink); }
    body { font-family: "Source Sans 3", system-ui, sans-serif; }
    #stage { position: fixed; inset: 0; z-index: 0; }
    #stage canvas { display: block; width: 100%; height: 100%; }
    .fallback { margin: 2rem; color: var(--muted); font-family: "IBM Plex Mono", monospace; font-size: 0.85rem; }
    .overlay {
      position: fixed;
      z-index: 2;
      left: clamp(1rem, 4vw, 2.75rem);
      top: clamp(1rem, 4vh, 2.5rem);
      width: min(22rem, calc(100vw - 2rem));
      padding: 1.15rem 1.25rem 1.25rem;
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--panel);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      pointer-events: none;
    }
    .overlay a { pointer-events: auto; color: #c9dde8; text-decoration: underline; text-underline-offset: 0.15em; }
    .brand {
      font-family: Fraunces, Georgia, serif;
      font-weight: 600;
      font-size: clamp(1.85rem, 4vw, 2.35rem);
      letter-spacing: -0.03em;
      line-height: 1.05;
      margin: 0 0 0.4rem;
    }
    .lede {
      margin: 0 0 1.15rem;
      font-size: 0.95rem;
      line-height: 1.45;
      color: var(--muted);
      max-width: 20rem;
    }
    .readout {
      display: grid;
      gap: 0.35rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--line);
      font-family: "IBM Plex Mono", ui-monospace, monospace;
    }
    .meters {
      font-size: clamp(1.75rem, 4vw, 2.25rem);
      font-weight: 500;
      letter-spacing: -0.04em;
      line-height: 1;
      margin: 0;
    }
    .meters .unit { font-size: 0.55em; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-left: 0.35rem; }
    .meta { margin: 0; font-size: 0.72rem; color: var(--faint); letter-spacing: 0.02em; }
    .meta strong { color: var(--muted); font-weight: 500; }
    .api {
      margin: 0.9rem 0 0;
      font-size: 0.78rem;
      color: var(--muted);
      font-family: "IBM Plex Mono", ui-monospace, monospace;
    }
    .credit {
      position: fixed;
      z-index: 2;
      right: 1rem;
      bottom: 0.75rem;
      margin: 0;
      font-size: 0.65rem;
      color: var(--faint);
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      pointer-events: none;
    }
    @media (max-width: 640px) {
      .overlay {
        top: auto;
        bottom: clamp(1rem, 3vh, 1.5rem);
        width: min(100% - 2rem, 24rem);
      }
      .credit { display: none; }
    }
  </style>
</head>
<body>
  <div id="stage" aria-hidden="true"></div>
  <aside class="overlay">
    <h1 class="brand">Sounding</h1>
    <p class="lede">Keel station off Mavericks — compressed heat. Live stats from the buoy.</p>
    <div class="readout">
      <p class="meters"><span id="meters">${reading.meters.toFixed(1)}</span><span class="unit">m</span></p>
      <p class="meta"><strong id="station">${reading.station}</strong> · <span id="place">${reading.place}</span></p>
      <p class="meta"><span id="as-of">${reading.as_of_local ?? reading.as_of}</span></p>
      <p class="meta"><span id="wave">face ${(reading.wave.face_m ?? reading.wave.height_m).toFixed(1)} m · ${reading.wave.period_s} s · ${reading.wave.direction_deg}°</span></p>
    </div>
    <p class="api">GET <a href="/api/reading"><code>/api/reading</code></a></p>
  </aside>
  <p class="credit">ocean: spectral cascade FFT (skill tier) · cliffs/HDRI: Poly Haven CC0 · buoy: Gerard Llorach / ICATMAR</p>
  <noscript>
    <main style="margin:2rem;max-width:36rem;color:#e8eef4;font-family:Georgia,serif">
      <h1>Sounding</h1>
      <p>Current depth ${reading.meters} m at ${reading.station}. Enable JavaScript for the kinetic buoy, or use the machine entry points.</p>
      <ul>
        <li><a href="/llms.txt">/llms.txt</a></li>
        <li><a href="/api/reading">/api/reading</a></li>
        <li><a href="/openapi.json">/openapi.json</a></li>
        <li><a href="/.well-known/mcp/server-card.json">MCP server card</a></li>
      </ul>
    </main>
  </noscript>
  <script type="module" src="/scene.js"></script>
</body>
</html>
`;
}
