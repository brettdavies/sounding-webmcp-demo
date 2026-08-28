/**
 * Layer panel — URL params + runtime toggles for stage/ocean debug (P3).
 *
 * URL: ?nopanel / ?panel=0 hide panel; ?no=set-wave,foam; legacy ?no=heat;
 *      ?layers=terrain,ocean enable only listed layers.
 */

/** @typedef {'stage' | 'ocean' | 'shader'} LayerGroup */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   group: LayerGroup,
 *   default?: boolean,
 *   apply: (enabled: boolean) => void,
 * }} LayerDef
 */

export const SEA_LAYER_ORDER = Object.freeze([
  'terrain',
  'buoy',
  'spray',
  'sky',
  'hdri',
  'sun',
  'ocean',
  'fft',
  'swell',
  'set-wave',
  'shoreline',
  'foam',
  'detail',
]);

export const LAND_LAYER_ORDER = Object.freeze(['terrain', 'hdri', 'sun']);

export const SHADER_MODES = Object.freeze([
  { id: 'beauty', label: 'Beauty', debugMode: 0 },
  { id: 'fft', label: 'FFT height', debugMode: 1 },
  { id: 'normals', label: 'Normals', debugMode: 2 },
  { id: 'jacobian', label: 'Jacobian', debugMode: 3 },
  { id: 'foam', label: 'Foam composite', debugMode: 7 },
]);

/**
 * @param {URLSearchParams} params
 */
export function parseLayerUrl(params) {
  const hidden = params.has('nopanel') || params.get('panel') === '0';
  /** @type {Set<string>} */
  const disabled = new Set();
  const noRaw = params.get('no') ?? '';
  for (const token of noRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (token === 'heat') {
      disabled.add('set-wave');
    } else {
      disabled.add(token);
    }
  }
  const layersRaw = params.get('layers');
  /** @type {Set<string> | null} */
  let enabledOnly = null;
  if (layersRaw) {
    enabledOnly = new Set(
      layersRaw.split(',').map((s) => s.trim()).filter(Boolean),
    );
  }
  return { hidden, disabled, enabledOnly };
}

/**
 * @param {ReturnType<typeof parseLayerUrl>} parsed
 * @param {readonly string[]} layerIds
 */
export function initialLayerState(parsed, layerIds) {
  /** @type {Record<string, boolean>} */
  const state = {};
  for (const id of layerIds) {
    if (parsed.enabledOnly) {
      state[id] = parsed.enabledOnly.has(id);
    } else {
      state[id] = !parsed.disabled.has(id);
    }
  }
  return state;
}

/**
 * @param {URLSearchParams} params
 * @param {readonly string[]} layerIds
 */
export function layerStateFromUrl(params, layerIds) {
  return initialLayerState(parseLayerUrl(params), layerIds);
}

/**
 * Node-safe gate for verify script.
 */
export function verifyLayerControls() {
  const parsed = parseLayerUrl(
    new URLSearchParams('no=set-wave,foam,heat&nopanel&layers=terrain,ocean'),
  );
  const mixed = initialLayerState(parsed, ['terrain', 'ocean', 'set-wave', 'foam']);
  const ok =
    parsed.hidden &&
    mixed.terrain === true &&
    mixed.ocean === true &&
    mixed['set-wave'] === false &&
    mixed.foam === false;
  return {
    ok,
    hidden: parsed.hidden,
    state: mixed,
    shaderModes: SHADER_MODES.length,
  };
}

const PANEL_STYLE = `
.sounding-layer-panel {
  position: fixed;
  z-index: 3;
  top: clamp(0.75rem, 2vh, 1.25rem);
  right: clamp(0.75rem, 2vw, 1.25rem);
  width: min(15.5rem, calc(100vw - 2rem));
  max-height: min(70vh, 28rem);
  overflow: auto;
  padding: 0.65rem 0.75rem 0.75rem;
  border: 1px solid rgba(200, 220, 232, 0.18);
  border-radius: 2px;
  background: rgba(8, 14, 20, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #c9dde8;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 0.68rem;
  line-height: 1.35;
  pointer-events: auto;
}
.sounding-layer-panel h2 {
  margin: 0 0 0.45rem;
  font-family: Fraunces, Georgia, serif;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #e8eef4;
}
.sounding-layer-panel fieldset {
  margin: 0 0 0.55rem;
  padding: 0;
  border: 0;
}
.sounding-layer-panel legend {
  padding: 0;
  margin: 0 0 0.25rem;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(201, 221, 232, 0.55);
}
.sounding-layer-panel label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0.15rem 0;
  cursor: pointer;
}
.sounding-layer-panel select {
  width: 100%;
  margin-top: 0.15rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid rgba(200, 220, 232, 0.22);
  border-radius: 2px;
  background: rgba(4, 10, 16, 0.85);
  color: #c9dde8;
  font: inherit;
}
`;

/**
 * @param {{
 *   params: URLSearchParams,
 *   layers: LayerDef[],
 *   onShaderMode?: (debugMode: number) => void,
 * }} options
 */
export function createLayerPanel(options) {
  const parsed = parseLayerUrl(options.params);
  const layerIds = options.layers.map((l) => l.id);
  /** @type {Record<string, boolean>} */
  const state = initialLayerState(parsed, layerIds);
  let shaderMode = SHADER_MODES[0].id;

  /** @param {string} id @param {boolean} enabled */
  function setLayer(id, enabled) {
    state[id] = enabled;
    const layer = options.layers.find((l) => l.id === id);
    layer?.apply(enabled);
  }

  for (const layer of options.layers) {
    setLayer(layer.id, state[layer.id] ?? layer.default !== false);
  }

  /** @type {HTMLElement | null} */
  let root = null;

  if (!parsed.hidden && typeof document !== 'undefined') {
    if (!document.getElementById('sounding-layer-panel-style')) {
      const style = document.createElement('style');
      style.id = 'sounding-layer-panel-style';
      style.textContent = PANEL_STYLE;
      document.head.appendChild(style);
    }

    root = document.createElement('aside');
    root.className = 'sounding-layer-panel';
    root.setAttribute('aria-label', 'Stage layers');

    const title = document.createElement('h2');
    title.textContent = 'Layers';
    root.appendChild(title);

    /** @param {LayerGroup} group @param {LayerDef[]} items */
    const addGroup = (group, items) => {
      if (!items.length) return;
      const field = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = group;
      field.appendChild(legend);
      for (const layer of items) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = state[layer.id] ?? true;
        input.dataset.layerId = layer.id;
        input.addEventListener('change', () => {
          setLayer(layer.id, input.checked);
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(layer.label));
        field.appendChild(label);
      }
      root.appendChild(field);
    };

    addGroup(
      'stage',
      options.layers.filter((l) => l.group === 'stage'),
    );
    addGroup(
      'ocean',
      options.layers.filter((l) => l.group === 'ocean'),
    );

    if (options.onShaderMode) {
      const field = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'shader';
      field.appendChild(legend);
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Shader debug mode');
      for (const mode of SHADER_MODES) {
        const opt = document.createElement('option');
        opt.value = mode.id;
        opt.textContent = mode.label;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        shaderMode = select.value;
        const mode = SHADER_MODES.find((m) => m.id === shaderMode) ?? SHADER_MODES[0];
        options.onShaderMode?.(mode.debugMode);
      });
      field.appendChild(select);
      root.appendChild(field);
    }

    document.body.appendChild(root);
  }

  return {
    hidden: parsed.hidden,
    state,
    shaderMode,
    /** @param {string} id */
    isEnabled(id) {
      return state[id] !== false;
    },
    /** @param {string} id @param {boolean} enabled */
    setLayer,
    /** @param {string} modeId */
    setShaderMode(modeId) {
      shaderMode = modeId;
      const mode = SHADER_MODES.find((m) => m.id === modeId) ?? SHADER_MODES[0];
      options.onShaderMode?.(mode.debugMode);
      if (root) {
        const select = root.querySelector('select');
        if (select) select.value = modeId;
      }
    },
    snapshot() {
      return { hidden: parsed.hidden, state: { ...state }, shaderMode };
    },
    dispose() {
      root?.remove();
      root = null;
    },
  };
}
