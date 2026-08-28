#!/usr/bin/env bash
# Measure fpsSettleAudit in native Chrome via CDP (not Playwright).
# Usage: BASE_URL=http://127.0.0.1:8787 ./scripts/measure-fps-native.sh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

base_url="${BASE_URL:-http://127.0.0.1:8787}"
port="${CDP_PORT:-9223}"
page_url="${base_url}/?view=reef&seed=46012&nopanel&debug=perf"
chrome_bin="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
profile_dir="/tmp/sounding-fps-chrome-${port}"

if [[ ! -x "$chrome_bin" ]]; then
  echo "FAIL: Chrome not found at $chrome_bin" >&2
  exit 1
fi

pkill -f "remote-debugging-port=${port}" 2>/dev/null || true
sleep 1

"$chrome_bin" \
  "--remote-debugging-port=${port}" \
  "--user-data-dir=${profile_dir}" \
  --no-first-run \
  --no-default-browser-check \
  --window-size=1280,720 \
  "$page_url" >/dev/null 2>&1 &

sleep 3

CDP_PORT="$port" node --input-type=module <<'NODE'
const port = Number(process.env.CDP_PORT || 9223);

await new Promise((r) => setTimeout(r, 1500));

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) => res.json());
const page = targets.find((t) => t.type === 'page' && t.url.includes('8787'));
if (!page?.webSocketDebuggerUrl) {
  console.error('FAIL: no CDP page target', targets.map((t) => t.url));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let seq = 0;
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const onMsg = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const expr = `new Promise((resolve) => {
  const start = Date.now();
  function poll() {
    const b = window.__soundingBoot;
    if (b?.ready && b?.qualityRamp?.settled && b?.perfGate?.gateArmed) {
      setTimeout(() => resolve(JSON.stringify(b.fpsSettleAudit())), 10000);
      return;
    }
    if (Date.now() - start > 35000) {
      resolve(JSON.stringify({ timeout: true, audit: b?.fpsSettleAudit?.() }));
      return;
    }
    setTimeout(poll, 300);
  }
  poll();
})`;

const out = await cdp('Runtime.evaluate', {
  expression: expr,
  awaitPromise: true,
  returnByValue: true,
});

console.log('native-chrome-fps:', out.result.value);
const audit = JSON.parse(out.result.value);
if (audit.ok) {
  console.log('OK: fps settle', audit.fps, 'fps tier', audit.tier);
} else {
  console.log(
    'WARN: fps settle below target — fps',
    audit.fps,
    'workFps',
    audit.workFps,
    'effectiveFps',
    audit.effectiveFps,
    'tier',
    audit.tier,
    'renderScale',
    audit.renderScale,
  );
}
NODE
