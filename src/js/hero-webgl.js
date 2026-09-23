import * as THREE from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uPointer;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  vec2 mouse = (uPointer - 0.5) * 0.35;

  float t = uTime * 0.12;
  float n = noise(p * 2.4 + t + mouse);
  float n2 = noise(p * 5.0 - t * 1.3);
  float field = smoothstep(0.2, 0.85, n * 0.7 + n2 * 0.35);

  vec3 voidC = vec3(0.043, 0.043, 0.129);
  vec3 midnight = vec3(0.039, 0.016, 0.208);
  vec3 royal = vec3(0.016, 0.090, 0.357);
  vec3 blue = vec3(0.063, 0.216, 0.518);
  vec3 gold = vec3(0.949, 0.718, 0.020);
  vec3 red = vec3(1.0, 0.063, 0.133);

  vec3 col = mix(voidC, midnight, uv.y);
  col = mix(col, royal, field * 0.55);
  col = mix(col, blue, smoothstep(0.55, 1.0, n2) * 0.4);

  float flecks = step(0.965, hash(floor(p * 90.0 + t * 2.0)));
  col += gold * flecks * 0.85;

  float ribbon = smoothstep(0.08, 0.0, abs(p.y + sin(p.x * 2.5 + t * 2.0) * 0.25 - mouse.y * 0.5));
  col = mix(col, mix(gold, red, 0.35 + 0.35 * sin(t * 3.0)), ribbon * 0.35);

  float vignette = smoothstep(1.35, 0.2, length(p * vec2(1.1, 1.25)));
  col *= vignette;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function initHeroWebGL(canvas, { reducedMotion = false } = {}) {
  if (reducedMotion || !canvas) {
    return { destroy() {}, pause() {}, resume() {} };
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime: { value: 0 },
    uResolution: {
      value: new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  let raf = 0;
  let running = true;
  let start = performance.now();
  const pointer = { x: 0.5, y: 0.5 };
  const pointerTarget = { x: 0.5, y: 0.5 };

  const onPointer = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointerTarget.x = (e.clientX - rect.left) / rect.width;
    pointerTarget.y = 1 - (e.clientY - rect.top) / rect.height;
  };

  const onResize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
  };

  const tick = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const t = (now - start) / 1000;
    uniforms.uTime.value = t;
    pointer.x += (pointerTarget.x - pointer.x) * 0.06;
    pointer.y += (pointerTarget.y - pointer.y) * 0.06;
    uniforms.uPointer.value.set(pointer.x, pointer.y);
    renderer.render(scene, camera);
  };

  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("resize", onResize);
  onResize();
  raf = requestAnimationFrame(tick);

  return {
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running) return;
      running = true;
      start = performance.now() - uniforms.uTime.value * 1000;
      raf = requestAnimationFrame(tick);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      material.dispose();
      mesh.geometry.dispose();
      renderer.dispose();
    },
  };
}
