import {
  BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
} from "../vendor/three/three.module.min.js";
import { renderReveal } from "../visual/reveal.js";
import {
  cameraMatrices, cellRect, createFrame, fillTriangles, gridLines, ringTriangles, unroll,
} from "./geo.js";
import { overlayModel, sanitizeOutcomes } from "./overlay.js";

const FLY_SECONDS = 2.6;
const SHOWN_PHASES = new Set(["listen", "decode", "reveal"]);
const LIFT = 0.004;

// Selection and playhead colours carry no data. Outcome colours also come with a glyph, so colour is never
// the only channel. No amber: nothing here may look like dust over the challenge region.
const STYLE = {
  grid: 0xdfeaf2,
  active: 0xfff1c9,
  selected: 0x9fd8ff,
  correct: 0x2dd4bf,
  incorrect: 0xff4d8d,
  missed: 0xd9dcff,
};
const GLYPHS = { correct: "✓", incorrect: "×", missed: "–" };

const vertexShader = /* glsl */ `
  uniform float uT;
  uniform vec3 uNormal;
  uniform vec3 uEast;
  uniform vec3 uNorth;
  uniform vec2 uCenter;
  attribute vec2 aLonLat;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    float lon = radians(aLonLat.x);
    float lat = radians(aLonLat.y);
    vec3 onSphere = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
    vec3 onPlane = uNormal + uEast * radians(aLonLat.x - uCenter.x) + uNorth * radians(aLonLat.y - uCenter.y);
    vUv = vec2((aLonLat.x + 180.0) / 360.0, (aLonLat.y + 90.0) / 180.0);
    // Limb darkening depends only on the view, so it is identical for every case.
    vShade = mix(0.72 + 0.28 * dot(onSphere, normalize(cameraPosition)), 1.0, uT);
    gl_Position = projectionMatrix * viewMatrix * vec4(mix(onSphere, onPlane, uT), 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  varying vec2 vUv;
  varying float vShade;
  void main() {
    vec3 base = mix(vec3(0.02, 0.05, 0.1), texture2D(uMap, vUv).rgb, uHasMap);
    gl_FragColor = vec4(base * vShade, 1.0);
    #include <colorspace_fragment>
  }
`;

// WebGLRenderer throws when no context can be created, which is how a missing WebGL is detected.
const defaultRenderer = (document) => {
  const canvas = document.createElement("canvas");
  return new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "default" });
};

function defaultTextureUrl(window) {
  const small = window.matchMedia?.("(max-width: 700px)")?.matches ||
    window.navigator?.connection?.saveData === true || (window.navigator?.deviceMemory ?? 8) <= 2;
  return new URL(small ? "../assets/earth/blue-marble-2048.jpg" : "../assets/earth/blue-marble-4096.jpg", import.meta.url).href;
}

function earthGeometry(columns = 180, rows = 90) {
  const lonLat = [];
  const index = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) lonLat.push(-180 + (360 * i) / columns, 90 - (180 * j) / rows);
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      const b = a + 1;
      const c = a + columns + 1;
      index.push(a, c, b, b, c, c + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("aLonLat", new BufferAttribute(new Float32Array(lonLat), 2));
  // The vertex shader positions everything; this only keeps three.js from complaining.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array((columns + 1) * (rows + 1) * 3), 3));
  geometry.setIndex(index);
  return geometry;
}

function glyphTexture(document, symbol, color) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#" + color.toString(16).padStart(6, "0");
  context.font = "700 96px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(0, 0, 0, 0.7)";
  context.shadowBlur = 8;
  context.fillText(symbol, 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Builds a MountDecodeVisual. The returned mount draws a WebGL globe that unrolls onto the challenge
 * region, registered to the interactive grid. Without WebGL (or after context loss) it mounts `fallback`,
 * the flat SVG visual, so the page keeps working.
 */
export function createGlobeMount({
  fallback,
  hasWebGL = () => true,
  createRenderer = defaultRenderer,
  textureUrl = defaultTextureUrl,
  reducedMotion = (window) => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true,
} = {}) {
  if (typeof fallback !== "function") throw new TypeError("createGlobeMount needs a fallback visual mount.");

  return function mountGlobeVisual(root, session, options = {}) {
    const document = root.ownerDocument;
    const window = document.defaultView;
    const stage = root.parentElement;

    const useFallback = () => {
      if (stage?.dataset) stage.dataset.renderer = "svg";
      return fallback(root, session, options);
    };

    let renderer;
    try {
      if (!hasWebGL(document)) return useFallback();
      renderer = createRenderer(document);
    } catch {
      return useFallback();
    }

    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    root.append(canvas);
    if (stage?.dataset) stage.dataset.renderer = "webgl";

    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.matrixAutoUpdate = false;
    camera.matrixWorldAutoUpdate = false;
    renderer.setClearColor(0x000000, 0);

    const earth = new Mesh(earthGeometry(), new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uT: { value: 0 }, uHasMap: { value: 0 }, uMap: { value: null }, uCenter: { value: new Vector2() },
        uNormal: { value: null }, uEast: { value: null }, uNorth: { value: null },
      },
    }));
    earth.frustumCulled = false;
    scene.add(earth);
    new TextureLoader().load(textureUrl(window), (texture) => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      earth.material.uniforms.uMap.value = texture;
      earth.material.uniforms.uHasMap.value = 1;
      requestRender();
    }, undefined, () => { /* the dark sphere remains; the grid and marks still work */ });

    const decal = (color, opacity) => new MeshBasicMaterial({
      color, opacity, transparent: true, depthWrite: false, side: DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const materials = {
      grid: new LineBasicMaterial({ color: STYLE.grid, transparent: true, opacity: 0.55, depthWrite: false }),
      active: decal(STYLE.active, 1),
      selectedFill: decal(STYLE.selected, 0.14),
      selectedRing: decal(STYLE.selected, 0.95),
      correct: decal(STYLE.correct, 0.5),
      incorrect: decal(STYLE.incorrect, 0.5),
      missed: decal(STYLE.missed, 0.22),
      missedRing: decal(STYLE.missed, 0.9),
    };
    const glyphMaterials = Object.fromEntries(Object.entries(GLYPHS).map(([outcome, symbol]) => [
      outcome, new MeshBasicMaterial({
        map: glyphTexture(document, symbol, 0xffffff), transparent: true, depthWrite: false, side: DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      }),
    ]));

    const layers = new Map();
    function setLayer(name, object) {
      const previous = layers.get(name);
      if (previous) { scene.remove(previous); previous.geometry.dispose(); }
      if (object) { scene.add(object); layers.set(name, object); } else layers.delete(name);
    }
    const mesh = (positions, material, uvs, order = 1) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      if (uvs) geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
      const object = new Mesh(geometry, material);
      object.frustumCulled = false;
      object.renderOrder = order;
      return object;
    };

    // The shared map key says teal cells reached the threshold, which would contradict outcome colours here,
    // so the globe supplies its own key (glyph plus the same translated label the evidence list uses).
    const key = document.createElement("p");
    key.className = "cinematic-key";
    key.hidden = true;
    key.setAttribute("aria-hidden", "true");
    const keyParts = [["correct", "reveal.selection.correct"], ["incorrect", "reveal.selection.false"], ["missed", "reveal.selection.missed"]];
    for (const [outcome, messageKey] of keyParts) {
      const item = document.createElement("span");
      item.className = "cinematic-key-" + outcome;
      item.textContent = GLYPHS[outcome] + " " + String(options.t?.(messageKey) ?? "").replace(/\.$/, "");
      key.append(item);
    }
    stage?.closest("#decode-map")?.querySelector(".decode-map-bottom")?.append(key);

    let frame = null;
    let snapshot = session.getState();
    let model = overlayModel(snapshot);
    let revealOutcomes = [];
    let pendingReveal;
    let progress = 0;
    let target = 0;
    let builtUnroll = -1;
    let overlaysDirty = true;
    let frameRequest = 0;
    let flightFrom = 0;
    let flightStart = 0;
    let flightTarget = 0;
    let disposed = false;
    let width = 0;
    let height = 0;

    const reduced = () => reducedMotion(window);

    function geographyFor(next) {
      const geography = options.geography;
      return geography && geography.caseId === next.caseId ? geography : null;
    }

    function useFrame(geography) {
      const next = geography ? createFrame(geography.bounds) : null;
      if (next?.lon0 === frame?.lon0 && next?.lat0 === frame?.lat0 && next?.lonSpan === frame?.lonSpan &&
          next?.latSpan === frame?.latSpan) return;
      frame = next;
      overlaysDirty = true;
      if (!frame) return;
      const { uniforms } = earth.material;
      uniforms.uNormal.value = frame.normal;
      uniforms.uEast.value = frame.east;
      uniforms.uNorth.value = frame.north;
      uniforms.uCenter.value.set(frame.lon0, frame.lat0);
      stage?.style.setProperty("--earth-ratio", String(frame.latSpan / frame.lonSpan));
    }

    function rebuildOverlays(t) {
      for (const name of [...layers.keys()]) setLayer(name, null);
      if (!frame || !model.rows || !model.cols) return;
      const rect = ([row, col]) => cellRect(frame.bounds, model.rows, model.cols, row, col);
      setLayer("grid", Object.assign(
        new LineSegments(new BufferGeometry().setAttribute("position",
          new BufferAttribute(gridLines(frame, model.rows, model.cols, { t, lift: LIFT }), 3)), materials.grid),
        { frustumCulled: false, renderOrder: 1 }));

      if (model.selected.length) {
        const rects = model.selected.map(rect);
        setLayer("selectedFill", mesh(fillTriangles(frame, rects, { t, lift: LIFT * 1.5 }).positions, materials.selectedFill, null, 2));
        setLayer("selectedRing", mesh(ringTriangles(frame, rects, { t, lift: LIFT * 2, insetDeg: 1.2, thicknessDeg: 0.45 }), materials.selectedRing, null, 3));
      }
      for (const outcome of ["correct", "incorrect", "missed"]) {
        const rects = model.outcomes.filter((entry) => entry.outcome === outcome).map(({ row, col }) => rect([row, col]));
        if (!rects.length) continue;
        setLayer(outcome, mesh(fillTriangles(frame, rects, { t, lift: LIFT * 2.5 }).positions, materials[outcome], null, 4));
        if (outcome === "missed") {
          setLayer("missedRing", mesh(ringTriangles(frame, rects, { t, lift: LIFT * 3, insetDeg: 0.8, thicknessDeg: 0.3 }), materials.missedRing, null, 5));
        }
        const glyph = fillTriangles(frame, rects.map((r) => ({
          west: (r.west + r.east) / 2 - (r.east - r.west) * 0.2, east: (r.west + r.east) / 2 + (r.east - r.west) * 0.2,
          north: (r.north + r.south) / 2 + (r.north - r.south) * 0.2, south: (r.north + r.south) / 2 - (r.north - r.south) * 0.2,
        })), { t, lift: LIFT * 3.5, subdiv: 1 });
        setLayer(outcome + "Glyph", mesh(glyph.positions, glyphMaterials[outcome], glyph.uvs, 6));
      }
      if (model.active) {
        setLayer("active", mesh(ringTriangles(frame, [rect(model.active)], { t, lift: LIFT * 4, insetDeg: 0.35, thicknessDeg: 0.55 }), materials.active, null, 7));
      }
    }

    function draw() {
      frameRequest = 0;
      if (disposed || !width || !height) return;
      if (progress !== target) {
        // Wall-clock progress: the fly-to lasts FLY_SECONDS even when frames are slow.
        if (flightTarget !== target) {
          flightTarget = target;
          flightFrom = progress;
          flightStart = performance.now();
        }
        const done = Math.min(1, (performance.now() - flightStart) / 1000 / FLY_SECONDS);
        progress = reduced() || done >= 1 ? target : flightFrom + (target - flightFrom) * done;
      }
      const t = unroll(progress);
      if (frame) {
        if (overlaysDirty || t !== builtUnroll) {
          rebuildOverlays(t);
          builtUnroll = t;
          overlaysDirty = false;
        }
        const { view, world, projection } = cameraMatrices(frame, progress, width / height);
        camera.matrixWorld.copy(world);
        camera.matrixWorldInverse.copy(view);
        camera.projectionMatrix.copy(projection);
        camera.projectionMatrixInverse.copy(projection).invert();
        earth.material.uniforms.uT.value = t;
        earth.visible = true;
        renderer.render(scene, camera);
      } else {
        renderer.clear();
      }
      if (progress !== target) frameRequest = window.requestAnimationFrame(draw);
    }

    function requestRender() {
      if (!frameRequest && !disposed) frameRequest = window.requestAnimationFrame(draw);
    }

    function resize() {
      const w = Math.round(root.clientWidth);
      const h = Math.round(root.clientHeight);
      if (w === width && h === height) return;
      width = w;
      height = h;
      if (width && height) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        canvas.style.cssText = "display:block;width:100%;height:100%";
      }
      requestRender();
    }
    const observer = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(resize) : null;
    observer?.observe(root);
    resize();

    function clearReveal() {
      pendingReveal = undefined;
      key.hidden = true;
      if (revealOutcomes.length) {
        revealOutcomes = [];
        model = overlayModel(snapshot);
        overlaysDirty = true;
        requestRender();
      }
      mountedLabels?.remove();
      mountedLabels = undefined;
    }
    let mountedLabels;

    function prepareReveal() {
      if (disposed || snapshot.phase !== "reveal") return null;
      clearReveal();
      const apply = (outcomes, evidenceRoot, formatLabel) => {
        if (pendingReveal !== apply) return false;
        if (!evidenceRoot || evidenceRoot.closest("[inert], [aria-hidden='true']") || root.contains(evidenceRoot)) {
          pendingReveal = undefined;
          return false;
        }
        const { rows, cols } = snapshot.grid;
        const clean = sanitizeOutcomes(outcomes, rows, cols);
        pendingReveal = undefined;
        if (!clean.length) return false;
        // The labelled list is the accessible form of the same outcomes; the 3D tint is decoration.
        const { labels } = renderReveal(document, { phase: "reveal", outcomes: clean }, formatLabel, { rows, cols });
        if (!labels.childElementCount) return false;
        evidenceRoot.append(labels);
        mountedLabels = labels;
        revealOutcomes = clean;
        key.hidden = false;
        model = overlayModel(snapshot, revealOutcomes);
        overlaysDirty = true;
        requestRender();
        return true;
      };
      pendingReveal = apply;
      return apply;
    }

    function render(next) {
      if (disposed) return;
      const gridChanged = next.caseId !== snapshot.caseId || next.level !== snapshot.level ||
        next.grid.rows !== snapshot.grid.rows || next.grid.cols !== snapshot.grid.cols;
      if (gridChanged || next.phase !== "reveal") {
        pendingReveal = undefined;
        if (revealOutcomes.length) revealOutcomes = [];
        mountedLabels?.remove();
        mountedLabels = undefined;
      }
      snapshot = next;
      key.hidden = !(next.phase === "reveal" && revealOutcomes.length);
      useFrame(geographyFor(next));
      const previousKey = JSON.stringify(model);
      model = overlayModel(next, revealOutcomes);
      // Transport snapshots arrive every frame during playback; only redraw when something visible changed.
      if (JSON.stringify(model) !== previousKey) overlaysDirty = true;
      const shown = SHOWN_PHASES.has(next.phase) && Boolean(frame);
      target = shown ? 1 : 0;
      if (!shown && !root.clientWidth) progress = 0;
      requestRender();
    }

    function swapToFallback() {
      if (disposed) return;
      teardown();
      impl = useFallback();
    }
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      swapToFallback();
    });

    function teardown() {
      disposed = true;
      if (frameRequest) window.cancelAnimationFrame(frameRequest);
      observer?.disconnect();
      unsubscribe();
      clearRevealQuiet();
      for (const name of [...layers.keys()]) setLayer(name, null);
      earth.geometry.dispose();
      earth.material.uniforms.uMap.value?.dispose();
      earth.material.dispose();
      for (const material of Object.values(materials)) material.dispose();
      for (const material of Object.values(glyphMaterials)) { material.map.dispose(); material.dispose(); }
      renderer.dispose();
      canvas.remove();
      key.remove();
      stage?.style.removeProperty("--earth-ratio");
      if (stage?.dataset) delete stage.dataset.renderer;
    }
    function clearRevealQuiet() {
      pendingReveal = undefined;
      mountedLabels?.remove();
      mountedLabels = undefined;
      revealOutcomes = [];
    }

    const unsubscribe = session.subscribe(render);

    let impl = {
      prepareReveal,
      clearReveal,
      dispose() {
        if (!disposed) teardown();
      },
    };
    return {
      prepareReveal: () => impl.prepareReveal?.() ?? null,
      clearReveal: () => impl.clearReveal?.(),
      dispose: () => impl.dispose?.(),
    };
  };
}
