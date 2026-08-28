import * as THREE from "three";

const skyFunction = `
  vec3 skyRadiance(vec3 direction) {
    float vertical = smoothstep(-0.05, 0.4, direction.y);
    vec3 gradient = mix(horizonColor, zenithColor, vertical);
    float sunAlignment = max(dot(direction, sunDirection), 0.0);
    vec3 disc = sunColor * pow(sunAlignment, 1200.0) * 8.0;
    vec3 halo = sunColor * pow(sunAlignment, 7.0) * 0.35;
    return gradient + disc + halo;
  }
`;

/** Shared wave displacement (FFT scale + ambient swell + set-wave face). Used by ocean mesh + buoy probe. */
export const OCEAN_WAVE_DISPLACEMENT_GLSL = `
      uniform float setWaveActive;
      uniform float setWaveAmplitude;
      uniform float setWaveSteepness;
      uniform float setWaveK;
      uniform float setWaveWidth;
      uniform float setWaveBreakStyle;
      uniform float setWaveLipSkew;
      uniform float setWaveTubeMix;
      uniform float setWaveHorizMul;
      uniform float setWaveCrestAlong;
      uniform float setWaveBuoyAlong;
      uniform vec2 setWaveDirection;
      uniform int breakLineCount;
      uniform vec2 breakLinePts[8];
      uniform float cascadeScale;
      uniform float swellAmplitude;
      uniform float swellSteepness;
      uniform float swellK;
      uniform float swellOmega;
      uniform vec2 swellDirection;
      uniform float swell2Amplitude;
      uniform float swell2Steepness;
      uniform float swell2K;
      uniform float swell2Omega;
      uniform vec2 swell2Direction;
      // time is declared by the host vertex/fragment shader.

      vec3 gerstnerWave(vec2 xz, vec2 dir, float amp, float steep, float k, float omega, float t) {
        float phase = k * dot(xz, dir) - omega * t;
        float sinP = sin(phase);
        float cosP = cos(phase);
        return vec3(
          -dir.x * steep * amp * sinP,
          amp * cosP,
          -dir.y * steep * amp * sinP
        );
      }

      vec3 ambientSwell(vec2 xz) {
        return gerstnerWave(xz, swellDirection, swellAmplitude, swellSteepness, swellK, swellOmega, time)
          + gerstnerWave(xz, swell2Direction, swell2Amplitude, swell2Steepness, swell2K, swell2Omega, time);
      }

      float setWaveXiCurved(vec2 xz) {
        float sP = dot(xz, setWaveDirection);
        if (breakLineCount < 2) {
          return sP - setWaveCrestAlong;
        }
        vec2 bestQ = breakLinePts[0];
        float bestD = 1e9;
        for (int i = 0; i < 7; i++) {
          if (i >= breakLineCount - 1) {
            break;
          }
          vec2 a = breakLinePts[i];
          vec2 b = breakLinePts[i + 1];
          vec2 ab = b - a;
          float abLen2 = dot(ab, ab);
          if (abLen2 < 1e-6) {
            continue;
          }
          float t = clamp(dot(xz - a, ab) / abLen2, 0.0, 1.0);
          vec2 q = a + ab * t;
          float d = length(xz - q);
          if (d < bestD) {
            bestD = d;
            bestQ = q;
          }
        }
        float sQ = dot(bestQ, setWaveDirection);
        return sP - setWaveCrestAlong - (sQ - setWaveBuoyAlong);
      }

      vec3 setWaveDisplacement(vec2 xz) {
        vec3 total = ambientSwell(xz);
        if (setWaveActive < 0.01 || setWaveAmplitude < 0.01) {
          return total;
        }
        float xi = setWaveXiCurved(xz);
        float env = exp(-(xi * xi) / max(setWaveWidth * setWaveWidth, 1.0));
        float mixW = setWaveActive * env;
        float phase = setWaveK * xi;
        float sinP = sin(phase);
        float cosP = cos(phase);
        float amp = setWaveAmplitude * mixW;
        float phaseLip = phase + setWaveLipSkew * sinP;
        float tubeHollow = setWaveTubeMix * mixW * sin(phaseLip * 2.0 + 1.4);
        float horiz = setWaveHorizMul;
        total += vec3(
          -setWaveDirection.x * setWaveSteepness * amp * sinP * horiz,
          amp * cosP + tubeHollow,
          -setWaveDirection.y * setWaveSteepness * amp * sinP * horiz
        );
        return total;
      }

      vec3 setWaveFaceOnly(vec2 xz) {
        if (setWaveActive < 0.01 || setWaveAmplitude < 0.01) {
          return vec3(0.0);
        }
        float xi = setWaveXiCurved(xz);
        float env = exp(-(xi * xi) / max(setWaveWidth * setWaveWidth, 1.0));
        float mixW = setWaveActive * env;
        float phase = setWaveK * xi;
        float sinP = sin(phase);
        float cosP = cos(phase);
        float amp = setWaveAmplitude * mixW;
        float phaseLip = phase + setWaveLipSkew * sinP;
        float tubeHollow = setWaveTubeMix * mixW * sin(phaseLip * 2.0 + 1.4);
        float horiz = setWaveHorizMul;
        return vec3(
          -setWaveDirection.x * setWaveSteepness * amp * sinP * horiz,
          amp * cosP + tubeHollow,
          -setWaveDirection.y * setWaveSteepness * amp * sinP * horiz
        );
      }

      float setWaveLipJacobian(vec2 xz) {
        float eps = 3.0;
        vec3 d0 = setWaveFaceOnly(xz);
        vec3 dx = setWaveFaceOnly(xz + vec2(eps, 0.0)) - d0;
        vec3 dz = setWaveFaceOnly(xz + vec2(0.0, eps)) - d0;
        float jxx = 1.0 + dx.x / eps;
        float jzz = 1.0 + dz.z / eps;
        float jxz = 0.5 * (dx.z / eps + dz.x / eps);
        float j = jxx * jzz - jxz * jxz;
        return clamp(1.05 - j, 0.0, 1.0) * setWaveActive;
      }

      float setWaveTubeLipRing(vec2 xz) {
        if (setWaveBreakStyle < 1.5 || setWaveActive < 0.01) {
          return 0.0;
        }
        float xi = setWaveXiCurved(xz);
        float ring = abs(sin(setWaveK * xi * 2.0 + 1.4));
        return setWaveActive * setWaveTubeMix *
          smoothstep(0.25, 0.55, ring) * (1.0 - smoothstep(0.55, 0.75, ring));
      }
`;

export const OCEAN_DISPLACEMENT_UNIFORM_KEYS = [
  "setWaveActive",
  "setWaveAmplitude",
  "setWaveSteepness",
  "setWaveK",
  "setWaveWidth",
  "setWaveBreakStyle",
  "setWaveLipSkew",
  "setWaveTubeMix",
  "setWaveHorizMul",
  "setWaveCrestAlong",
  "setWaveBuoyAlong",
  "setWaveDirection",
  "breakLineCount",
  "breakLinePts",
  "cascadeScale",
  "swellAmplitude",
  "swellSteepness",
  "swellK",
  "swellOmega",
  "swellDirection",
  "swell2Amplitude",
  "swell2Steepness",
  "swell2K",
  "swell2Omega",
  "swell2Direction",
  "time",
];

/**
 * @param {Record<string, { value: unknown }>} target
 * @param {Record<string, { value: unknown }>} source
 */
export function syncOceanDisplacementUniforms(target, source) {
  for (const key of OCEAN_DISPLACEMENT_UNIFORM_KEYS) {
    const src = source[key];
    const dst = target[key];
    if (!src || !dst) continue;
    const value = src.value;
    if (key === "breakLinePts" && Array.isArray(value) && Array.isArray(dst.value)) {
      for (let i = 0; i < dst.value.length; i++) {
        if (value[i] && dst.value[i]?.copy) {
          dst.value[i].copy(value[i]);
        }
      }
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      "copy" in value &&
      typeof dst.value === "object" &&
      dst.value &&
      "copy" in dst.value
    ) {
      dst.value.copy(value);
    } else {
      dst.value = value;
    }
  }
}

export function createOceanMaterial(cascades, options) {
  const dem = options.dem ?? null;
  const uniforms = {
    displacement0: { value: cascades[0].displacement },
    displacement1: { value: cascades[1].displacement },
    displacement2: { value: cascades[2].displacement },
    derivatives0: { value: cascades[0].derivatives.texture },
    derivatives1: { value: cascades[1].derivatives.texture },
    derivatives2: { value: cascades[2].derivatives.texture },
    patchLengths: {
      value: new THREE.Vector3(...options.patchLengths),
    },
    sunDirection: { value: options.sunDirection },
    sunColor: { value: new THREE.Color(0xfff1dc) },
    horizonColor: { value: new THREE.Color(0x9fb8cc) },
    zenithColor: { value: new THREE.Color(0x2a5b9c) },
    deepColor: { value: new THREE.Color(0x071a26) },
    scatterColor: { value: new THREE.Color(0x2e8f8f) },
    foamColor: { value: new THREE.Color(0xdce7ea) },
    foamThreshold: { value: 0.4 },
    foamScale: { value: 2.5 },
    detailStrength: { value: 0.1 },
    detailTexture: { value: options.detailTexture },
    time: { value: 0 },
    fogColor: { value: new THREE.Color(0x9fb8cc) },
    fogDensity: { value: 0.0045 },
    debugMode: { value: 0 },
    // Set-wave overlay (Phase 4) — solitary Gerstner pulse on the cascade.
    setWaveActive: { value: 0 },
    setWaveAmplitude: { value: 0 },
    setWaveSteepness: { value: 0 },
    setWaveK: { value: 0.05 },
    setWaveWidth: { value: 80 },
    setWaveBreakStyle: { value: 0 },
    setWaveLipSkew: { value: 0 },
    setWaveTubeMix: { value: 0 },
    setWaveHorizMul: { value: 1 },
    setWaveCrestAlong: { value: 0 },
    setWaveBuoyAlong: { value: 0 },
    setWaveDirection: { value: new THREE.Vector2(1, 0) },
    breakLineCount: { value: 0 },
    breakLinePts: {
      value: Array.from({ length: 8 }, () => new THREE.Vector2()),
    },
    /** Scales FFT displacement (duck ambient chop while a set wave owns the shot). */
    cascadeScale: { value: 1 },
    // Always-on long Pacific swell (Gerstner) — the readable in-between sea.
    swellAmplitude: { value: 0.85 },
    swellSteepness: { value: 0.18 },
    swellK: { value: (Math.PI * 2) / 380 },
    swellOmega: { value: Math.sqrt(9.81 * ((Math.PI * 2) / 380)) },
    swellDirection: { value: new THREE.Vector2(1, 0) },
    swell2Amplitude: { value: 0.35 },
    swell2Steepness: { value: 0.14 },
    swell2K: { value: (Math.PI * 2) / 190 },
    swell2Omega: { value: Math.sqrt(9.81 * ((Math.PI * 2) / 190)) },
    swell2Direction: { value: new THREE.Vector2(0.98, 0.2) },
    demHeightMap: { value: dem?.texture ?? null },
    demParams: {
      value: new THREE.Vector3(
        dem?.halfSpan ?? 0,
        dem?.pixelM ?? 4,
        options.shorelineBias ?? 0.08,
      ),
    },
    demGrid: {
      value: new THREE.Vector2(
        (dem?.cols ?? 1) - 1,
        (dem?.rows ?? 1) - 1,
      ),
    },
    demClipEnabled: { value: dem ? 1 : 0 },
    shoreWash: { value: 0 },
    shoreCenter: {
      value: new THREE.Vector2(
        options.shoreCenter?.x ?? -100,
        options.shoreCenter?.z ?? 100,
      ),
    },
    shoreRadius: { value: options.shoreRadius ?? 130 },
  };

  const setWaveGerstnerGlsl = `
      ${OCEAN_WAVE_DISPLACEMENT_GLSL}

      vec3 setWaveNormalDelta(vec2 xz) {
        // Approximate slopes from primary set-wave face only (ambient is low-frequency).
        if (setWaveActive < 0.01 || setWaveAmplitude < 0.01) {
          return vec3(0.0);
        }
        float xi = setWaveXiCurved(xz);
        float width2 = max(setWaveWidth * setWaveWidth, 1.0);
        float env = exp(-(xi * xi) / width2);
        float mixW = setWaveActive * env;
        float phase = setWaveK * xi;
        float sinP = sin(phase);
        float cosP = cos(phase);
        float amp = setWaveAmplitude * mixW;
        float dEnv = env * (-2.0 * xi / width2);
        float dAmp = setWaveAmplitude * setWaveActive * dEnv;
        float dy_dAlong =
          dAmp * cosP - amp * setWaveK * sinP;
        float horizontal =
          -setWaveSteepness * setWaveHorizMul * (dAmp * sinP + amp * setWaveK * cosP);
        return vec3(
          setWaveDirection.x * dy_dAlong + setWaveDirection.x * horizontal * 0.25,
          0.0,
          setWaveDirection.y * dy_dAlong + setWaveDirection.y * horizontal * 0.25
        );
      }

      uniform sampler2D demHeightMap;
      uniform vec3 demParams;
      uniform vec2 demGrid;
      uniform float demClipEnabled;
      uniform float shoreWash;
      uniform vec2 shoreCenter;
      uniform float shoreRadius;

      float sampleDemHeight(vec2 xz) {
        float col = (xz.x + demParams.x) / demParams.y;
        float row = (demParams.x - xz.z) / demParams.y;
        vec2 uv = vec2(col / demGrid.x, row / demGrid.y);
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          return -1e6;
        }
        return texture(demHeightMap, uv).r;
      }

      float shoreWhitewashMask(vec2 xz, float waterY) {
        float dist = length(xz - shoreCenter);
        float zone = 1.0 - smoothstep(shoreRadius * 0.32, shoreRadius, dist);
        float terrainY = sampleDemHeight(xz);
        float margin = waterY - terrainY;
        float shallow = smoothstep(-0.5, 2.8, margin);
        return zone * shallow;
      }
  `;

  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: `
      precision highp float;
      uniform sampler2D displacement0;
      uniform sampler2D displacement1;
      uniform sampler2D displacement2;
      uniform vec3 patchLengths;
      uniform float time;
      out vec3 worldPositionVarying;
      out vec2 oceanPosition;
      out float setWaveHeightVarying;

      ${setWaveGerstnerGlsl}

      vec4 sampleDisplacement(sampler2D map, vec2 xz, float lengthScale) {
        return texture(map, fract(xz / lengthScale));
      }

      void main() {
        oceanPosition = position.xz;
        vec3 displacement =
          (sampleDisplacement(displacement0, oceanPosition, patchLengths.x).xyz +
          sampleDisplacement(displacement1, oceanPosition, patchLengths.y).xyz +
          sampleDisplacement(displacement2, oceanPosition, patchLengths.z).xyz) *
          cascadeScale;
        vec3 gerstner = setWaveDisplacement(oceanPosition);
        // setWaveDisplacement includes ambient swell; isolate crest height for foam.
        vec3 ambient = ambientSwell(oceanPosition);
        setWaveHeightVarying = max(0.0, gerstner.y - ambient.y);
        vec3 displaced = position + displacement + gerstner;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        worldPositionVarying = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D displacement0;
      uniform sampler2D displacement1;
      uniform sampler2D displacement2;
      uniform sampler2D derivatives0;
      uniform sampler2D derivatives1;
      uniform sampler2D derivatives2;
      uniform vec3 patchLengths;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform vec3 horizonColor;
      uniform vec3 zenithColor;
      uniform vec3 deepColor;
      uniform vec3 scatterColor;
      uniform vec3 foamColor;
      uniform vec3 fogColor;
      uniform float foamThreshold;
      uniform float foamScale;
      uniform float detailStrength;
      uniform sampler2D detailTexture;
      uniform float time;
      uniform float fogDensity;
      uniform int debugMode;
      in vec3 worldPositionVarying;
      in vec2 oceanPosition;
      in float setWaveHeightVarying;
      out vec4 outputColor;

      ${skyFunction}
      ${setWaveGerstnerGlsl}

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 456.21));
        point += dot(point, point + 45.32);
        return fract(point.x * point.y);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(hash21(cell), hash21(cell + vec2(1, 0)), local.x),
          mix(hash21(cell + vec2(0, 1)), hash21(cell + 1.0), local.x),
          local.y
        );
      }

      vec4 sampleDerivatives(sampler2D map, vec2 xz, float lengthScale) {
        return texture(map, fract(xz / lengthScale));
      }

      vec4 sampleDisplacement(sampler2D map, vec2 xz, float lengthScale) {
        return texture(map, fract(xz / lengthScale));
      }

      void main() {
        if (demClipEnabled > 0.5) {
          float terrainY = sampleDemHeight(oceanPosition);
          if (terrainY > worldPositionVarying.y - demParams.z) {
            discard;
          }
        }

        vec4 derivative =
          (sampleDerivatives(derivatives0, oceanPosition, patchLengths.x) +
          sampleDerivatives(derivatives1, oceanPosition, patchLengths.y) +
          sampleDerivatives(derivatives2, oceanPosition, patchLengths.z)) *
          cascadeScale;
        float denominatorX = max(0.18, 1.0 + derivative.z);
        float denominatorZ = max(0.18, 1.0 + derivative.w);
        vec3 normal = normalize(vec3(
          -derivative.x / denominatorX,
          1.0,
          -derivative.y / denominatorZ
        ));
        vec3 setWaveDelta = setWaveNormalDelta(oceanPosition);
        normal = normalize(normal - vec3(setWaveDelta.x, 0.0, setWaveDelta.z) * 0.55);

        vec2 detailA = texture(
          detailTexture,
          oceanPosition * 0.06 + vec2(time * 0.012, time * 0.008)
        ).rg * 2.0 - 1.0;
        vec2 detailB = texture(
          detailTexture,
          oceanPosition * 0.17 + vec2(-time * 0.02, time * 0.015)
        ).rg * 2.0 - 1.0;
        vec2 detailNormal = detailA + detailB * 0.5;
        normal = normalize(
          normal +
          vec3(detailNormal.x, 0.0, detailNormal.y) * detailStrength
        );

        vec4 displacementA =
          sampleDisplacement(displacement0, oceanPosition, patchLengths.x);
        vec4 displacementB =
          sampleDisplacement(displacement1, oceanPosition, patchLengths.y);
        vec4 displacementC =
          sampleDisplacement(displacement2, oceanPosition, patchLengths.z);

        float foamRaw =
          clamp((foamThreshold - displacementA.a) * foamScale, 0.0, 1.0) +
          clamp((foamThreshold - displacementB.a) * foamScale, 0.0, 1.0);
        float cascadeFoam = foamRaw;
        float lipJacobian = setWaveLipJacobian(oceanPosition);
        float lipFoam =
          lipJacobian *
          smoothstep(2.0, 11.0, setWaveHeightVarying) *
          0.92;
        float tubeLip = setWaveTubeLipRing(oceanPosition) * lipJacobian * 1.35;
        float setWaveFoam =
          smoothstep(4.0, 12.0, setWaveHeightVarying) * setWaveActive * 0.35;
        float shoreFoam =
          shoreWash * shoreWhitewashMask(oceanPosition, worldPositionVarying.y) * 0.82;
        float foamCoverage = smoothstep(
          0.12,
          0.88,
          cascadeFoam + lipFoam + tubeLip + setWaveFoam + shoreFoam
        );

        if (debugMode == 1) {
          vec3 bands =
            vec3(abs(displacementA.y), abs(displacementB.y), abs(displacementC.y));
          outputColor = vec4(
            pow(clamp(bands * vec3(0.16, 0.7, 1.4), 0.0, 1.0), vec3(0.55)),
            1.0
          );
          return;
        }
        if (debugMode == 2) {
          outputColor = vec4(normal * 0.5 + 0.5, 1.0);
          return;
        }
        if (debugMode == 3) {
          float history = min(displacementA.a, displacementB.a);
          outputColor = vec4(
            mix(vec3(0.95, 0.2, 0.06), vec3(0.04, 0.12, 0.18), clamp(history, 0.0, 1.0)),
            1.0
          );
          return;
        }
        if (debugMode == 4) {
          float terrainY = sampleDemHeight(oceanPosition);
          float margin = worldPositionVarying.y - demParams.z - terrainY;
          outputColor = vec4(
            margin > 0.0 ? vec3(0.08, 0.45, 0.95) : vec3(0.95, 0.18, 0.08),
            1.0
          );
          return;
        }
        if (debugMode == 5) {
          float lipJ = setWaveLipJacobian(oceanPosition);
          float tubeRing = setWaveTubeLipRing(oceanPosition);
          outputColor = vec4(
            mix(vec3(0.04, 0.12, 0.2), vec3(0.95, 0.98, 1.0), clamp(lipJ + tubeRing, 0.0, 1.0)),
            1.0
          );
          return;
        }
        if (debugMode == 6) {
          float shoreMask = shoreWhitewashMask(oceanPosition, worldPositionVarying.y);
          outputColor = vec4(
            mix(vec3(0.04, 0.12, 0.2), vec3(0.95, 0.98, 1.0), clamp(shoreWash * shoreMask, 0.0, 1.0)),
            1.0
          );
          return;
        }

        vec3 viewDirection = normalize(cameraPosition - worldPositionVarying);
        float noV = max(dot(normal, viewDirection), 0.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - noV, 5.0);
        vec3 reflectedDirection = reflect(-viewDirection, normal);
        reflectedDirection.y = max(abs(reflectedDirection.y), 0.02);
        vec3 reflection = skyRadiance(normalize(reflectedDirection));

        float crest = clamp(worldPositionVarying.y * 0.5 + 0.4, 0.0, 1.0);
        vec3 halfVector = normalize(-normal + sunDirection);
        float scatter =
          pow(clamp(dot(viewDirection, -halfVector), 0.0, 1.0), 4.0) *
          crest;
        vec3 body = mix(
          deepColor,
          scatterColor,
          clamp(0.12 + scatter, 0.0, 1.0)
        );
        vec3 water = mix(body, reflection, fresnel);

        float bubbleA = texture(
          detailTexture,
          oceanPosition * 0.45 + vec2(time * 0.03, time * 0.02)
        ).b;
        float bubbleB = texture(
          detailTexture,
          oceanPosition * 1.6 + vec2(-time * 0.05, time * 0.04)
        ).a;
        float bubble = clamp(
          bubbleA * 0.7 + bubbleB * 0.5 + 0.2,
          0.0,
          1.0
        );
        float foamLight =
          0.55 +
          0.6 * clamp(dot(normal, sunDirection), 0.0, 1.0);
        vec3 shadedFoam = foamColor * bubble * foamLight;
        vec3 color = mix(water, shadedFoam, foamCoverage);

        float distanceToCamera = length(cameraPosition - worldPositionVarying);
        float fog = 1.0 - exp(-fogDensity * fogDensity * distanceToCamera * distanceToCamera);
        color = mix(color, fogColor, clamp(fog, 0.0, 1.0));
        outputColor = vec4(color, 1.0);
      }
    `,
  });

  return material;
}

export function updateOceanMaterialTextures(material, cascades) {
  material.uniforms.displacement0.value = cascades[0].displacement;
  material.uniforms.displacement1.value = cascades[1].displacement;
  material.uniforms.displacement2.value = cascades[2].displacement;
}

export function createSkyMaterial(options) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      sunDirection: { value: options.sunDirection },
      sunColor: { value: new THREE.Color(0xfff1dc) },
      horizonColor: { value: new THREE.Color(0x9fb8cc) },
      zenithColor: { value: new THREE.Color(0x2a5b9c) },
    },
    vertexShader: `
      out vec3 directionVarying;
      void main() {
        directionVarying = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 sunDirection;
      uniform vec3 sunColor;
      uniform vec3 horizonColor;
      uniform vec3 zenithColor;
      in vec3 directionVarying;
      out vec4 outputColor;
      ${skyFunction}
      void main() {
        outputColor = vec4(skyRadiance(normalize(directionVarying)), 1.0);
      }
    `,
  });
}

export function createSpectrumDebugMaterial(texture) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      spectrumTexture: { value: texture },
    },
    vertexShader: `
      out vec2 uvVarying;
      void main() {
        uvVarying = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D spectrumTexture;
      in vec2 uvVarying;
      out vec4 outputColor;
      void main() {
        vec2 complexValue = texture(spectrumTexture, uvVarying).xy;
        float magnitude = length(complexValue);
        float value = clamp(log(1.0 + magnitude * 1200.0) * 0.18, 0.0, 1.0);
        vec3 low = vec3(0.015, 0.035, 0.06);
        vec3 high = vec3(0.18, 0.78, 1.0);
        outputColor = vec4(mix(low, high, value), 1.0);
      }
    `,
  });
}
