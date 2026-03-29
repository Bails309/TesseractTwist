/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  TesseractTwist — 4D Rubik's Cube UI & Rendering                  ║
 * ║  Browser-side glue: Three.js scene, DOM, keyboard, animation       ║
 * ║  Pure logic lives in engine.js (TesseractEngine)                   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

(function () {
"use strict";

/* ═══════════════════════════════════════════════════════════════
   §1  IMPORTS FROM ENGINE
   ═══════════════════════════════════════════════════════════════ */

const {
    W_CAMERA, AXIS_NAMES, VALID_PLANES, CELL_COLORS,
    FACE_PERM_CW, FACE_PERM_CCW, PLANE_NAMES, ANIM_DURATION,
    ROTATION_BUILDERS,
    vec4, vec4Copy, vec4Equals, mat4Identity, mat4MulVec4,
    rotXY, rotXZ, rotYZ, rotXW, rotYW, rotZW,
    project4Dto3D: engineProject4Dto3D,
    isValidPlane, rotateFaceColors,
    Hypercubie,
    sliceCenterValue, getSlice: engineGetSlice, snapToGrid,
    applyRotationToSlice: engineApplyRotation,
    generateHypercubies: engineGenerateHypercubies,
    generateWireframe: engineGenerateWireframe,
    scramble: engineScramble, countSolved, formatHint,
} = window.TesseractEngine;

/* ═══════════════════════════════════════════════════════════════
   §2  GLOBAL STATE
   ═══════════════════════════════════════════════════════════════ */

let N = 2;
let scene, camera, renderer, controls;
let hypercubies = [];
let wireframeGroup, hypercubieGroup;
let moveCount = 0;
let startTime = null;
let timerInterval = null;
let animating = false;
let currentSliceAxis = 0;
let currentSliceIndex = 0;
let wireVertices4D = [];
let wireEdges = [];
let animState = null;

/* ═══════════════════════════════════════════════════════════════
   §3  WRAPPERS — Adapt engine functions that need N or THREE
   ═══════════════════════════════════════════════════════════════ */

function project4Dto3D(point4D) {
    const p = engineProject4Dto3D(point4D);
    return new THREE.Vector3(p.x, p.y, p.z);
}

function getSlice(axis, index) {
    return engineGetSlice(hypercubies, axis, index, N);
}

function applyRotationToSlice(cubies, rotMatrix, planeIdx, direction) {
    engineApplyRotation(cubies, rotMatrix, planeIdx, direction, N);
}

/* ═══════════════════════════════════════════════════════════════
   §4  THREE.JS SCENE SETUP
   ═══════════════════════════════════════════════════════════════ */

function initThreeJS() {
    const canvas = document.getElementById("render-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0a0f, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a0f, 0.06);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(3, 2.5, 4);

    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.enableKeys = false;
    if (controls.keys) controls.keys = {};

    scene.add(new THREE.AmbientLight(0x8888bb, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 8, 6);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0xaaaaff, 0.4);
    dirLight2.position.set(-4, -3, -5);
    scene.add(dirLight2);

    wireframeGroup = new THREE.Group();
    hypercubieGroup = new THREE.Group();
    scene.add(wireframeGroup);
    scene.add(hypercubieGroup);

    window.addEventListener("resize", onResize);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ═══════════════════════════════════════════════════════════════
   §5  RENDERING — Build & Update Three.js Objects
   ═══════════════════════════════════════════════════════════════ */

let wireGeometry, wireMaterial, wireMesh;

function buildWireframeMesh() {
    if (wireMesh) {
        wireframeGroup.remove(wireMesh);
        wireGeometry.dispose();
    }

    const posArray = new Float32Array(wireEdges.length * 2 * 3);
    wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute("position", new THREE.BufferAttribute(posArray, 3));

    wireMaterial = new THREE.LineBasicMaterial({
        color: 0x4444aa,
        transparent: true,
        opacity: 0.22,
        linewidth: 1,
    });
    wireMesh = new THREE.LineSegments(wireGeometry, wireMaterial);
    wireframeGroup.add(wireMesh);
}

function updateWireframe() {
    const rXW = rotXW(autoRotAngle * 0.7);
    const rYZ = rotYZ(autoRotAngle * 0.5);
    const posAttr = wireGeometry.getAttribute("position");
    const arr = posAttr.array;
    for (let i = 0; i < wireEdges.length; i++) {
        const [a, b] = wireEdges[i];
        const va = mat4MulVec4(rYZ, mat4MulVec4(rXW, wireVertices4D[a]));
        const vb = mat4MulVec4(rYZ, mat4MulVec4(rXW, wireVertices4D[b]));
        const p1 = project4Dto3D(va);
        const p2 = project4Dto3D(vb);
        const idx = i * 6;
        arr[idx]     = p1.x; arr[idx + 1] = p1.y; arr[idx + 2] = p1.z;
        arr[idx + 3] = p2.x; arr[idx + 4] = p2.y; arr[idx + 5] = p2.z;
    }
    posAttr.needsUpdate = true;
}

function buildHypercubieMeshes() {
    while (hypercubieGroup.children.length > 0) {
        const child = hypercubieGroup.children[0];
        hypercubieGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
        } else if (child.material) {
            child.material.dispose();
        }
    }

    const cubieSize = (2 / N) * 0.85;

    for (const hc of hypercubies) {
        const geom = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);
        const materials = [];
        for (let f = 0; f < 6; f++) {
            if (hc.faceColors[f] != null) {
                materials.push(new THREE.MeshPhongMaterial({
                    color: hc.faceColors[f],
                    emissive: hc.faceColors[f],
                    emissiveIntensity: 0.25,
                    shininess: 80,
                    transparent: false,
                }));
            } else {
                const wColor = hc.faceColors[6] != null ? hc.faceColors[6] : hc.faceColors[7];
                if (wColor != null) {
                    materials.push(new THREE.MeshPhongMaterial({
                        color: wColor,
                        emissive: wColor,
                        emissiveIntensity: 0.15,
                        shininess: 40,
                        transparent: true,
                        opacity: 0.55
                    }));
                } else {
                    materials.push(new THREE.MeshPhongMaterial({
                        color: 0x222240,
                        shininess: 10,
                        transparent: true,
                        opacity: 0.3
                    }));
                }
            }
        }

        const mesh = new THREE.Mesh(geom, materials);
        hc.mesh = mesh;
        hypercubieGroup.add(mesh);
    }
}

function updateHypercubiePositions() {
    const rXW = rotXW(autoRotAngle * 0.7);
    const rYZ = rotYZ(autoRotAngle * 0.5);
    for (const hc of hypercubies) {
        if (!hc.mesh) continue;
        const rPos = mat4MulVec4(rYZ, mat4MulVec4(rXW, hc.pos));
        const p = project4Dto3D(rPos);
        hc.mesh.position.copy(p);

        const denom = Math.max(W_CAMERA - rPos[3], 0.01);
        const s = W_CAMERA / denom;
        const baseSize = (2 / N) * 0.85;
        const scaledSize = baseSize * s * 0.5;
        hc.mesh.scale.setScalar(Math.max(scaledSize, 0.01));
    }
}

function updateHypercubieMaterials() {
    for (const hc of hypercubies) {
        if (!hc.mesh) continue;
        const mats = hc.mesh.material;
        for (let f = 0; f < 6; f++) {
            if (hc.faceColors[f] != null) {
                mats[f].color.setHex(hc.faceColors[f]);
                mats[f].emissive.setHex(hc.faceColors[f]);
                mats[f].emissiveIntensity = 0.25;
                mats[f].transparent = false;
                mats[f].opacity = 1.0;
            } else {
                const wColor = hc.faceColors[6] != null ? hc.faceColors[6] : hc.faceColors[7];
                if (wColor != null) {
                    mats[f].color.setHex(wColor);
                    mats[f].emissive.setHex(wColor);
                    mats[f].emissiveIntensity = 0.15;
                    mats[f].transparent = true;
                    mats[f].opacity = 0.55;
                } else {
                    mats[f].color.setHex(0x222240);
                    mats[f].emissive.setHex(0x000000);
                    mats[f].emissiveIntensity = 0;
                    mats[f].transparent = true;
                    mats[f].opacity = 0.3;
                }
            }
        }
    }
}

/* ═══════════════════════════════════════════════════════════════
   §6  MOVE EXECUTION & ANIMATION
   ═══════════════════════════════════════════════════════════════ */

function executeMove(axis, sliceIdx, planeIdx, direction) {
    if (animating) {
        if (animState && animState.startedAt &&
            (performance.now() - animState.startedAt) > 2000) {
            animState = null;
            animating = false;
        } else {
            return;
        }
    }

    if (!isValidPlane(axis, planeIdx)) {
        showToast(`${PLANE_NAMES[planeIdx]} rotation invalid for ${AXIS_NAMES[axis]}-axis slice`);
        return;
    }

    const sliceCubies = getSlice(axis, sliceIdx);
    if (sliceCubies.length === 0) return;

    animating = true;
    const targetAngle = direction * Math.PI / 2;
    const startPositions = sliceCubies.map(hc => vec4Copy(hc.pos));

    animState = {
        cubies: sliceCubies,
        startPositions,
        planeIdx,
        targetAngle,
        direction,
        elapsed: 0,
        startedAt: performance.now(),
    };

    moveCount++;
    document.getElementById("hud-moves").textContent = moveCount;
}

function tickAnimation(dt) {
    if (!animState) return;
    try {
        animState.elapsed += dt;
        const t = Math.min(animState.elapsed / ANIM_DURATION, 1);
        const eased = t * t * (3 - 2 * t);
        const currentAngle = animState.targetAngle * eased;
        const rotMatrix = ROTATION_BUILDERS[animState.planeIdx](currentAngle);

        for (let i = 0; i < animState.cubies.length; i++) {
            animState.cubies[i].pos = mat4MulVec4(rotMatrix, animState.startPositions[i]);
        }

        if (t >= 1) {
            const finalRot = ROTATION_BUILDERS[animState.planeIdx](animState.targetAngle);
            for (let i = 0; i < animState.cubies.length; i++) {
                animState.cubies[i].pos = mat4MulVec4(finalRot, animState.startPositions[i]);
                snapToGrid(animState.cubies[i], N);
                rotateFaceColors(animState.cubies[i].faceColors, animState.planeIdx, animState.direction);
            }
            updateHypercubieMaterials();
            animState = null;
            animating = false;
            updateSolvedPercentage();
        }
    } catch (err) {
        console.error("Animation error:", err);
        animState = null;
        animating = false;
    }
}

/* ═══════════════════════════════════════════════════════════════
   §7  SOLVED % & WIN DETECTION
   ═══════════════════════════════════════════════════════════════ */

let gameStarted = false;

function updateSolvedPercentage() {
    const solved = countSolved(hypercubies);
    const pct = Math.round((solved / hypercubies.length) * 100);
    document.getElementById("hud-pct").textContent = pct + "%";
    document.getElementById("hud-bar").style.width = pct + "%";

    if (pct === 100 && gameStarted && moveCount > 0) {
        stopTimer();
        showWinModal();
    }
}

/* ═══════════════════════════════════════════════════════════════
   §8  SCRAMBLE (wrapper)
   ═══════════════════════════════════════════════════════════════ */

function scramble(numMoves = 20) {
    if (animating) return;
    engineScramble(hypercubies, N, numMoves);
    updateHypercubieMaterials();
    updateSolvedPercentage();
}

/* ═══════════════════════════════════════════════════════════════
   §9  KEYBOARD INPUT
   ═══════════════════════════════════════════════════════════════ */

function setupKeyboard() {
    window.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        const shift = e.shiftKey;
        const dir = shift ? -1 : 1;

        const planeMap = { q: 0, w: 1, e: 2, a: 3, s: 4, d: 5 };
        if (planeMap[key] !== undefined) {
            e.preventDefault();
            if (!animating) {
                executeMove(currentSliceAxis, currentSliceIndex, planeMap[key], dir);
            }
            return;
        }

        if (key >= "1" && key <= "5") {
            const idx = parseInt(key) - 1;
            if (idx < N) {
                currentSliceIndex = idx;
                document.getElementById("slice-idx").textContent = idx;
            }
            return;
        }

        if (key === "x") {
            currentSliceAxis = (currentSliceAxis + 1) % 4;
            currentSliceIndex = Math.min(currentSliceIndex, N - 1);
            document.getElementById("slice-axis").textContent = AXIS_NAMES[currentSliceAxis];
            updateValidKeysDisplay();
            return;
        }
        if (key === "z") {
            currentSliceAxis = (currentSliceAxis + 3) % 4;
            currentSliceIndex = Math.min(currentSliceIndex, N - 1);
            document.getElementById("slice-axis").textContent = AXIS_NAMES[currentSliceAxis];
            updateValidKeysDisplay();
            return;
        }

        if (key === "r" && !animating) {
            scramble(N * N * 10);
            return;
        }

        if (key === "h") {
            toggleLegend();
            return;
        }
    }, true);
}

function toggleLegend() {
    document.getElementById("controls-panel").classList.toggle("visible");
}

let toastTimer = null;
function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1500);
}

function updateValidKeysDisplay() {
    const keyNames = ["Q", "W", "E", "A", "S", "D"];
    const validPlanes = VALID_PLANES[currentSliceAxis];
    const container = document.getElementById("valid-keys-display");
    container.textContent = "";
    for (const p of validPlanes) {
        const kbd = document.createElement("kbd");
        kbd.textContent = keyNames[p];
        container.appendChild(kbd);
    }
}

/* ═══════════════════════════════════════════════════════════════
   §10 HINT SYSTEM
   ═══════════════════════════════════════════════════════════════ */

const ANIMAL_TRIVIA = [
    { q: "What is the fastest land animal?", choices: ["Cheetah", "Pronghorn", "Lion", "Greyhound"], answer: 0 },
    { q: "How many hearts does an octopus have?", choices: ["One", "Two", "Three", "Four"], answer: 2 },
    { q: "What is a group of flamingos called?", choices: ["A flock", "A flamboyance", "A colony", "A parade"], answer: 1 },
    { q: "Which animal has the longest lifespan?", choices: ["Elephant", "Gal\u00e1pagos tortoise", "Bowhead whale", "Greenland shark"], answer: 3 },
    { q: "What animal can sleep for up to 3 years?", choices: ["Sloth", "Snail", "Koala", "Cat"], answer: 1 },
    { q: "How many stomachs does a cow have?", choices: ["One", "Two", "Three", "Four"], answer: 3 },
    { q: "What is the only mammal that can fly?", choices: ["Flying squirrel", "Sugar glider", "Bat", "Colugo"], answer: 2 },
    { q: "Which bird is known to mimic human speech?", choices: ["Crow", "Parrot", "Mynah", "All of these"], answer: 3 },
    { q: "What animal has the highest blood pressure?", choices: ["Elephant", "Giraffe", "Blue whale", "Horse"], answer: 1 },
    { q: "How many legs does a lobster have?", choices: ["Six", "Eight", "Ten", "Twelve"], answer: 2 },
    { q: "Which sea creature has no brain, heart, or blood?", choices: ["Sea cucumber", "Jellyfish", "Starfish", "Coral"], answer: 1 },
    { q: "What is a baby kangaroo called?", choices: ["Cub", "Kit", "Joey", "Pup"], answer: 2 },
    { q: "Which animal produces the loudest sound?", choices: ["Howler monkey", "Blue whale", "Sperm whale", "Elephant"], answer: 2 },
    { q: "How long is an elephant's pregnancy?", choices: ["12 months", "18 months", "22 months", "24 months"], answer: 2 },
    { q: "What color is a polar bear's skin?", choices: ["White", "Pink", "Black", "Grey"], answer: 2 },
    { q: "Which animal never sleeps?", choices: ["Dolphin", "Bullfrog", "Shark", "Ant"], answer: 1 },
    { q: "How many noses does a slug have?", choices: ["One", "Two", "Three", "Four"], answer: 3 },
    { q: "What is the smallest mammal in the world?", choices: ["Pygmy mouse", "Bumblebee bat", "Etruscan shrew", "Hamster"], answer: 1 },
    { q: "Which animal's fingerprints are nearly identical to humans?", choices: ["Chimpanzee", "Gorilla", "Koala", "Orangutan"], answer: 2 },
    { q: "What percentage of a cat's life is spent sleeping?", choices: ["30%", "50%", "70%", "90%"], answer: 2 },
];

let pendingHint = null;

function findBestHintMove() {
    let currentSolved = countSolved(hypercubies);
    if (currentSolved === hypercubies.length) return null;

    let bestMove = null;
    let bestDelta = 0;

    for (let axis = 0; axis < 4; axis++) {
        for (let sliceIdx = 0; sliceIdx < N; sliceIdx++) {
            const sliceCubies = getSlice(axis, sliceIdx);
            if (sliceCubies.length === 0) continue;

            const validPlanes = VALID_PLANES[axis];
            for (const planeIdx of validPlanes) {
                for (const direction of [1, -1]) {
                    const angle = direction * Math.PI / 2;
                    const rotMatrix = ROTATION_BUILDERS[planeIdx](angle);

                    const saved = sliceCubies.map(hc => vec4Copy(hc.pos));
                    const savedColors = sliceCubies.map(hc => hc.faceColors.slice());
                    applyRotationToSlice(sliceCubies, rotMatrix, planeIdx, direction);
                    let newSolved = countSolved(hypercubies);
                    for (let i = 0; i < sliceCubies.length; i++) {
                        sliceCubies[i].pos = saved[i];
                        sliceCubies[i].faceColors = savedColors[i];
                    }

                    const delta = newSolved - currentSolved;
                    if (delta > bestDelta) {
                        bestDelta = delta;
                        bestMove = { axis, sliceIdx, planeIdx, direction };
                    }
                }
            }
        }
    }

    if (!bestMove) {
        const axis = Math.floor(Math.random() * 4);
        const sliceIdx = Math.floor(Math.random() * N);
        const validPlanes = VALID_PLANES[axis];
        const planeIdx = validPlanes[Math.floor(Math.random() * validPlanes.length)];
        const direction = Math.random() < 0.5 ? 1 : -1;
        bestMove = { axis, sliceIdx, planeIdx, direction };
    }

    return bestMove;
}

function openHintModal() {
    if (animating) return;

    const trivia = ANIMAL_TRIVIA[Math.floor(Math.random() * ANIMAL_TRIVIA.length)];
    pendingHint = findBestHintMove();

    const modal = document.getElementById("hint-modal");
    const qEl = document.getElementById("hint-question");
    const choicesEl = document.getElementById("hint-choices");
    const resultEl = document.getElementById("hint-result");
    const dismissBtn = document.getElementById("hint-dismiss");

    qEl.textContent = trivia.q;
    choicesEl.innerHTML = "";
    resultEl.className = "hint-result";
    resultEl.textContent = "";
    dismissBtn.className = "hint-dismiss";

    trivia.choices.forEach((text, idx) => {
        const btn = document.createElement("button");
        btn.className = "hint-choice";
        btn.textContent = text;
        btn.addEventListener("click", () => {
            const allBtns = choicesEl.querySelectorAll(".hint-choice");
            allBtns.forEach((b, i) => {
                if (i === trivia.answer) b.classList.add("correct");
                else b.classList.add("wrong");
            });

            if (idx === trivia.answer) {
                resultEl.className = "hint-result shown success";
                if (pendingHint) {
                    resultEl.textContent = "";
                    resultEl.appendChild(document.createTextNode("\u2705 Correct! Here\u2019s your hint:"));
                    resultEl.appendChild(document.createElement("br"));
                    const strong = document.createElement("strong");
                    strong.textContent = formatHint(pendingHint);
                    resultEl.appendChild(strong);
                } else {
                    resultEl.textContent = "\u2705 Correct! The puzzle is already solved!";
                }
            } else {
                resultEl.className = "hint-result shown fail";
                resultEl.textContent = "\u274c Wrong! The correct answer was: " + trivia.choices[trivia.answer] + ". No hint this time.";
                pendingHint = null;
            }
            dismissBtn.className = "hint-dismiss shown";
        });
        choicesEl.appendChild(btn);
    });

    modal.classList.add("visible");

    dismissBtn.onclick = () => {
        modal.classList.remove("visible");
        pendingHint = null;
    };
}

let hintSetup = false;

function setupHintButton() {
    if (hintSetup) return;
    hintSetup = true;
    document.getElementById("hint-btn").addEventListener("click", openHintModal);

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.getElementById("hint-modal").classList.contains("visible")) {
            document.getElementById("hint-modal").classList.remove("visible");
            pendingHint = null;
        }
    });
}

/* ═══════════════════════════════════════════════════════════════
   §11 TIMER
   ═══════════════════════════════════════════════════════════════ */

function startTimer() {
    startTime = performance.now();
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((performance.now() - startTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const secs = String(elapsed % 60).padStart(2, "0");
        document.getElementById("hud-time").textContent = `${mins}:${secs}`;
    }, 500);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function showWinModal() {
    gameStarted = false;
    const elapsed = Math.floor((performance.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    const stats = document.getElementById("win-stats");
    stats.textContent = `${moveCount} moves in ${mins}:${secs}`;
    document.getElementById("win-modal").classList.add("visible");
}

/* ═══════════════════════════════════════════════════════════════
   §12  AUTO-ROTATION
   ═══════════════════════════════════════════════════════════════ */

const AUTO_ROTATE_SPEED = 0.0007;
let autoRotAngle = 0;

function autoRotateWireframe(dt) {
    autoRotAngle += AUTO_ROTATE_SPEED * dt;
}

/* ═══════════════════════════════════════════════════════════════
   §13  RENDER LOOP
   ═══════════════════════════════════════════════════════════════ */

let lastFrameTime = 0;

function renderLoop(time) {
    requestAnimationFrame(renderLoop);
    const dt = lastFrameTime ? time - lastFrameTime : 16;
    lastFrameTime = time;

    tickAnimation(dt);
    autoRotateWireframe(dt);
    updateWireframe();
    updateHypercubiePositions();
    controls.update();
    renderer.render(scene, camera);
}

/* ═══════════════════════════════════════════════════════════════
   §14  BOOT
   ═══════════════════════════════════════════════════════════════ */

function boot() {
    initThreeJS();
    setupKeyboard();

    const modal = document.getElementById("start-modal");
    const btn = document.getElementById("init-btn");
    const input = document.getElementById("grid-size");

    btn.addEventListener("click", () => {
        let val = parseInt(input.value, 10);
        if (isNaN(val) || val < 2) val = 2;
        if (val > 5) val = 5;
        N = val;

        modal.classList.add("hidden");
        document.getElementById("hud").classList.add("visible");
        document.getElementById("controls-panel").classList.add("visible");
        document.getElementById("slice-panel").classList.add("visible");
        document.getElementById("legend-toggle").classList.add("visible");
        document.getElementById("hint-btn").classList.add("visible");

        document.getElementById("legend-toggle").addEventListener("click", toggleLegend);
        setupHintButton();

        // Show mobile controls on touch devices
        if (isTouchDevice() || window.innerWidth <= 768) {
            document.getElementById("mobile-controls").classList.add("visible");
        }
        setupMobileControls();

        const wf = engineGenerateWireframe(N);
        wireVertices4D = wf.vertices;
        wireEdges = wf.edges;
        hypercubies = engineGenerateHypercubies(N);

        buildWireframeMesh();
        buildHypercubieMeshes();

        scramble(N * N * 10);

        updateWireframe();
        updateHypercubiePositions();
        updateSolvedPercentage();

        currentSliceAxis = 0;
        currentSliceIndex = 0;
        moveCount = 0;
        document.getElementById("hud-moves").textContent = "0";
        document.getElementById("slice-axis").textContent = "X";
        document.getElementById("slice-idx").textContent = "0";
        updateValidKeysDisplay();

        gameStarted = true;
        startTimer();
        requestAnimationFrame(renderLoop);
    });

    document.getElementById("new-game-btn").addEventListener("click", () => {
        location.reload();
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") btn.click();
    });
}

/* ═══════════════════════════════════════════════════════════════
   §15  MOBILE TOUCH CONTROLS
   ═══════════════════════════════════════════════════════════════ */

let mobileDirection = 1; // +1 = CW, -1 = CCW

function isTouchDevice() {
    return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
}

function setupMobileControls() {
    const panel = document.getElementById("mobile-controls");
    if (!panel) return;

    // Build slice buttons for current N
    rebuildMobileSliceBtns();

    // Axis buttons
    panel.querySelectorAll("[data-maxis]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const axis = parseInt(btn.dataset.maxis, 10);
            currentSliceAxis = axis;
            currentSliceIndex = Math.min(currentSliceIndex, N - 1);
            document.getElementById("slice-axis").textContent = AXIS_NAMES[axis];
            updateValidKeysDisplay();
            updateMobileAxisHighlight();
            updateMobilePlaneHighlight();
            updateMobileSliceHighlight();
        });
    });

    // Plane rotation buttons
    panel.querySelectorAll("[data-mplane]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const planeIdx = parseInt(btn.dataset.mplane, 10);
            if (!isValidPlane(currentSliceAxis, planeIdx)) {
                showToast(PLANE_NAMES[planeIdx] + " invalid for " + AXIS_NAMES[currentSliceAxis] + "-axis");
                return;
            }
            if (!animating) {
                executeMove(currentSliceAxis, currentSliceIndex, planeIdx, mobileDirection);
            }
        });
    });

    // Direction toggle
    document.getElementById("m-dir-btn").addEventListener("click", (e) => {
        e.preventDefault();
        mobileDirection *= -1;
        const btn = document.getElementById("m-dir-btn");
        if (mobileDirection === 1) {
            btn.innerHTML = '<span class="dir-arrow">\u21BB</span>CW';
        } else {
            btn.innerHTML = '<span class="dir-arrow">\u21BA</span>CCW';
        }
    });

    // Action buttons
    document.getElementById("m-scramble").addEventListener("click", (e) => {
        e.preventDefault();
        if (!animating) scramble(N * N * 10);
    });
    document.getElementById("m-hint").addEventListener("click", (e) => {
        e.preventDefault();
        openHintModal();
    });
    document.getElementById("m-legend").addEventListener("click", (e) => {
        e.preventDefault();
        toggleLegend();
    });

    updateMobileAxisHighlight();
    updateMobilePlaneHighlight();
    updateMobileSliceHighlight();
}

function rebuildMobileSliceBtns() {
    const container = document.getElementById("m-slice-btns");
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < N; i++) {
        const btn = document.createElement("button");
        btn.className = "m-btn" + (i === currentSliceIndex ? " active" : "");
        btn.dataset.mslice = String(i);
        btn.textContent = String(i + 1);
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            currentSliceIndex = i;
            document.getElementById("slice-idx").textContent = String(i);
            updateMobileSliceHighlight();
        });
        container.appendChild(btn);
    }
}

function updateMobileAxisHighlight() {
    const panel = document.getElementById("mobile-controls");
    if (!panel) return;
    panel.querySelectorAll("[data-maxis]").forEach(btn => {
        btn.classList.toggle("active", parseInt(btn.dataset.maxis, 10) === currentSliceAxis);
    });
}

function updateMobilePlaneHighlight() {
    const panel = document.getElementById("mobile-controls");
    if (!panel) return;
    const validPlanes = VALID_PLANES[currentSliceAxis];
    panel.querySelectorAll("[data-mplane]").forEach(btn => {
        const p = parseInt(btn.dataset.mplane, 10);
        btn.classList.toggle("disabled", !validPlanes.includes(p));
    });
}

function updateMobileSliceHighlight() {
    const container = document.getElementById("m-slice-btns");
    if (!container) return;
    container.querySelectorAll("[data-mslice]").forEach(btn => {
        btn.classList.toggle("active", parseInt(btn.dataset.mslice, 10) === currentSliceIndex);
    });
}

/* ═══════════════════════════════════════════════════════════════
   §16  ENTRY POINT
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", boot);
})();
