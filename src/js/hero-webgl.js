import gsap from "gsap";

/**
 * Hero background: raw WebGL (no three.js), one full-screen triangle + a fragment shader.
 * A cartoon title-card fan of 14 rays (one per CRASH track) out of the orange sun behind the toaster,
 * with CRASH's red-orange stage light. Renders ON DEMAND: once per resize / origin change, during the
 * entrance fan-out, and every frame only while music plays (toaster.js drives frame()). Idle = 0 GPU work.
 */

const VERT = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uOrigin;   // sun centre, canvas px (GL: y runs up)
uniform float uScale;   // sun radius, canvas px
uniform float uTime;
uniform float uBass;
uniform float uEnergy;
uniform float uHigh;
uniform float uActive;  // ray lit for the current CRASH track (0..13), -1 for none
uniform float uFan;     // 0..1, the entrance sweep

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float RAYS = 14.0;
const float MARGIN = 0.2; // the fan dips ~11deg under each horizon

const vec3 VOID_C = vec3(0.043, 0.043, 0.129);
const vec3 MIDNIGHT = vec3(0.039, 0.016, 0.208);
const vec3 ROYAL = vec3(0.016, 0.090, 0.357);
const vec3 BLUE = vec3(0.063, 0.216, 0.518);
const vec3 GOLD = vec3(0.949, 0.718, 0.020);
const vec3 ORANGE = vec3(0.949, 0.416, 0.122);
const vec3 RED = vec3(1.0, 0.063, 0.133);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 o = (gl_FragCoord.xy - uOrigin) / uScale; // 1.0 = one sun radius
  float r = length(o);
  float a = atan(o.y, o.x);                      // 0 = right, PI/2 = up
  if (a < -0.5 * PI) a += TAU;                   // lower-left quadrant continues past the left horizon
  float span = PI + 2.0 * MARGIN;
  float u = (PI + MARGIN - a) / span;            // 0 = left horizon → 1 = right, clockwise over the top
  float s = u * RAYS;
  float seg = floor(s);
  float f = fract(s);
  float px = RAYS / (span * max(r * uScale, 1.0)); // one pixel, in ray units: crisp flat wedges
  float fan = step(0.0, u) * step(u, 1.0);
  float ray = smoothstep(0.0, px, f) * (1.0 - smoothstep(0.5 - px, 0.5, f)) * fan;

  float edge = uFan * 3.4 + uBass * 0.45;        // rays sweep out on entrance, reach further on kicks
  float reach = 1.0 - smoothstep(edge - 0.6, edge, r);
  float fade = 1.0 - smoothstep(2.6, 4.4, r);

  vec3 warm = mix(RED, ORANGE, 0.6);
  vec3 col = mix(MIDNIGHT, VOID_C, smoothstep(0.8, 3.6, r));
  col = mix(col, warm, (1.0 - smoothstep(0.9, 2.3, r)) * (0.34 + uEnergy * 0.22) * uFan); // stage light

  vec3 rayC = mix(mix(warm, ORANGE, 0.4), mix(ROYAL, BLUE, uBass), smoothstep(1.1, 2.8, r));
  col = mix(col, rayC, ray * reach * fade * (0.3 + uEnergy * 0.16 + uBass * 0.12));

  // fades out before it reaches the copy on the left
  float lit = (1.0 - step(0.5, abs(seg - uActive))) * ray * reach * (1.0 - smoothstep(1.2, 2.7, r));
  col = mix(col, GOLD, lit * (0.26 + uEnergy * 0.34));

  // Embers rise only while music plays
  float live = smoothstep(0.02, 0.2, uEnergy);
  vec2 g = (gl_FragCoord.xy / uScale + vec2(0.0, -uTime * 0.05)) * 16.0;
  vec2 id = floor(g);
  vec2 q = fract(g) - 0.5 - (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5) * 0.5;
  float h = hash(id);
  float size = 0.035 + hash(id + 3.7) * 0.06;
  float tw = 0.45 + 0.55 * sin(uTime * (2.0 + h * 3.0) + h * 40.0);
  float spark = step(0.93 - uHigh * 0.05, h) * smoothstep(size, size * 0.2, length(q)) * tw;
  col += mix(GOLD, ORANGE, h) * spark * (0.7 + uHigh) * live * fan;

  gl_FragColor = vec4(col, 1.0);
}
`;

const noop = {
  ok: false,
  freeze() {},
  setOrigin() {},
  setActive() {},
  frame() {},
  fan() {},
  setLite() {},
  pause() {},
  resume() {},
  destroy() {},
};

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
  }
  return s;
}

export function initHeroWebGL(canvas, { reducedMotion = false } = {}) {
  if (reducedMotion || !canvas) return noop;

  let gl;
  let program;
  let buffer;
  try {
    // failIfMajorPerformanceCaveat: software-only GL (SwiftShader, llvmpipe, no GPU) gets the static CSS fan instead
    gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return noop;
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn("[hero] WebGL unavailable, using CSS fallback", err);
    return noop;
  }

  gl.useProgram(program);
  buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One oversized triangle covers the viewport — no seam down the diagonal
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = Object.fromEntries(
    ["uOrigin", "uScale", "uTime", "uBass", "uEnergy", "uHigh", "uActive", "uFan"].map((n) => [n, gl.getUniformLocation(program, n)])
  );

  // Flat rays don't need retina: 1.5× max, 1× on ≤4-core machines, 0.6× (and 30fps) once the governor trips
  let dpr = Math.min(window.devicePixelRatio || 1, (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 1.5);
  const origin = { x: canvas.clientWidth * 0.72, y: canvas.clientHeight * 0.58, r: 200 };
  const p = {
    time: 0,
    bass: 0,
    energy: 0,
    high: 0,
    active: -1,
    // folded away until the entrance sweeps it open (only when an entrance is coming)
    fan: document.documentElement.classList.contains("hero-pending") ? 0 : 1,
  };
  let visible = true;
  let lost = false;
  let fanTween = null;
  let lite = false;
  let skip = false;
  let frozen = false;

  function draw() {
    if (!visible || lost || !canvas.width) return;
    gl.uniform2f(u.uOrigin, origin.x * dpr, canvas.height - origin.y * dpr);
    gl.uniform1f(u.uScale, Math.max(1, origin.r * dpr));
    gl.uniform1f(u.uTime, p.time);
    gl.uniform1f(u.uBass, p.bass);
    gl.uniform1f(u.uEnergy, p.energy);
    gl.uniform1f(u.uHigh, p.high);
    gl.uniform1f(u.uActive, p.active);
    gl.uniform1f(u.uFan, p.fan);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    canvas.closest(".hero")?.classList.add("reduced-motion"); // the CSS fan takes over
  });
  resize();

  const api = {
    ok: true,
    /** Sun centre + radius in CSS px, relative to the canvas */
    setOrigin(x, y, r) {
      origin.x = x;
      origin.y = y;
      origin.r = r;
      draw();
    },
    setActive(n) {
      if (p.active === n) return;
      p.active = n;
      draw();
    },
    /** One audio frame from signal.js */
    frame(s, dtMs) {
      p.time += dtMs / 1000;
      p.bass = s.bass;
      p.energy = s.energy;
      p.high = s.high;
      if (frozen || (lite && (skip = !skip))) return; // lite: 30fps rays · frozen: rays stay still
      draw();
    },
    fan(duration = 1.1) {
      fanTween?.kill();
      fanTween = gsap.fromTo(p, { fan: 0 }, { fan: 1, duration, ease: "power3.out", onUpdate: draw });
    },
    setLite() {
      lite = true;
      dpr = Math.min(dpr, 0.6);
      resize();
    },
    /** The GPU can't keep up at all: stop drawing per frame (rays stay as they are, everything else keeps moving) */
    freeze() {
      frozen = true;
    },
    pause() {
      visible = false;
    },
    resume() {
      if (visible) return;
      visible = true;
      draw();
    },
    destroy() {
      ro.disconnect();
      fanTween?.kill();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };

  // If the entrance never comes (a JS error later in boot), don't leave the rays folded away
  if (p.fan === 0) setTimeout(() => p.fan === 0 && !fanTween && api.fan(0.6), 4000);
  return api;
}
