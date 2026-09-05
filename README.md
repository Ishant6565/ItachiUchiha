# うちはイタチ — Uchiha Itachi: The Silent Guardian

> *"Those who cannot acknowledge their true selves are bound to fail."*  
> **An ultra-premium, cinematic interactive tribute experience celebrating Uchiha Itachi.**

---

## ✦ Overview

This project is a bespoke, cinematic web experience designed with smooth scroll-scrubbed frame sequences, real-time ocular gaze tracking, WebGL particle shaders, and a 100% procedural Web Audio API sound synthesizer.

Built from the ground up with high performance, dark shinobi aesthetics, and authentic Japanese typography.

---

## ✦ Core Features & Architecture

### 1. Act I — The Awakening (覚醒)
- **71-Frame Scroll Scrubbing**: Canvas-driven frame animation synchronized to user scroll with lerped smoothing.
- **Narrative Story Phases**: 4 Japanese typographic chapters depicting Itachi's burden, awakening, Sharingan emergence, and crow illusion.
- **Interactive Feather Dynamics**: Responsive crow feathers floating and swaying across the canvas, reacting to scroll speed and direction.

### 2. Act II — Mangekyō Live Gaze Tracking (万華鏡写輪眼)
- **Monotonic Gaze LUT**: 51 high-definition ocular frames calibrated across a monotonic left-to-right eye gaze lookup table.
- **Real-Time Cursor / Touch Tracking**: Itachi's eyes follow your mouse pointer or finger across the screen.
- **Tactical Shinobi HUD**: Corner coordinates, live bearing degrees (`視線 左/中央/右 XX.X°`), and ocular frame numbers.

### 3. Act III — Forbidden Arts (禁術)
- **Raw WebGL Ghost Cursor**: Fractional Brownian Motion (fBM) smoke & flame fragment shader rendering a crimson chakra trail.
- **Interactive Jutsu Cards**:
  - **月読 (Tsukuyomi)** — S-Rank Ocular Genjutsu.
  - **天照 (Amaterasu)** — Inextinguishable Black Flames.
  - **須佐能乎 (Susanoo)** — Colossal Avatar of War with Totsuka Blade & Yata Mirror.
  - **伊邪那美 (Izanami)** — Infinite Causal Loop of Destiny.
- **Jutsu Inspection Modal**: In-depth shinobi archives with rank, nature affinities, hand seal requirements, and ocular tolls.
- **Amaterasu Hem**: Canvas-generated black fire and glowing embers continuously burning at the bottom of the viewport.

### 4. Act IV — Words of the Martyr (言の葉)
- Typographic quote showcase with interactive tabs exploring Itachi's philosophy on reality, brotherhood, Hokage, and self-sacrifice.

### 5. Act V — Will of Fire Epilogue (木ノ葉の意志)
- Grand lineage tribute honoring the Uchiha clan and Itachi's legacy as Konoha's shadow protector.

---

## ✦ Interactive Controls & Special Modes

| Control | Action | Description |
| :--- | :--- | :--- |
| **音 SOUND** | Audio Toggle | Activates procedural thunder booms, ocular chimes, and ambient dark drone. |
| **月読 TSUKUYOMI** | Genjutsu Mode | Plunges the entire site into high-contrast crimson Tsukuyomi reality. |
| **烏 CROWS** | Crow Burst | Disperses a flock of animated crow silhouettes across the canvas. |
| **Double Click** | Quick Scatter | Spawns crows directly at your cursor location. |
| **Scroll / Scrub** | Frame Scrub | Controls the opening of Itachi's eyes and feather velocity. |
| **Pointer Drag** | Ghost Trail | Ignites the WebGL chakra smoke behind your cursor in Act III. |

---

## ✦ Tech Stack

- **HTML5**: Semantic layout with accessibility labels and custom modal dialogs.
- **Vanilla CSS3**: Design system with HSL tailored colors, dark glassmorphism, scanlines, and fluid typography (`Shippori Mincho`, `Zen Kaku Gothic`, `Cinzel`, `Space Grotesk`).
- **Vanilla JavaScript (ES6+)**: High-performance requestAnimationFrame loop, lerp easing, touch support.
- **WebGL**: Hardware-accelerated GLSL fragment shader for chakra flame smoke trail.
- **HTML5 Canvas (Multi-Layer)**: Frame rendering, feather particle physics, and Amaterasu flame simulation.
- **Web Audio API**: 100% synthetic audio engine with zero external MP3 dependencies (procedural thunder, Brownian noise, sine bell chimes, bandpass flame whooshes, sub-bass drone).

---

## ✦ Local Development

To run the project locally on your machine:

```bash
# Using Python
python -m http.server 8080

# Or using Node.js
npx serve .
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## ✦ Authorship & Tribute

*“To protect the village, he gave up being loved by it.”*  
**Crafted with Will of Fire · Designed & Engineered by Ishan**
