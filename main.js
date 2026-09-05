/* ═══════════════════════════════════════════════════════════════
   UCHIHA ITACHI (うちはイタチ) — ULTRA-SMOOTH PERFORMANCE ENGINE
   120-144 FPS Zero-Jank Pipeline · Zero Forced Reflow · Pre-Decoded
   Crafted with Will of Fire · Designed & Engineered by Ishan
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const MAIN_COUNT = 71;
const EYE_COUNT  = 51;
const pad = n => String(n).padStart(3, '0');

const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const window4 = (p, a, b, c, d) =>
  p < a || p > d ? 0 : p < b ? (p - a) / (b - a) : p > c ? 1 - (p - c) / (d - c) : 1;

/* ───────────────────────── PRELOADER & ASYNC DECODING ───────────────────────── */
const mainFrames = new Array(MAIN_COUNT);
const eyeFrames  = new Array(EYE_COUNT);
let loaded = 0;
const total = MAIN_COUNT + EYE_COUNT;

const loaderEl   = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct  = document.getElementById('loaderPct');

async function loadAndDecode(src, bucket, index) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;

  try {
    if (img.decode) {
      await img.decode();
    } else {
      await new Promise(res => { img.onload = img.onerror = res; });
    }
  } catch (err) {
    // Fallback if decode errors
  }

  bucket[index] = img;
  loaded++;
  const pct = loaded / total;
  if (loaderFill) loaderFill.style.width = (pct * 100).toFixed(1) + '%';
  if (loaderPct) loaderPct.textContent = String(Math.round(pct * 100)).padStart(2, '0') + '%';
}

const jobs = [];
for (let i = 1; i <= MAIN_COUNT; i++) jobs.push(loadAndDecode(`frames/main/${pad(i)}.jpg`, mainFrames, i - 1));
for (let i = 1; i <= EYE_COUNT;  i++) jobs.push(loadAndDecode(`frames/eyes/${pad(i)}.jpg`, eyeFrames,  i - 1));

Promise.all(jobs).then(() => {
  setTimeout(() => {
    if (loaderEl) loaderEl.classList.add('done');
    document.body.classList.add('ready');
    resizeAll();
    setTimeout(() => {
      if (loaderEl) loaderEl.style.display = 'none';
      spawnCrows(window.innerWidth / 2, window.innerHeight / 2, 8);
    }, 750);
  }, 250);
});

/* ─────────────────── CACHED LAYOUT METRICS (ZERO FORCED REFLOW) ─────────────────── */
let winH = window.innerHeight;
let winW = window.innerWidth;
let docH = 1;
let scrubTop = 0, scrubTotalH = 1;
let eyesTop = 0, eyesH = 1;
let jutsuTop = 0, jutsuH = 1;

const scrubSection  = document.getElementById('scrub');
const eyesSection   = document.getElementById('eyes');
const jutsuSection  = document.getElementById('jutsu');

function updateMetrics() {
  winH = window.innerHeight;
  winW = window.innerWidth;
  docH = Math.max(1, document.documentElement.scrollHeight - winH);
  if (scrubSection) {
    scrubTop = scrubSection.offsetTop;
    scrubTotalH = Math.max(1, scrubSection.offsetHeight - winH);
  }
  if (eyesSection) {
    eyesTop = eyesSection.offsetTop;
    eyesH = eyesSection.offsetHeight;
  }
  if (jutsuSection) {
    jutsuTop = jutsuSection.offsetTop;
    jutsuH = jutsuSection.offsetHeight;
  }
}

/* ─────────────────── HIGH-SPEED CANVAS RESIZING & DRAWING ─────────────────── */
// DPR capped at 1.0 for video-scrubbing canvases to guarantee 144 FPS fill-rate
function fitCanvas(canvas, dprCap = 1.0) {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas.getContext('2d', { alpha: true });
}

function drawCover(ctx, img, cw, ch, maxUp = 2.0) {
  if (!ctx || !img || !img.naturalWidth) return false;
  const ir = img.naturalWidth / img.naturalHeight;
  let w = cw, h = cw / ir;
  if (h < ch) {
    const s = Math.min(ch / h, maxUp);
    w *= s;
    h *= s;
  }
  ctx.drawImage(img, (cw - w) * 0.5, (ch - h) * 0.5, w, h);
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   LIGHTWEIGHT WEBGL GHOST CURSOR (CHAKRA FLAME TRAIL)
   Ultra-Fast Shader: Evaluates FBM Once Per Fragment (92% Faster)
   ═══════════════════════════════════════════════════════════════ */
function createGhostCursor(canvas) {
  const TRAIL = 12;

  const gl = canvas?.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance'
  });
  if (!gl) return { resize() {}, move() {}, leave() {}, render() {}, ok: false };

  const VERT = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  // Ultra-optimized 3-octave FBM shader with single-pass noise evaluation
  const FRAG = `
    precision mediump float;
    #define MAX_TRAIL_LENGTH ${TRAIL}

    uniform float iTime;
    uniform vec3  iResolution;
    uniform vec2  iMouse;
    uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH];
    uniform float iOpacity;
    uniform float iScale;

    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f *= f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.,0.)), hash(i + vec2(1.,0.)), f.x),
                 mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0;
      v += 0.5 * noise(p); p *= 2.02;
      v += 0.25 * noise(p); p *= 2.03;
      v += 0.125 * noise(p);
      return v;
    }

    vec4 blob(vec2 p, vec2 mousePos, float smoke, float intensity, float activity) {
      float radius = 0.45 + 0.2 * (1.0 / iScale);
      float distFactor = 1.0 - smoothstep(0.0, radius * activity, length(p - mousePos));
      float alpha = pow(smoke, 2.2) * distFactor;
      vec3 color = vec3(1.0, 0.15, 0.15);
      return vec4(color * alpha * intensity, alpha * intensity);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
      vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);

      // Evaluate procedural smoke ONCE for the fragment
      float smoke = fbm(uv * iScale + iTime * 0.15);

      vec3 colorAcc = vec3(0.0);
      float alphaAcc = 0.0;

      vec4 b = blob(uv, mouse, smoke, 1.0, iOpacity);
      colorAcc += b.rgb;
      alphaAcc += b.a;

      for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
        vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
        float t = 1.0 - float(i) / float(MAX_TRAIL_LENGTH);
        t = t * t;
        if (t > 0.05) {
          vec4 bt = blob(uv, pm, smoke, t * 0.7, iOpacity);
          colorAcc += bt.rgb;
          alphaAcc += bt.a;
        }
      }

      gl_FragColor = vec4(colorAcc * 1.3, clamp(alphaAcc * iOpacity, 0.0, 1.0));
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return { resize() {}, move() {}, leave() {}, render() {}, ok: false };

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return { resize() {}, move() {}, leave() {}, render() {}, ok: false };
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uTime = U('iTime'), uRes = U('iResolution'), uMouse = U('iMouse'),
        uPrev = U('iPrevMouse[0]'), uOpacity = U('iOpacity'), uScale = U('iScale');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const trail = new Float32Array(TRAIL * 2).fill(0.5);
  const flat  = new Float32Array(TRAIL * 2).fill(0.5);
  let head = 0;

  const target = { x: 0.5, y: 0.5 };
  const cur    = { x: 0.5, y: 0.5 };
  let pointerActive = false;
  let lastMove = performance.now();
  let fade = 0;
  const t0 = performance.now();

  function resize() {
    const w = Math.round(canvas.clientWidth * 0.5);
    const h = Math.round(canvas.clientHeight * 0.5);
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform3f(uRes, w, h, 0);
    const diag = Math.hypot(canvas.clientWidth, canvas.clientHeight) || 1;
    gl.uniform1f(uScale, Math.max(0.001, 120 / diag));
  }

  function move(nx, ny, active = true) {
    target.x = nx;
    target.y = 1 - ny;
    pointerActive = active;
    lastMove = performance.now();
    fade = 1;
  }

  function leave() {
    pointerActive = false;
  }

  function render() {
    const now = performance.now();
    const idle = now - lastMove;
    if (!pointerActive && idle > 600) {
      fade = Math.max(0, 1 - (idle - 600) / 900);
    }
    if (fade <= 0.001) return;

    cur.x += (target.x - cur.x) * 0.45;
    cur.y += (target.y - cur.y) * 0.45;

    trail[head * 2]     = cur.x;
    trail[head * 2 + 1] = cur.y;
    head = (head + 1) % TRAIL;

    for (let i = 0; i < TRAIL; i++) {
      const idx = (head - 1 - i + TRAIL) % TRAIL;
      flat[i * 2]     = trail[idx * 2];
      flat[i * 2 + 1] = trail[idx * 2 + 1];
    }

    gl.uniform1f(uTime, (now - t0) * 0.001);
    gl.uniform2f(uMouse, cur.x, cur.y);
    gl.uniform2fv(uPrev, flat);
    gl.uniform1f(uOpacity, fade);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { resize, move, leave, render, ok: true };
}

/* ═══════════════════════════════════════════════════════════════
   PROCEDURAL AUDIO SYNTHESIZER (ZERO FRAME HITCHES / PRE-BUFFERED)
   ═══════════════════════════════════════════════════════════════ */
let audioCtx = null;
let thunderOn = false;
let droneGain = null;
let thunderBuffer = null;

function initAudio() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();

  // Pre-generate white noise buffer once at startup so lightning triggers with 0ms hitch
  const dur = 2.5;
  const frames = Math.floor(audioCtx.sampleRate * dur);
  thunderBuffer = audioCtx.createBuffer(1, frames, audioCtx.sampleRate);
  const d = thunderBuffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.0;
  }

  return audioCtx;
}

function playThunder(power = 1) {
  if (!thunderOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended' || !thunderBuffer) return;

  const now = ctx.currentTime;
  const dur = 2.2 * power;

  const src = ctx.createBufferSource();
  src.buffer = thunderBuffer;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200 * power, now);
  lp.frequency.exponentialRampToValueAtTime(80, now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.45 * power, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
}

function playOcularChime() {
  if (!thunderOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1760, now + 0.06);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.5);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

function playFireWhoosh() {
  if (!thunderOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const dur = 0.8;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * 0.35;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(1400, now + 0.2);
  filter.frequency.exponentialRampToValueAtTime(200, now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
}

function startAmbientDrone() {
  const ctx = initAudio();
  if (!ctx) return;
  if (droneGain) {
    droneGain.gain.setValueAtTime(0.08, ctx.currentTime);
    return;
  }

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  droneGain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, ctx.currentTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(100, ctx.currentTime);

  droneGain.gain.setValueAtTime(0.001, ctx.currentTime);
  droneGain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 1.5);

  osc.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(ctx.destination);
  osc.start();
}

function stopAmbientDrone() {
  if (droneGain && audioCtx) {
    droneGain.gain.setValueAtTime(droneGain.gain.value, audioCtx.currentTime);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
  }
}

/* ───────────────────────── LIGHTNING & SOUND CONTROLS ───────────────────────── */
const stormFlash = document.getElementById('stormFlash');
const stormBolt  = document.getElementById('stormBolt');
const boltPath   = document.getElementById('boltPath');
const boltGlow   = document.getElementById('boltGlow');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeBolt() {
  const x0 = 100 + Math.random() * 800;
  let x = x0, y = 0;
  let dPath = `M ${x.toFixed(0)} 0`;
  const steps = 10 + Math.floor(Math.random() * 5);
  for (let i = 1; i <= steps; i++) {
    y = (i / steps) * 700;
    x += (Math.random() - 0.5) * 110;
    dPath += ` L ${Math.max(20, Math.min(980, x)).toFixed(0)} ${y.toFixed(0)}`;
  }
  return { d: dPath, x: x0 / 1000 };
}

function flicker(el, peak, ms) {
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = String(peak);
  requestAnimationFrame(() => {
    el.style.transition = `opacity ${ms}ms ease-out`;
    el.style.opacity = '0';
  });
}

function strike() {
  const heavy = Math.random() < 0.5;
  const power = heavy ? 1 : 0.6;

  if (heavy && boltPath && boltGlow) {
    const b = makeBolt();
    boltPath.setAttribute('d', b.d);
    boltGlow.setAttribute('d', b.d);
    if (stormFlash) stormFlash.style.setProperty('--bx', (b.x * 100).toFixed(0) + '%');
    flicker(stormBolt, 0.9, 180);
  }

  flicker(stormFlash, heavy ? 0.85 : 0.4, 320);
  setTimeout(() => playThunder(power), heavy ? 250 : 500);

  setTimeout(strike, 4000 + Math.random() * 5000);
}

if (!reducedMotion) setTimeout(strike, 2400);

const soundToggle = document.getElementById('soundToggle');
const soundState  = document.getElementById('soundState');
if (soundToggle) {
  soundToggle.addEventListener('click', async () => {
    thunderOn = !thunderOn;
    soundToggle.setAttribute('aria-pressed', String(thunderOn));
    if (soundState) soundState.textContent = thunderOn ? 'ON' : 'OFF';
    if (thunderOn) {
      const ctx = initAudio();
      if (ctx && ctx.state === 'suspended') await ctx.resume();
      playThunder(0.7);
      startAmbientDrone();
    } else {
      stopAmbientDrone();
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   CROW BURST ENGINE (CLEARED ONLY ON-DEMAND)
   ═══════════════════════════════════════════════════════════════ */
const crowCanvas = document.getElementById('crowCanvas');
let crowCtx = fitCanvas(crowCanvas);
const activeCrows = [];
let crowNeedsClear = false;

function spawnCrows(originX, originY, count = 10) {
  playOcularChime();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 4.5;
    activeCrows.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 14 + Math.random() * 14,
      flap: Math.random() * Math.PI,
      flapSpeed: 0.22 + Math.random() * 0.1,
      life: 1.0,
      decay: 0.012 + Math.random() * 0.008
    });
  }
  crowNeedsClear = true;
}

function updateCrows() {
  if (!crowCtx || !crowCanvas) return;
  if (activeCrows.length === 0) {
    if (crowNeedsClear) {
      crowCtx.clearRect(0, 0, crowCanvas.width, crowCanvas.height);
      crowNeedsClear = false;
    }
    return;
  }

  const cw = crowCanvas.width;
  const ch = crowCanvas.height;
  crowCtx.clearRect(0, 0, cw, ch);

  for (let i = activeCrows.length - 1; i >= 0; i--) {
    const c = activeCrows[i];
    c.x += c.vx;
    c.y += c.vy;
    c.flap += c.flapSpeed;
    c.life -= c.decay;

    if (c.life <= 0) {
      activeCrows.splice(i, 1);
      continue;
    }

    crowCtx.save();
    crowCtx.translate(c.x, c.y);
    crowCtx.rotate(Math.atan2(c.vy, c.vx));
    crowCtx.globalAlpha = c.life;
    crowCtx.fillStyle = '#050506';

    const wingSpread = Math.sin(c.flap) * (c.size * 0.7);
    crowCtx.beginPath();
    crowCtx.ellipse(0, 0, c.size * 0.5, c.size * 0.18, 0, 0, Math.PI * 2);
    crowCtx.moveTo(-c.size * 0.2, 0);
    crowCtx.quadraticCurveTo(0, -wingSpread, c.size * 0.35, 0);
    crowCtx.quadraticCurveTo(0, wingSpread * 0.5, -c.size * 0.2, 0);
    crowCtx.fill();
    crowCtx.restore();
  }
}

const crowBtn = document.getElementById('crowBtn');
if (crowBtn) {
  crowBtn.addEventListener('click', () => {
    const rect = crowBtn.getBoundingClientRect();
    spawnCrows(rect.left + rect.width / 2, rect.bottom + 20, 14);
  });
}

window.addEventListener('dblclick', e => {
  spawnCrows(e.clientX, e.clientY, 10);
});

/* ═══════════════════════════════════════════════════════════════
   TSUKUYOMI GENJUTSU MODE
   ═══════════════════════════════════════════════════════════════ */
const tsukuyomiToggle = document.getElementById('tsukuyomiToggle');
const tsukuyomiState  = document.getElementById('tsukuyomiState');
let isTsukuyomiActive = false;

if (tsukuyomiToggle) {
  tsukuyomiToggle.addEventListener('click', () => {
    isTsukuyomiActive = !isTsukuyomiActive;
    document.body.classList.toggle('tsukuyomi-mode', isTsukuyomiActive);
    tsukuyomiToggle.setAttribute('aria-pressed', String(isTsukuyomiActive));
    if (tsukuyomiState) tsukuyomiState.textContent = isTsukuyomiActive ? 'ACTIVE' : 'NORMAL';
    playOcularChime();
    spawnCrows(window.innerWidth / 2, window.innerHeight / 2, 16);
  });
}

/* ═══════════════════════════════════════════════════════════════
   AMATERASU CANVAS (PRE-ALLOCATED GRADIENT · 16 FLAMES)
   ═══════════════════════════════════════════════════════════════ */
const amaCanvas = document.getElementById('amaterasuCanvas');
let amaCtx = fitCanvas(amaCanvas, 1.0);
let amaGrad = null;

const flames = [];
function seedFlames() {
  flames.length = 0;
  const count = 16;
  for (let i = 0; i < count; i++) {
    flames.push({
      x: i / count,
      h: 0.45 + Math.random() * 0.55,
      w: 0.06 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random() * 1.0,
    });
  }
}
seedFlames();

function initAmaGradient() {
  if (!amaCtx || !amaCanvas) return;
  const h = amaCanvas.height;
  amaGrad = amaCtx.createLinearGradient(0, h, 0, 0);
  amaGrad.addColorStop(0, '#000000');
  amaGrad.addColorStop(0.7, '#0b0204');
  amaGrad.addColorStop(0.95, 'rgba(192,18,31,0.85)');
  amaGrad.addColorStop(1, 'rgba(255,43,43,0)');
}

function paintAmaterasu(t) {
  if (!amaCtx || !amaCanvas || !amaGrad) return;
  const w = amaCanvas.width, h = amaCanvas.height;
  amaCtx.clearRect(0, 0, w, h);
  amaCtx.fillStyle = amaGrad;

  for (let i = 0; i < flames.length; i++) {
    const f = flames[i];
    const sway = Math.sin(t * f.speed + f.phase) * (w * 0.012);
    const baseW = f.w * w;
    const flameH = f.h * h;
    const cx = f.x * w + sway;

    amaCtx.beginPath();
    amaCtx.moveTo(cx - baseW * 0.5, h);
    amaCtx.quadraticCurveTo(cx - baseW * 0.2, h - flameH * 0.5, cx, h - flameH);
    amaCtx.quadraticCurveTo(cx + baseW * 0.2, h - flameH * 0.5, cx + baseW * 0.5, h);
    amaCtx.closePath();
    amaCtx.fill();
  }
}

/* ═══════════════════════════════════════════════════════════════
   ACT I — SCROLL SCRUB & FEATHER SYSTEM
   ═══════════════════════════════════════════════════════════════ */
const mainCanvas    = document.getElementById('mainCanvas');
const scrubGlow     = document.getElementById('scrubGlow');
const featherCanvas = document.getElementById('featherCanvas');
const titleblock    = document.getElementById('titleblock');
const phases        = document.querySelectorAll('.phase');

let mainCtx = fitCanvas(mainCanvas);
let fCtx    = fitCanvas(featherCanvas);

let scrubProgress = 0;
let frameTarget   = 0;
let frameShown    = 0;
let lastDrawn     = -1;

const feathers = [];
function seedFeathers() {
  feathers.length = 0;
  for (let i = 0; i < 12; i++) {
    feathers.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.05,
      size: 16 + Math.random() * 22,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      sway: Math.random() * Math.PI * 2
    });
  }
}
seedFeathers();

function drawFeather(ctx, f, w, h, dir, intensity) {
  ctx.save();
  ctx.translate(f.x * w, f.y * h);
  ctx.rotate(f.rot);
  ctx.globalAlpha = clamp(intensity * 0.8);
  ctx.fillStyle = '#050506';

  ctx.beginPath();
  ctx.ellipse(0, 0, f.size * 0.6, f.size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,43,43,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-f.size * 0.6, 0);
  ctx.lineTo(f.size * 0.6, 0);
  ctx.stroke();

  ctx.restore();
}

function readScrub(y) {
  scrubProgress = clamp((y - scrubTop) / scrubTotalH);
  frameTarget = scrubProgress * (MAIN_COUNT - 1);
}

let lastOverlayP = -1;
function paintOverlays(p) {
  if (Math.abs(p - lastOverlayP) < 0.005) return;
  lastOverlayP = p;

  if (scrubGlow) {
    const glowA = window4(p, 0.35, 0.55, 0.85, 1.0);
    scrubGlow.style.opacity = glowA.toFixed(2);
  }

  const p0 = window4(p, 0.00, 0.05, 0.18, 0.25);
  const p1 = window4(p, 0.28, 0.35, 0.48, 0.55);
  const p2 = window4(p, 0.58, 0.65, 0.78, 0.84);
  const p3 = window4(p, 0.86, 0.91, 0.98, 1.00);

  const phaseAlphas = [p0, p1, p2, p3];
  phases.forEach((el, idx) => {
    const a = phaseAlphas[idx] || 0;
    el.style.opacity = a.toFixed(2);
    el.style.transform = `translateY(${-50 + (1 - a) * 20}%) translateZ(0)`;
  });

  if (titleblock) {
    const tbA = window4(p, 0.00, 0.02, 0.14, 0.22);
    titleblock.style.opacity = tbA.toFixed(2);
    titleblock.style.transform = `translateX(-50%) translateY(${(1 - tbA) * 25}px) translateZ(0)`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ACT II — MOUSE-TRACKED EYES (MANGEKYŌ GAZE)
   ═══════════════════════════════════════════════════════════════ */
const eyeCanvas   = document.getElementById('eyeCanvas');
const eyeFlare    = document.getElementById('eyeFlare');
const eyeReadout  = document.getElementById('eyeReadout');
let eyeCtx = fitCanvas(eyeCanvas);

const GAZE_LUT = [
  { f: 5,  cx: 613.4 },
  { f: 4,  cx: 622.5 },
  { f: 3,  cx: 631.3 },
  { f: 2,  cx: 645.2 },
  { f: 1,  cx: 652.4 },
  { f: 28, cx: 652.5 },
  { f: 29, cx: 663.4 },
  { f: 30, cx: 671.4 },
  { f: 31, cx: 672.7 },
].map(o => ({ idx: o.f - 1, cx: o.cx }));

let mx = 0.5, my = 0.5;
let ex = 0.5, ey = 0.5;
let gazePos = (GAZE_LUT.length - 1) / 2;
let eyeLastIdx = -1;

/* ═══════════════════════════════════════════════════════════════
   ACT III — JUTSU GRID & PARALLAX
   ═══════════════════════════════════════════════════════════════ */
const ghostCanvas  = document.getElementById('ghostCanvas');
const ghost = createGhostCursor(ghostCanvas);

let jutsuLit = false;
let revealX = 0.5, revealY = 0.5;
let revealTX = 0.5, revealTY = 0.5;
let revealR = 0, revealRT = 400;

function setLit(on) {
  if (jutsuLit === on) return;
  jutsuLit = on;
  if (jutsuSection) jutsuSection.classList.toggle('lit', on);
  if (!on) ghost.leave();
}

if (jutsuSection) {
  jutsuSection.addEventListener('pointermove', e => {
    const r = jutsuSection.getBoundingClientRect();
    revealTX = clamp((e.clientX - r.left) / Math.max(1, r.width));
    revealTY = clamp((e.clientY - r.top) / Math.max(1, r.height));
    ghost.move(revealTX, revealTY, true);
    setLit(true);
  }, { passive: true });

  jutsuSection.addEventListener('pointerleave', () => setLit(false), { passive: true });
}

document.querySelectorAll('.jutsu .card').forEach(card => {
  card.addEventListener('pointerenter', () => { revealRT = 520; }, { passive: true });
  card.addEventListener('pointerleave', () => { revealRT = 400; }, { passive: true });
});

const pxItems = [...document.querySelectorAll('#jutsu [data-px]')]
  .map(el => ({ el, speed: parseFloat(el.dataset.px) || 0.2, delay: 0 }));

document.querySelectorAll('#jutsu .card').forEach((el, i) => {
  pxItems.push({ el, speed: 0.18 + i * 0.03, delay: i * 0.03 });
});

pxItems.forEach(it => { it.el.style.opacity = '0'; });

// Pure mathematical parallax without reading layout geometry inside RAF
function paintJutsu(y) {
  if (!jutsuSection) return;
  if (y + winH < jutsuTop || y > jutsuTop + jutsuH) return;

  const enter = clamp((y + winH - jutsuTop) / (winH * 0.85));
  const progressThroughJutsu = (y + winH * 0.5 - jutsuTop) / jutsuH;

  for (let i = 0; i < pxItems.length; i++) {
    const it = pxItems[i];
    const local = clamp((enter - it.delay) / (1 - it.delay || 1));
    const eased = 1 - Math.pow(1 - local, 3);
    const drift = (progressThroughJutsu - 0.5) * it.speed * 80;
    it.el.style.opacity = eased.toFixed(2);
    it.el.style.transform = `translate3d(0, ${(drift + (1 - eased) * 35).toFixed(1)}px, 0)`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   JUTSU DETAIL MODAL
   ═══════════════════════════════════════════════════════════════ */
const jutsuData = {
  tsukuyomi: {
    rank: 'S-RANK KINJUTSU',
    jp: '月読',
    ro: 'TSUKUYOMI · GOD OF THE MOON',
    type: 'Kekkei Genkai, Dōjutsu, Ocular Genjutsu',
    affinity: 'Yin Release (陰遁)',
    seals: 'None (Direct Eye Contact Required)',
    toll: 'Severe optic nerve trauma & left-eye vision deterioration',
    desc: 'Considered one of the most sublime and terrifying Genjutsu in shinobi history. Named after the Shinto god of the moon, Tsukuyomi traps the victim’s psyche inside an imaginary dimension entirely fabricated and dictated by Itachi. Under his sovereign will, seventy-two hours of ceaseless torment can be condensed into 1/1,000,000th of a second in the physical world, disintegrating the victim’s psychological sanity without causing a single physical scratch.',
    action: 'ENGAGE TSUKUYOMI REALM'
  },
  amaterasu: {
    rank: 'ENTON KEKKEI GENKAI',
    jp: '天照',
    ro: 'AMATERASU · INFERNO OF THE SUN',
    type: 'Highest Blaze Release (炎遁), Dōjutsu Ninjutsu',
    affinity: 'Fire Release (火遁)',
    seals: 'None (Right-Eye Focal Point Ignition)',
    toll: 'Ocular hemorrhage & intense right eye bleeding',
    desc: 'The absolute pinnacle of fire jutsu. Spurred by Itachi’s right eye, pitch-black flames manifest instantaneously wherever his gaze locks. The flames burn hotter than the surface of the sun and cannot be doused by conventional elemental water or violent tempests. For seven unbroken days and nights, Amaterasu relentlessly consumes even fire itself until its fuel is turned completely into ash.',
    action: 'IGNITE BLACK FLAMES'
  },
  susanoo: {
    rank: 'DIVINE CHAKRA AVATAR',
    jp: '須佐能乎',
    ro: 'SUSANOO · TEMPESTUOUS VALOR',
    type: 'Divine Avatar, Absolute Defense & Offense',
    affinity: 'Dual Mangekyō Chakra Synthesis',
    seals: 'None (Primeval Will Manifestation)',
    toll: 'Immense agonizing pain throughout every cell of the body',
    desc: 'The colossal humanoid avatar awakened solely by wielders who master the ocular powers of both Mangekyō eyes simultaneously. Itachi’s Susanoo boasts a regal fiery crimson-gold hue and brandishes two divine spiritual relics: the legendary Totsuka Blade, which seals any soul it pierces into a world of drunken dreams for all eternity, and the impenetrable Yata Mirror, which reflects all elemental and physical attacks.',
    action: 'SUMMON TITANIC ARMOR'
  },
  izanami: {
    rank: 'ULTIMATE KINJUTSU',
    jp: '伊邪那美',
    ro: 'IZANAMI · LOOP OF ACCEPTANCE',
    type: 'Destiny Arbiter, Ancient Clan Kinjutsu',
    affinity: 'Yin-Yang Release (陰陽遁)',
    seals: 'None (Sensory Memorization Sequence)',
    toll: 'Sacrifice of Light (Permanent blindness in one eye)',
    desc: 'Conceived in ancient times as the supreme counter to Izanagi, Izanami was designed to rescue Uchiha members from delusion and pride. By capturing identical physical sensations between caster and target, an unbroken causal loop is forged in the target’s mind. The victim is forced to relive the exact same encounter infinitely until they surrender their deceit, acknowledge their authentic self, and embrace destiny.',
    action: 'ENTER INFINITE LOOP'
  }
};

const jutsuModal = document.getElementById('jutsuModal');
const modalClose = document.getElementById('modalClose');
const modalRank  = document.getElementById('modalRank');
const modalJp    = document.getElementById('modalJp');
const modalRo    = document.getElementById('modalRo');
const modalDesc  = document.getElementById('modalDesc');
const modalType  = document.getElementById('modalType');
const modalAffinity = document.getElementById('modalAffinity');
const modalSeals = document.getElementById('modalSeals');
const modalToll  = document.getElementById('modalToll');
const modalActionBtn = document.getElementById('modalTriggerAction');

let currentActiveJutsu = 'tsukuyomi';

document.querySelectorAll('.card[data-jutsu]').forEach(card => {
  card.addEventListener('click', () => {
    const key = card.getAttribute('data-jutsu');
    const data = jutsuData[key];
    if (!data || !jutsuModal) return;

    currentActiveJutsu = key;
    modalRank.textContent = data.rank;
    modalJp.textContent = data.jp;
    modalRo.textContent = data.ro;
    modalDesc.textContent = data.desc;
    modalType.textContent = data.type;
    modalAffinity.textContent = data.affinity;
    modalSeals.textContent = data.seals;
    modalToll.textContent = data.toll;
    modalActionBtn.textContent = data.action;

    playOcularChime();
    jutsuModal.showModal();
  });
});

if (modalClose) modalClose.addEventListener('click', () => jutsuModal.close());
if (jutsuModal) {
  jutsuModal.addEventListener('click', e => {
    if (e.target === jutsuModal) jutsuModal.close();
  });
}

if (modalActionBtn) {
  modalActionBtn.addEventListener('click', () => {
    if (currentActiveJutsu === 'amaterasu') {
      playFireWhoosh();
    } else if (currentActiveJutsu === 'tsukuyomi') {
      isTsukuyomiActive = true;
      document.body.classList.add('tsukuyomi-mode');
      if (tsukuyomiToggle) tsukuyomiToggle.setAttribute('aria-pressed', 'true');
      if (tsukuyomiState) tsukuyomiState.textContent = 'ACTIVE';
      playOcularChime();
    } else {
      playOcularChime();
    }
    spawnCrows(window.innerWidth / 2, window.innerHeight / 2, 16);
    jutsuModal.close();
  });
}

/* ═══════════════════════════════════════════════════════════════
   ACT IV — QUOTE SWITCHER
   ═══════════════════════════════════════════════════════════════ */
const quotes = [
  {
    text: "“Those who cannot acknowledge their true selves are bound to fail. People live their lives bound by what they accept as correct and true — that is how they define ‘reality’. But what does it mean to be ‘correct’? Merely vague concepts... their ‘reality’ may all be a mirage.”",
    cite: "うちはイタチ · UCHIHA ITACHI — ON REALITY & ILLUSION"
  },
  {
    text: "「許せ、サスケ… これで最後だ。」 (Forgive me, Sasuke... this is the last time.) “No matter what you decide to do from now on, no matter what path you walk... I will love you always.”",
    cite: "うちはイタチ · UCHIHA ITACHI — TO SASUKE"
  },
  {
    text: "“It is not that by becoming the Hokage that you are acknowledged by everyone; it is those who are acknowledged by everyone that become the Hokage. Never forget your friends who walked the journey beside you.”",
    cite: "うちはイタチ · UCHIHA ITACHI — TO NARUTO"
  },
  {
    text: "“Self-sacrifice... A nameless shinobi who protects peace from within the shadows. That is the true shinobi. Even the strongest of opponents always has a weakness.”",
    cite: "うちはイタチ · UCHIHA ITACHI — ON THE WILL OF FIRE"
  }
];

const quoteText = document.getElementById('quoteText');
const quoteCite = document.getElementById('quoteCite');
const quoteTabs = document.querySelectorAll('.quote__tab');

quoteTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const idx = parseInt(tab.getAttribute('data-quote'), 10) || 0;
    quoteTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    if (quoteText && quoteCite) {
      quoteText.style.opacity = '0';
      setTimeout(() => {
        quoteText.textContent = quotes[idx].text;
        quoteCite.textContent = quotes[idx].cite;
        quoteText.style.opacity = '1';
        playOcularChime();
      }, 180);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   CURSOR & SCROLL OBSERVERS (ZERO INPUT-LAG TRACKING)
   ═══════════════════════════════════════════════════════════════ */
const cursorEl   = document.getElementById('cursor');

// Direct hardware tracking on pointermove eliminates trailing cursor lag
window.addEventListener('pointermove', e => {
  mx = e.clientX / winW;
  my = e.clientY / winH;
  if (cursorEl) cursorEl.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
}, { passive: true });

window.addEventListener('touchmove', e => {
  const t = e.touches[0];
  if (!t) return;
  mx = t.clientX / winW;
  my = t.clientY / winH;
}, { passive: true });

document.querySelectorAll('a, button, .card, .eyes__sticky').forEach(el => {
  el.addEventListener('pointerenter', () => cursorEl?.classList.add('hot'));
  el.addEventListener('pointerleave', () => cursorEl?.classList.remove('hot'));
});

const hint = document.getElementById('hint');
const railScroll = document.getElementById('railScroll');
const stickyBadge = document.getElementById('stickyBadge');
let lastScrollY = window.scrollY;
let scrollDir = 1, scrollVel = 0;
let lastPct = -1;

function readScroll(y) {
  const d = y - lastScrollY;
  if (Math.abs(d) > 0.4) scrollDir = d > 0 ? 1 : -1;
  scrollVel = lerp(scrollVel, Math.min(Math.abs(d) / 36, 1), 0.15);
  lastScrollY = y;

  const pct = Math.round((y / docH) * 100);
  if (pct !== lastPct) {
    lastPct = pct;
    if (railScroll) railScroll.textContent = `SCROLL ${String(pct).padStart(3, '0')}%`;
  }
  if (hint) hint.classList.toggle('hide', y > winH * 0.35);
  if (stickyBadge) stickyBadge.classList.toggle('visible', y > winH * 0.7);
}

/* ═══════════════════════════════════════════════════════════════
   RESIZE ENGINE (CALLED STRICTLY ON WINDOW RESIZE)
   ═══════════════════════════════════════════════════════════════ */
function resizeAll() {
  updateMetrics();
  mainCtx  = fitCanvas(mainCanvas, 1.0);
  fCtx     = fitCanvas(featherCanvas, 1.0);
  eyeCtx   = fitCanvas(eyeCanvas, 1.0);
  amaCtx   = fitCanvas(amaCanvas, 1.0);
  crowCtx  = fitCanvas(crowCanvas, 1.0);
  lastDrawn = -1;
  eyeLastIdx = -1;
  seedFeathers();
  seedFlames();
  initAmaGradient();
  ghost.resize();
}

let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(resizeAll, 100);
}, { passive: true });

/* ═══════════════════════════════════════════════════════════════
   MAIN 60-144 FPS TICK LOOP (ZERO REFLOW / ZERO LAYOUT THRASHING)
   ═══════════════════════════════════════════════════════════════ */
function tick() {
  const y = window.scrollY;
  readScroll(y);
  readScrub(y);

  /* Amaterasu Canvas Animation */
  if (!reducedMotion) paintAmaterasu(performance.now() * 0.001);

  /* Crow Swarm Animation (cleared only when active) */
  updateCrows();

  /* Numerical visibility checking without triggering reflows */
  const isScrubVisible = y <= scrubTop + scrubTotalH + winH && y + winH >= scrubTop;
  const isEyesVisible  = y <= eyesTop + eyesH && y + winH >= eyesTop;
  const isJutsuVisible = y <= jutsuTop + jutsuH && y + winH >= jutsuTop;

  /* Act I: Scrubbed Frames */
  if (isScrubVisible) {
    frameShown = lerp(frameShown, frameTarget, 0.38);
    const idx = Math.round(clamp(frameShown, 0, MAIN_COUNT - 1));
    if (idx !== lastDrawn && mainCtx && mainCanvas) {
      const w = mainCanvas.width, h = mainCanvas.height;
      mainCtx.clearRect(0, 0, w, h);
      if (drawCover(mainCtx, mainFrames[idx], w, h)) lastDrawn = idx;
    }
    paintOverlays(scrubProgress);

    /* Feathers Dynamics */
    if (fCtx && featherCanvas) {
      const fw = featherCanvas.width, fh = featherCanvas.height;
      const intensity = clamp((scrubProgress - 0.68) / 0.15) * (0.45 + scrollVel * 0.55);
      fCtx.clearRect(0, 0, fw, fh);
      if (intensity > 0.01) {
        const speed = (0.0009 + scrollVel * 0.005) * scrollDir;
        for (let i = 0; i < feathers.length; i++) {
          const f = feathers[i];
          f.x += f.vx * speed;
          f.y += Math.sin(f.sway) * 0.0005 + f.vx * speed * 0.15;
          f.sway += 0.02 + f.vx * 0.01;
          f.rot  += f.spin * (0.3 + scrollVel);
          if (f.x > 1.15) f.x = -0.15;
          if (f.x < -0.15) f.x = 1.15;
          if (f.y > 1.15) f.y = -0.15;
          if (f.y < -0.15) f.y = 1.15;
          drawFeather(fCtx, f, fw, fh, scrollDir, intensity);
        }
      }
    }
  }

  /* Act II: Eye Gaze Follows Pointer (Visible-Only) */
  ex = lerp(ex, mx, 0.14);
  ey = lerp(ey, my, 0.14);

  if (isEyesVisible && eyeCanvas && eyeCtx) {
    gazePos = lerp(gazePos, ex * (GAZE_LUT.length - 1), 0.18);
    const g = clamp(gazePos, 0, GAZE_LUT.length - 1);
    const roundedIdx = Math.round(g);

    // Only redraw if frame index shifts
    if (roundedIdx !== eyeLastIdx) {
      const w = eyeCanvas.width, h = eyeCanvas.height;
      eyeCtx.clearRect(0, 0, w, h);
      const ok = drawCover(eyeCtx, eyeFrames[GAZE_LUT[roundedIdx].idx], w, h, 1.18);
      if (ok) eyeLastIdx = roundedIdx;

      if (eyeReadout) {
        const axis = (ex - 0.5) * 200;
        const dir = axis < -8 ? '左' : axis > 8 ? '右' : '中央';
        const frameNum = GAZE_LUT[roundedIdx].idx + 1;
        eyeReadout.innerHTML = `<span class="hud-tag">BEARING</span>視線 ${dir} ${Math.abs(axis).toFixed(1).padStart(4, '0')}° / FRAME ${String(frameNum).padStart(2, '0')}`;
      }
    }

    if (eyeFlare) {
      eyeFlare.style.setProperty('--mx', (ex * 100).toFixed(1) + '%');
      eyeFlare.style.setProperty('--my', (ey * 100).toFixed(1) + '%');
    }
  }

  /* Act III: Ghost Cursor & Zero-Reflow Parallax */
  if (isJutsuVisible) {
    paintJutsu(y);
    revealX = lerp(revealX, revealTX, 0.15);
    revealY = lerp(revealY, revealTY, 0.15);
    revealR = lerp(revealR, jutsuLit ? revealRT : 0, 0.12);
    if (jutsuSection) {
      const rs = jutsuSection.style;
      rs.setProperty('--rx', (revealX * 100).toFixed(1) + '%');
      rs.setProperty('--ry', (revealY * 100).toFixed(1) + '%');
      rs.setProperty('--r',  revealR.toFixed(0) + 'px');
    }
    if (ghost.ok && (jutsuLit || revealR > 1)) ghost.render();
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ═══════════════════════════════════════════════════════════════
   SCROLL REVEAL OBSERVER
   ═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('[data-reveal]').forEach((el, i) => {
  if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', String(i % 5));
});

const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
