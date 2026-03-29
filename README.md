# TesseractTwist

**A browser-based, interactive 4D Rubik's Cube (Tesseract puzzle) built with Three.js and vanilla JavaScript.**

Manipulate an N×N×N×N hypercube through six 4D rotation planes, projected to your screen via stereographic projection. Choose grid sizes from 2×2×2×2 up to 5×5×5×5.

![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **True 4D geometry** — all puzzle pieces exist in 4D coordinates (x, y, z, w)
- **Stereographic projection** — 4D → 3D → 2D rendering pipeline with adjustable camera distance
- **6 rotation planes** — XY, XZ, YZ, XW, YW, ZW with full ±90° animated twists
- **Dynamic grid scaling** — supports N = 2 through N = 5 (16 to 625 hypercubies)
- **Slice-based moves** — select any axis (X/Y/Z/W) and slice index to rotate subsets of the puzzle
- **Real-time HUD** — move counter, elapsed timer, and solved percentage with progress bar
- **Hint system** — answer animal trivia questions to receive move suggestions
- **Scramble** — instant random scramble for any grid size
- **Mobile touch controls** — full on-screen toolbar for phones/tablets (no keyboard required)
- **Dark-theme enterprise UI** — glass-morphism modals, animated gradients, fog-enhanced 3D scene
- **Zero runtime dependencies** — vanilla ES6+ JavaScript; Three.js loaded from CDN
- **Comprehensive test suite** — 81 unit tests (Jest) + 35 E2E tests (Playwright)
- **CI/CD pipeline** — GitHub Actions with coverage and Playwright reports

---

## Quick Start

### Docker (recommended)

```bash
docker compose up -d --build
```

Open **http://127.0.0.1:9090** in your browser.

### Without Docker

Serve the `src/` directory with any static file server:

```bash
# Python
python -m http.server 8080 --directory src

# Node.js (npx)
npx serve src -l 8080
```

---

## Controls

### Desktop (Keyboard)

#### 4D Slice Rotations

| Key | Action |
|-----|--------|
| `Q` / `Shift+Q` | Rotate **XY**-plane +90° / −90° |
| `W` / `Shift+W` | Rotate **XZ**-plane +90° / −90° |
| `E` / `Shift+E` | Rotate **YZ**-plane +90° / −90° |
| `A` / `Shift+A` | Rotate **XW**-plane +90° / −90° |
| `S` / `Shift+S` | Rotate **YW**-plane +90° / −90° |
| `D` / `Shift+D` | Rotate **ZW**-plane +90° / −90° |

#### Slice Selection

| Key | Action |
|-----|--------|
| `1` – `5` | Select slice index (0-based) |
| `X` | Next slicing axis (X → Y → Z → W) |
| `Z` | Previous slicing axis |

#### General

| Key | Action |
|-----|--------|
| `R` | Scramble the puzzle |
| `H` | Toggle controls legend |

#### Camera (Mouse)

| Input | Action |
|-------|--------|
| Left-drag | Orbit around the puzzle |
| Scroll wheel | Zoom in / out |
| Right-drag | Pan the camera |

### Mobile (Touch)

On touch devices a three-row toolbar appears at the bottom of the screen:

| Row | Controls | Replaces |
|-----|----------|----------|
| **Axis & Slice** | `X` `Y` `Z` `W` axis buttons, `1`..`N` slice buttons | `X`/`Z` keys, `1`–`5` keys |
| **Rotations** | `XY` `XZ` `YZ` `XW` `YW` `ZW` plane buttons + CW/CCW toggle | `Q`–`D` keys + `Shift` modifier |
| **Actions** | Scramble, Hint, Help buttons | `R` key, hint button, `H` key |

Invalid rotation planes are automatically dimmed and unclickable based on the selected axis. Camera orbit/zoom works via standard touch gestures (drag to orbit, pinch to zoom).

---

## Architecture

```
TesseractTwist/
├── .github/workflows/ci.yml  # GitHub Actions CI pipeline
├── Dockerfile                 # nginx:alpine static server
├── docker-compose.yml         # Exposes port 9090
├── package.json               # Dev dependencies (Jest, Playwright)
├── jest.config.js             # Unit test configuration
├── playwright.config.js       # E2E test configuration
├── src/
│   ├── index.html             # UI shell: modals, HUD, mobile toolbar, CSS
│   ├── engine.js              # Pure 4D puzzle logic (~320 lines, no DOM deps)
│   └── app.js                 # Three.js rendering, DOM, keyboard, mobile (~730 lines)
└── tests/
    ├── unit/
    │   ├── math.test.js       # 4D math: vectors, matrices, rotations, projection
    │   └── puzzle.test.js     # Puzzle logic: slicing, scramble, solved detection
    └── e2e/
        ├── app.spec.js        # Desktop browser tests
        └── mobile.spec.js     # Mobile emulation tests (Pixel 5)
```

### Module Design

**`engine.js`** — Pure, testable module containing all 4D math and puzzle logic. No DOM or Three.js dependencies. Exports via CommonJS for Node.js (unit tests) and `window.TesseractEngine` for the browser.

**`app.js`** — Browser-only glue layer that imports from `TesseractEngine` and handles Three.js rendering, DOM manipulation, keyboard input, mobile touch controls, animation, and the hint system.

### How It Works

1. **4D Space** — Each puzzle piece (hypercubie) has a 4D center coordinate `[x, y, z, w]` in the range `[-1, +1]`.

2. **Stereographic Projection** — To render 4D geometry on screen, each 4D point is projected to 3D:
   ```
   scale = w₀ / (w₀ − w)
   projected = (x·scale, y·scale, z·scale)
   ```
   where `w₀` is the camera distance along the 4th axis. Three.js then handles 3D → 2D.

3. **Rotation Matrices** — Rotations in 4D occur across 6 planes (C(4,2) = 6). Each is a 4×4 matrix that mixes two basis vectors while leaving the other two unchanged.

4. **Slicing** — A move selects one layer of the N⁴ grid along a chosen axis and rotates all hypercubies in that slice by ±90° in one of the 6 planes.

5. **Grid Snapping** — After each move, positions snap to the nearest valid grid center to prevent floating-point drift.

6. **Solved Detection** — Compares each hypercubie's current position and face colors against its home state to calculate the solved percentage.

---

## Testing

### Prerequisites

```bash
npm install
npx playwright install chromium
```

### Run Unit Tests

```bash
npm run test:unit
```

81 tests covering 4D math (vectors, matrices, all 6 rotation planes, stereographic projection) and puzzle logic (slicing, scramble, face color rotation, solved detection, wireframe generation).

### Run E2E Tests

Requires the Docker container to be running on port 9090.

```bash
docker compose up -d --build
npm run test:e2e
```

35 tests across desktop and mobile viewports, covering page load, game init, keyboard controls, mobile touch controls, hint system, and canvas rendering.

### CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR to `main`/`master`:

1. **Unit job** — Node.js 20, Jest with coverage, uploads coverage artifact
2. **E2E job** — Docker build, Playwright with Chromium, uploads test report artifact

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | Three.js r128 (WebGL) |
| Logic | Vanilla JavaScript (ES6+) |
| Styling | CSS3 (custom properties, gradients, backdrop-filter) |
| Server | nginx:alpine |
| Orchestration | Docker Compose |
| Unit Tests | Jest 29 |
| E2E Tests | Playwright 1.45 |
| CI/CD | GitHub Actions |

---

## License

[MIT](LICENSE)
