/* ═══════════════════════════════════════════════════════════════
   UCHIHA ITACHI (うちはイタチ) — CORE ENGINE
   Scroll-Scrubbed Frames + Mouse-Tracked Gaze + WebGL Ghost Cursor
   + Procedural Audio Synthesizer + Tsukuyomi Genjutsu Engine
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

/* ───────────────────────── PRELOADER ───────────────────────── */
const mainFrames = [];
const eyeFrames  = [];
let loaded = 0;
const total = MAIN_COUNT + EYE_COUNT;

const loaderEl   = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct  = document.getElementById('loaderPct');

function load(src, bucket, index) {
  return new Promise(res => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = img.onerror = () => {
      bucket[index] = img;
      loaded++;
      const pct = loaded / total;
      if (loaderFill) loaderFill.style.width = (pct * 100).toFixed(1) + '%';
      if (loaderPct) loaderPct.textContent = String(Math.round(pct * 100)).padStart(2, '0') + '%';
      res();
    };
    img.src = src;
  });
}

const jobs = [];
for (let i = 1; i <= MAIN_COUNT; i++) jobs.push(load(`frames/main/${pad(i)}.jpg`, mainFrames, i - 1));
for (let i = 1; i <= EYE_COUNT;  i++) jobs.push(load(`frames/eyes/${pad(i)}.jpg`, eyeFrames,  i - 1));

Promise.all(jobs).then(() => {
  setTimeout(() => {
    if (loaderEl) loaderEl.classList.add('done');
    document.body.classList.add('ready');
    resizeAll();
    setTimeout(() => {
      if (loaderEl) loaderEl.style.display = 'none';
      // Trigger initial crow burst on entry
      spawnCrows(window.innerWidth / 2, window.innerHeight / 2, 8);
    }, 950);
  }, 400);
});

/* ─────────────────── CANVAS COVER-DRAW HELPER ─────────────────── */
function fitCanvas(canvas) {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.offsetWidth  * dpr);
  const h = Math.round(canvas.offsetHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas.getContext('2d');
}

function syncSize(canvas) {
  if (!canvas) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.offsetWidth * dpr);
  const h = Math.round(canvas.offsetHeight * dpr);
  return canvas.width !== w || canvas.height !== h;
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
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   WEBGL GHOST CURSOR (CHAKRA FLAME TRAIL)
   ═══════════════════════════════════════════════════════════════ */
function createGhostCursor(canvas, opts = {}) {
  const TRAIL    = opts.trailLength ?? 28;
  const INERTIA  = opts.inertia ?? 0.5;
  const BRIGHT   = opts.brightness ?? 1.45;
  const EDGE     = opts.edgeIntensity ?? 0.35;
  const FADE_DELAY = opts.fadeDelayMs ?? 900;
  const FADE_DUR   = opts.fadeDurationMs ?? 1400;
  const rgb = hexToRgb(opts.color ?? '#ff2b2b');

  const gl = canvas?.getContext('webgl', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance'
  });
  if (!gl) return { resize() {}, move() {}, leave() {}, render() {}, ok: false };

  const VERT = `
    attribute vec2 aPos;
    void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision highp float;
    #define MAX_TRAIL_LENGTH ${TRAIL}

    uniform float iTime;
    uniform vec3  iResolution;
    uniform vec2  iMouse;
    uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH];
    uniform float iOpacity;
    uniform float iScale;
    uniform vec3  iBaseColor;
    uniform float iBrightness;
    uniform float iEdgeIntensity;

    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f *= f * (3. - 2. * f);
      return mix(mix(hash(i + vec2(0.,0.)), hash(i + vec2(1.,0.)), f.x),
                 mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for(int i=0;i<5;i++){
        v += a * noise(p);
        p = m * p * 2.0;
        a *= 0.5;
      }
      return v;
    }
    vec3 tint1(vec3 base){ return mix(base, vec3(1.0), 0.15); }
    vec3 tint2(vec3 base){ return mix(base, vec3(0.8, 0.9, 1.0), 0.25); }

    vec4 blob(vec2 p, vec2 mousePos, float intensity, float activity) {
      vec2 q = vec2(fbm(p * iScale + iTime * 0.1), fbm(p * iScale + vec2(5.2,1.3) + iTime * 0.1));
      vec2 r = vec2(fbm(p * iScale + q * 1.5 + iTime * 0.15), fbm(p * iScale + q * 1.5 + vec2(8.3,2.8) + iTime * 0.15));

      float smoke = fbm(p * iScale + r * 0.8);
      float radius = 0.5 + 0.3 * (1.0 / iScale);
      float distFactor = 1.0 - smoothstep(0.0, radius * activity, length(p - mousePos));
      float alpha = pow(smoke, 2.5) * distFactor;

      vec3 c1 = tint1(iBaseColor);
      vec3 c2 = tint2(iBaseColor);
      vec3 color = mix(c1, c2, sin(iTime * 0.5) * 0.5 + 0.5);

      return vec4(color * alpha * intensity, alpha * intensity);
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
      vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);

      vec3 colorAcc = vec3(0.0);
      float alphaAcc = 0.0;

      vec4 b = blob(uv, mouse, 1.0, iOpacity);
      colorAcc += b.rgb;
      alphaAcc += b.a;

      for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
        vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
        float t = 1.0 - float(i) / float(MAX_TRAIL_LENGTH);
        t = pow(t, 2.0);
        if (t > 0.01) {
          vec4 bt = blob(uv, pm, t * 0.8, iOpacity);
          colorAcc += bt.rgb;
          alphaAcc += bt.a;
        }
      }

      colorAcc *= iBrightness;

      vec2 uv01 = gl_FragCoord.xy / iResolution.xy;
      float edgeDist = min(min(uv01.x, 1.0 - uv01.x), min(uv01.y, 1.0 - uv01.y));
      float distFromEdge = clamp(edgeDist * 2.0, 0.0, 1.0);
      float k = clamp(iEdgeIntensity, 0.0, 1.0);
      float edgeMask = mix(1.0 - k, 1.0, distFromEdge);

      float outAlpha = clamp(alphaAcc * iOpacity * edgeMask, 0.0, 1.0);
      gl_FragColor = vec4(colorAcc, outAlpha);
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
        uPrev = U('iPrevMouse[0]'), uOpacity = U('iOpacity'), uScale = U('iScale'),
        uColor = U('iBaseColor'), uBright = U('iBrightness'), uEdge = U('iEdgeIntensity');

  gl.uniform3f(uColor, rgb[0], rgb[1], rgb[2]);
  gl.uniform1f(uBright, BRIGHT);
  gl.uniform1f(uEdge, EDGE);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const trail = new Float32Array(TRAIL * 2).fill(0.5);
  const flat  = new Float32Array(TRAIL * 2).fill(0.5);
  let head = 0;

  const target = { x: 0.5, y: 0.5 };
  const cur    = { x: 0.5, y: 0.5 };
  const vel    = { x: 0, y: 0 };
  let pointerActive = false;
  let lastMove = performance.now();
  let fade = 0;
  const t0 = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.offsetWidth  * dpr);
    const h = Math.round(canvas.offsetHeight * dpr);
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.uniform3f(uRes, w, h, 0);
    const diag = Math.hypot(canvas.offsetWidth, canvas.offsetHeight) || 1;
    gl.uniform1f(uScale, Math.max(0.001, (opts.radius ?? 120) / diag));
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
    if (!pointerActive && idle > FADE_DELAY) {
      fade = Math.max(0, 1 - (idle - FADE_DELAY) / FADE_DUR);
    }

    vel.x = (target.x - cur.x) * (1 - INERTIA);
    vel.y = (target.y - cur.y) * (1 - INERTIA);
    cur.x += vel.x;
    cur.y += vel.y;

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

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return [
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255
  ];
}

/* ═══════════════════════════════════════════════════════════════
   PROCEDURAL WEB AUDIO SYNTHESIZER (CHAKRA & WEATHER)
   ═══════════════════════════════════════════════════════════════ */
let audioCtx = null;
let thunderOn = false;
let droneGain = null;

function initAudio() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

function playThunder(power = 1) {
  if (!thunderOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const dur = 2.2 + Math.random() * 2.4 * power;

  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.2;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1400 * power, now);
  lp.frequency.exponentialRampToValueAtTime(90, now + dur);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 28;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55 * power, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.16 * power, now + 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(75 * power, now);
  sub.frequency.exponentialRampToValueAtTime(32, now + dur * 0.7);

  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.exponentialRampToValueAtTime(0.42 * power, now + 0.06);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);

  src.connect(hp);
  hp.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);

  sub.connect(subGain);
  subGain.connect(ctx.destination);

  src.start(now);
  src.stop(now + dur);
  sub.start(now);
  sub.stop(now + dur);
}

/* Ocular Activation Sine Chime (Sharingan Awakening sound) */
function playOcularChime() {
  if (!thunderOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.75);
}

/* Fire whoosh sound for Amaterasu */
function playFireWhoosh() {
  if (!thunderOn) return;
  const ctx = initAudio();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  const dur = 1.2;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * 0.5;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(250, now);
  filter.frequency.exponentialRampToValueAtTime(1600, now + 0.3);
  filter.frequency.exponentialRampToValueAtTime(180, now + dur);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
}

/* Ambient dark sub drone */
function startAmbientDrone() {
  const ctx = initAudio();
  if (!ctx) return;
  if (droneGain) {
    droneGain.gain.setValueAtTime(0.12, ctx.currentTime);
    return;
  }

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  droneGain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, ctx.currentTime);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(110, ctx.currentTime);

  droneGain.gain.setValueAtTime(0.001, ctx.currentTime);
  droneGain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 2);

  osc.connect(filter);
  filter.connect(droneGain);
  droneGain.connect(ctx.destination);
  osc.start();
}

function stopAmbientDrone() {
  if (droneGain && audioCtx) {
    droneGain.gain.setValueAtTime(droneGain.gain.value, audioCtx.currentTime);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
  }
}

/* ───────────────────────── LIGHTNING GENERATOR ───────────────────────── */
const stormFlash = document.getElementById('stormFlash');
const stormBolt  = document.getElementById('stormBolt');
const boltPath   = document.getElementById('boltPath');
const boltGlow   = document.getElementById('boltGlow');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeBolt() {
  const x0 = 80 + Math.random() * 840;
  let x = x0, y = 0;
  let dPath = `M ${x.toFixed(0)} 0`;
  const steps = 14 + Math.floor(Math.random() * 8);
  const forks = [];
  const drift = (Math.random() - 0.5) * 40;

  for (let i = 1; i <= steps; i++) {
    y = (i / steps) * (620 + Math.random() * 300);
    x += drift + (Math.random() - 0.5) * 130;
    x = Math.max(20, Math.min(980, x));
    dPath += ` L ${x.toFixed(0)} ${y.toFixed(0)}`;
    if (Math.random() < 0.30 && i > 3) {
      let fx = x, fy = y, f = `M ${x.toFixed(0)} ${y.toFixed(0)}`;
      const fs = 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < fs; k++) {
        fx += (Math.random() - 0.5) * 150;
        fy += 40 + Math.random() * 80;
        f += ` L ${fx.toFixed(0)} ${fy.toFixed(0)}`;
      }
      forks.push(f);
    }
  }
  return { d: dPath + ' ' + forks.join(' '), x: x0 / 1000 };
}

function flicker(el, peak, ms) {
  if (!el) return;
  el.style.transition = 'none';
  el.style.opacity = String(peak);
  requestAnimationFrame(() => {
    el.style.transition = `opacity ${ms}ms cubic-bezier(.22,1,.36,1)`;
    el.style.opacity = '0';
  });
}

function strike() {
  const heavy = Math.random() < 0.55;
  const power = heavy ? 1 : 0.55 + Math.random() * 0.25;

  if (heavy && boltPath && boltGlow) {
    const b = makeBolt();
    boltPath.setAttribute('d', b.d);
    boltGlow.setAttribute('d', b.d);
    if (stormFlash) stormFlash.style.setProperty('--bx', (b.x * 100).toFixed(0) + '%');
    flicker(stormBolt, 1, 190);
  } else if (stormFlash) {
    stormFlash.style.setProperty('--bx', (15 + Math.random() * 70).toFixed(0) + '%');
  }

  flicker(stormFlash, heavy ? 0.9 : 0.42, heavy ? 380 : 300);

  const beats = heavy ? 1 + Math.floor(Math.random() * 2) : 1;
  for (let i = 1; i <= beats; i++) {
    setTimeout(() => {
      flicker(stormFlash, (heavy ? 0.7 : 0.3) * (1 - i * 0.2), 260);
      if (heavy && i === 1) flicker(stormBolt, 0.75, 140);
    }, 500 * i);
  }

  setTimeout(() => playThunder(power), heavy ? 260 : 620);

  const nextStrike = 3500 + Math.random() * 4500;
  setTimeout(strike, nextStrike);
}

if (!reducedMotion) setTimeout(strike, 2200);

/* Sound toggle button */
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
   CROW BURST ENGINE (烏分身の術)
   ═══════════════════════════════════════════════════════════════ */
const crowCanvas = document.getElementById('crowCanvas');
let crowCtx = fitCanvas(crowCanvas);
const activeCrows = [];

function spawnCrows(originX, originY, count = 12) {
  playOcularChime();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 6;
    activeCrows.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 14 + Math.random() * 18,
      flap: Math.random() * Math.PI,
      flapSpeed: 0.2 + Math.random() * 0.15,
      life: 1.0,
      decay: 0.008 + Math.random() * 0.008
    });
  }
}

function updateCrows() {
  if (!crowCtx) return;
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

    // Draw stylized crow silhouette
    crowCtx.save();
    crowCtx.translate(c.x, c.y);
    crowCtx.rotate(Math.atan2(c.vy, c.vx));
    crowCtx.globalAlpha = c.life;
    crowCtx.fillStyle = '#050506';

    const wingSpread = Math.sin(c.flap) * (c.size * 0.8);
    crowCtx.beginPath();
    // Body & Head
    crowCtx.ellipse(0, 0, c.size * 0.55, c.size * 0.2, 0, 0, Math.PI * 2);
    // Wings
    crowCtx.moveTo(-c.size * 0.2, 0);
    crowCtx.quadraticCurveTo(0, -wingSpread, c.size * 0.4, 0);
    crowCtx.quadraticCurveTo(0, wingSpread * 0.6, -c.size * 0.2, 0);
    crowCtx.fill();
    crowCtx.restore();
  }
}

// Crow button in header
const crowBtn = document.getElementById('crowBtn');
if (crowBtn) {
  crowBtn.addEventListener('click', e => {
    const rect = crowBtn.getBoundingClientRect();
    spawnCrows(rect.left + rect.width / 2, rect.bottom + 20, 16);
  });
}

// Click anywhere on body spawns subtle crows on shift-click or double-click
window.addEventListener('dblclick', e => {
  spawnCrows(e.clientX, e.clientY, 10);
});

/* ═══════════════════════════════════════════════════════════════
   TSUKUYOMI GENJUTSU MODE (月読 異界)
   ═══════════════════════════════════════════════════════════════ */
const tsukuyomiToggle = document.getElementById('tsukuyomiToggle');
const tsukuyomiState  = document.getElementById('tsukuyomiState');
let isTsukuyomiActive = false;

if (tsukuyomiToggle) {
  tsukuyomiToggle.addEventListener('click', () => {
    isTsukuyomiActive = !isTsukuyomiActive;
    document.body.classList.toggle('tsukuyomi-mode', isTsukuyomiActive);
    tsukuyomiToggle.setAttribute('aria-pressed', String(isTsukuyomiActive));
    if (tsukuyomiState) {
      tsukuyomiState.textContent = isTsukuyomiActive ? 'ACTIVE' : 'NORMAL';
    }
    playOcularChime();
    spawnCrows(window.innerWidth / 2, window.innerHeight / 2, 20);
  });
}

/* ═══════════════════════════════════════════════════════════════
   AMATERASU CANVAS (BLACK FLAMES AT VIEWPORT BOTTOM)
   ═══════════════════════════════════════════════════════════════ */
const amaCanvas = document.getElementById('amaterasuCanvas');
let amaCtx = fitCanvas(amaCanvas);
let amaPainted = false;

const flames = [];
function seedFlames() {
  flames.length = 0;
  const count = 42;
  for (let i = 0; i < count; i++) {
    flames.push({
      x: i / count,
      h: 0.45 + Math.random() * 0.55,
      w: 0.045 + Math.random() * 0.035,
      phase: Math.random() * Math.PI * 2,
      speed: 1.8 + Math.random() * 1.5,
    });
  }
}
seedFlames();

function drawFlame(ctx, f, w, h, t) {
  const sway = Math.sin(t * f.speed + f.phase) * (w * 0.012);
  const baseW = f.w * w;
  const flameH = f.h * h;
  const cx = f.x * w + sway;

  const grad = ctx.createLinearGradient(cx, h, cx, h - flameH);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.65, '#0b0204');
  grad.addColorStop(0.9, 'rgba(192,18,31,0.85)');
  grad.addColorStop(1, 'rgba(255,43,43,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - baseW * 0.5, h);
  ctx.quadraticCurveTo(cx - baseW * 0.25, h - flameH * 0.55, cx, h - flameH);
  ctx.quadraticCurveTo(cx + baseW * 0.25, h - flameH * 0.55, cx + baseW * 0.5, h);
  ctx.closePath();
  ctx.fill();
}

function drawEmbers(ctx, w, h, t) {
  ctx.globalCompositeOperation = 'lighter';
  const n = 16;
  for (let i = 0; i < n; i++) {
    const s = i * 12.9898;
    const life = (t * (0.22 + (i % 5) * 0.05) + i / n) % 1;
    const x = ((Math.sin(s) * 0.5 + 0.5) + Math.sin(t * 0.6 + s) * 0.02) * w;
    const y = h - life * h * 0.95;
    const a = Math.sin(life * Math.PI) * 0.6;
    const r = h * 0.02 * (1.4 - life * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,74,60,${a})`);
    g.addColorStop(1, 'rgba(120,10,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintAmaterasu(t) {
  if (!amaCtx) return;
  const w = amaCanvas.width, h = amaCanvas.height;
  amaCtx.clearRect(0, 0, w, h);
  for (const f of flames) drawFlame(amaCtx, f, w, h, t);
  drawEmbers(amaCtx, w, h, t);
}

/* ═══════════════════════════════════════════════════════════════
   ACT I — SCROLL SCRUB & FEATHERS
   ═══════════════════════════════════════════════════════════════ */
const scrubSection  = document.getElementById('scrub');
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
  for (let i = 0; i < 28; i++) {
    feathers.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.08,
      size: 18 + Math.random() * 32,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.03,
      sway: Math.random() * Math.PI * 2
    });
  }
}
seedFeathers();

function drawFeather(ctx, f, w, h, dir, intensity) {
  ctx.save();
  ctx.translate(f.x * w, f.y * h);
  ctx.rotate(f.rot);
  ctx.globalAlpha = clamp(intensity * 0.85);
  ctx.fillStyle = '#050506';

  ctx.beginPath();
  ctx.ellipse(0, 0, f.size * 0.6, f.size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feather spine
  ctx.strokeStyle = 'rgba(255,43,43,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-f.size * 0.6, 0);
  ctx.lineTo(f.size * 0.6, 0);
  ctx.stroke();

  ctx.restore();
}

function readScrub() {
  if (!scrubSection) return;
  const rect = scrubSection.getBoundingClientRect();
  const totalH = scrubSection.offsetHeight - window.innerHeight;
  const top = -rect.top;
  scrubProgress = clamp(top / Math.max(1, totalH));
  frameTarget = scrubProgress * (MAIN_COUNT - 1);
}

function paintOverlays(p) {
  // Glow increases as Sharingan awakens
  if (scrubGlow) {
    const glowA = window4(p, 0.35, 0.55, 0.85, 1.0);
    scrubGlow.style.opacity = glowA.toFixed(2);
  }

  // Phase captions cross-fades
  const p0 = window4(p, 0.00, 0.05, 0.18, 0.25);
  const p1 = window4(p, 0.28, 0.35, 0.48, 0.55);
  const p2 = window4(p, 0.58, 0.65, 0.78, 0.84);
  const p3 = window4(p, 0.86, 0.91, 0.98, 1.00);

  const phaseAlphas = [p0, p1, p2, p3];
  phases.forEach((el, idx) => {
    const a = phaseAlphas[idx] || 0;
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translateY(${-50 + (1 - a) * 25}%)`;
  });

  // Titleblock visible only in early beat
  if (titleblock) {
    const tbA = window4(p, 0.00, 0.02, 0.14, 0.22);
    titleblock.style.opacity = tbA.toFixed(3);
    titleblock.style.transform = `translateX(-50%) translateY(${(1 - tbA) * 30}px)`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ACT II — MOUSE-TRACKED EYES (MANGEKYŌ GAZE)
   ═══════════════════════════════════════════════════════════════ */
const eyesSection = document.getElementById('eyes');
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
let eyeLastKey = '';

window.addEventListener('pointermove', e => {
  mx = e.clientX / window.innerWidth;
  my = e.clientY / window.innerHeight;
  cursorX = e.clientX;
  cursorY = e.clientY;
}, { passive: true });

window.addEventListener('touchmove', e => {
  const t = e.touches[0];
  if (!t) return;
  mx = t.clientX / window.innerWidth;
  my = t.clientY / window.innerHeight;
}, { passive: true });

/* ═══════════════════════════════════════════════════════════════
   ACT III — JUTSU GRID & REVEAL
   ═══════════════════════════════════════════════════════════════ */
const jutsuSection = document.getElementById('jutsu');
const jutsuReveal  = document.getElementById('jutsuReveal');
const ghostCanvas  = document.getElementById('ghostCanvas');
const ghost = createGhostCursor(ghostCanvas, {
  color: '#ff2b2b',
  trailLength: 28,
  brightness: 0.45,
  edgeIntensity: 0.45,
});

let jutsuLit = false;
let revealX = 0.5, revealY = 0.5;
let revealTX = 0.5, revealTY = 0.5;
let revealR = 0, revealRT = 420;

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
  card.addEventListener('pointerenter', () => { revealRT = 580; }, { passive: true });
  card.addEventListener('pointerleave', () => { revealRT = 420; }, { passive: true });
});

/* Parallax Targets */
const pxItems = [...document.querySelectorAll('#jutsu [data-px]')]
  .map(el => ({ el, speed: parseFloat(el.dataset.px) || 0.2, delay: 0 }));

document.querySelectorAll('#jutsu .card').forEach((el, i) => {
  pxItems.push({ el, speed: 0.25 + i * 0.05, delay: i * 0.04 });
});
document.querySelectorAll('.jutsu__amaterasu').forEach(el => {
  pxItems.push({ el, speed: -0.22, delay: 0.1 });
});

pxItems.forEach(it => { it.el.style.opacity = '0'; });

function paintJutsu() {
  if (!jutsuSection) return;
  const r = jutsuSection.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top > vh || r.bottom < 0) return;

  const enter = clamp((vh - r.top) / (vh * 0.9));
  for (const it of pxItems) {
    const local = clamp((enter - it.delay) / (1 - it.delay || 1));
    const eased = 1 - Math.pow(1 - local, 3);
    const rect = it.el.getBoundingClientRect();
    const centred = (rect.top + rect.height / 2 - vh / 2) / vh;
    const drift = centred * it.speed * 110;
    it.el.style.opacity = eased.toFixed(3);
    it.el.style.transform = `translate3d(0, ${(drift + (1 - eased) * 50).toFixed(1)}px, 0)`;
  }
}

/* ═══════════════════════════════════════════════════════════════
   JUTSU DETAIL MODAL ENGINE
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

if (modalClose) {
  modalClose.addEventListener('click', () => jutsuModal.close());
}

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
    spawnCrows(window.innerWidth / 2, window.innerHeight / 2, 18);
    jutsuModal.close();
  });
}

/* ═══════════════════════════════════════════════════════════════
   ACT IV — PHILOSOPHICAL QUOTES
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
      }, 250);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════
   CUSTOM CURSOR & SCROLL METRICS
   ═══════════════════════════════════════════════════════════════ */
const cursorEl   = document.getElementById('cursor');
let cursorX = window.innerWidth / 2, cursorY = window.innerHeight / 2;
let cx = cursorX, cy = cursorY;

document.querySelectorAll('a, button, .card, .eyes__sticky').forEach(el => {
  el.addEventListener('pointerenter', () => cursorEl?.classList.add('hot'));
  el.addEventListener('pointerleave', () => cursorEl?.classList.remove('hot'));
});

const hint = document.getElementById('hint');
const railScroll = document.getElementById('railScroll');
const stickyBadge = document.getElementById('stickyBadge');
let lastScrollY = window.scrollY;
let scrollDir = 1, scrollVel = 0;

function readScroll() {
  const y = window.scrollY;
  const d = y - lastScrollY;
  if (Math.abs(d) > 0.4) scrollDir = d > 0 ? 1 : -1;
  scrollVel = lerp(scrollVel, Math.min(Math.abs(d) / 42, 1), 0.12);
  lastScrollY = y;

  const doc = document.documentElement.scrollHeight - window.innerHeight;
  const pct = Math.round((y / (doc || 1)) * 100);
  if (railScroll) railScroll.textContent = `SCROLL ${String(pct).padStart(3, '0')}%`;
  if (hint) hint.classList.toggle('hide', y > window.innerHeight * 0.35);
  if (stickyBadge) stickyBadge.classList.toggle('visible', y > window.innerHeight * 0.7);
}

/* ═══════════════════════════════════════════════════════════════
   RESIZE & TICK ENGINE
   ═══════════════════════════════════════════════════════════════ */
function resizeAll() {
  mainCtx  = fitCanvas(mainCanvas);
  fCtx     = fitCanvas(featherCanvas);
  eyeCtx   = fitCanvas(eyeCanvas);
  amaCtx   = fitCanvas(amaCanvas);
  crowCtx  = fitCanvas(crowCanvas);
  lastDrawn = -1;
  eyeLastKey = '';
  seedFeathers();
  seedFlames();
  amaPainted = false;
  ghost.resize();
}

let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(resizeAll, 120);
});

function tick() {
  readScroll();
  readScrub();

  if (syncSize(mainCanvas) || syncSize(eyeCanvas) ||
      syncSize(featherCanvas) || syncSize(amaCanvas) || syncSize(crowCanvas)) {
    resizeAll();
  }

  /* Amaterasu Canvas Animation */
  if (!reducedMotion) paintAmaterasu(performance.now() / 1000);
  else if (!amaPainted) { paintAmaterasu(0); amaPainted = true; }

  /* Crow Swarm Animation */
  updateCrows();

  /* Act I: Scrubbed Frames */
  frameShown = lerp(frameShown, frameTarget, 0.14);
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
      const speed = (0.0009 + scrollVel * 0.006) * scrollDir;
      for (const f of feathers) {
        f.x += f.vx * speed;
        f.y += Math.sin(f.sway) * 0.0006 + f.vx * speed * 0.18;
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

  /* Act II: Eye Gaze Follows Pointer */
  ex = lerp(ex, mx, 0.075);
  ey = lerp(ey, my, 0.075);

  if (eyesSection && eyeCanvas && eyeCtx) {
    const eyeRect = eyesSection.getBoundingClientRect();
    const eyeVisible = eyeRect.top < window.innerHeight && eyeRect.bottom > 0;

    if (eyeVisible) {
      gazePos = lerp(gazePos, ex * (GAZE_LUT.length - 1), 0.13);
      const g = clamp(gazePos, 0, GAZE_LUT.length - 1);
      const i0 = Math.floor(g), i1 = Math.min(i0 + 1, GAZE_LUT.length - 1);
      const t = g - i0;
      const key = `${i0}|${t.toFixed(2)}`;

      if (key !== eyeLastKey) {
        const w = eyeCanvas.width, h = eyeCanvas.height;
        eyeCtx.clearRect(0, 0, w, h);
        eyeCtx.globalAlpha = 1;
        const okA = drawCover(eyeCtx, eyeFrames[GAZE_LUT[i0].idx], w, h, 1.18);
        if (t > 0.01 && i1 !== i0) {
          eyeCtx.globalAlpha = t;
          drawCover(eyeCtx, eyeFrames[GAZE_LUT[i1].idx], w, h, 1.18);
          eyeCtx.globalAlpha = 1;
        }
        if (okA) eyeLastKey = key;
      }

      if (eyeFlare) {
        eyeFlare.style.setProperty('--mx', (ex * 100).toFixed(1) + '%');
        eyeFlare.style.setProperty('--my', (ey * 100).toFixed(1) + '%');
      }

      if (eyeReadout) {
        const axis = (ex - 0.5) * 200;
        const dir = axis < -8 ? '左' : axis > 8 ? '右' : '中央';
        const frameNum = GAZE_LUT[Math.round(g)].idx + 1;
        eyeReadout.innerHTML = `<span class="hud-tag">BEARING</span>視線 ${dir} ${Math.abs(axis).toFixed(1).padStart(4, '0')}° / FRAME ${String(frameNum).padStart(2, '0')}`;
      }
    }
  }

  /* Act III: Ghost Cursor & Parallax */
  paintJutsu();

  if (jutsuSection) {
    const jr = jutsuSection.getBoundingClientRect();
    if (jr.top < window.innerHeight && jr.bottom > 0) {
      revealX = lerp(revealX, revealTX, 0.13);
      revealY = lerp(revealY, revealTY, 0.13);
      revealR = lerp(revealR, jutsuLit ? revealRT : 0, 0.09);
      const rs = jutsuSection.style;
      rs.setProperty('--rx', (revealX * 100).toFixed(2) + '%');
      rs.setProperty('--ry', (revealY * 100).toFixed(2) + '%');
      rs.setProperty('--r',  revealR.toFixed(0) + 'px');
      if (ghost.ok && (jutsuLit || revealR > 1)) ghost.render();
    }
  }

  /* Custom Cursor Position */
  cx = lerp(cx, cursorX, 0.22);
  cy = lerp(cy, cursorY, 0.22);
  if (cursorEl) cursorEl.style.transform = `translate(${cx}px, ${cy}px)`;

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
}, { threshold: 0.15 });

document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
