/**
 * TesseractTwist — Pure 4D Puzzle Engine (no DOM / Three.js dependencies)
 *
 * This module contains all testable math, rotation, and puzzle logic
 * extracted from app.js. It works in both Node.js (for unit tests)
 * and the browser (loaded as a script before app.js).
 */

(function () {
"use strict";

/* ═══════════════════════════════════════════════════════════════
   §1  CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const W_CAMERA = 3.0;

const AXIS_NAMES = ["X", "Y", "Z", "W"];

const PLANE_AXES = [
    [0, 1], // XY
    [0, 2], // XZ
    [1, 2], // YZ
    [0, 3], // XW
    [1, 3], // YW
    [2, 3], // ZW
];

const VALID_PLANES = [
    [2, 4, 5], // Axis X(0): YZ, YW, ZW
    [1, 3, 5], // Axis Y(1): XZ, XW, ZW
    [0, 3, 4], // Axis Z(2): XY, XW, YW
    [0, 1, 2], // Axis W(3): XY, XZ, YZ
];

const CELL_COLORS = [
    0xff4444, // +X  Red
    0xff8c00, // -X  Orange
    0x44ee66, // +Y  Green
    0x8877ff, // -Y  Indigo
    0x2299ff, // +Z  Blue
    0xffe333, // -Z  Yellow
    0xcc55ff, // +W  Purple
    0x00eebb, // -W  Teal
];

const FACE_PERM_CW = [
    [3, 2, 0, 1, 4, 5, 6, 7], // XY
    [5, 4, 2, 3, 0, 1, 6, 7], // XZ
    [0, 1, 5, 4, 2, 3, 6, 7], // YZ
    [7, 6, 2, 3, 4, 5, 0, 1], // XW
    [0, 1, 7, 6, 4, 5, 2, 3], // YW
    [0, 1, 2, 3, 7, 6, 4, 5], // ZW
];

const FACE_PERM_CCW = FACE_PERM_CW.map(perm => {
    const inv = new Array(8);
    for (let i = 0; i < 8; i++) inv[perm[i]] = i;
    return inv;
});

const PLANE_NAMES = ["XY", "XZ", "YZ", "XW", "YW", "ZW"];

const ANIM_DURATION = 350;

/* ═══════════════════════════════════════════════════════════════
   §2  4D MATH
   ═══════════════════════════════════════════════════════════════ */

function vec4(x, y, z, w) {
    return [x, y, z, w];
}

function vec4Copy(v) {
    return [v[0], v[1], v[2], v[3]];
}

function vec4Equals(a, b, eps = 1e-6) {
    return Math.abs(a[0] - b[0]) < eps &&
           Math.abs(a[1] - b[1]) < eps &&
           Math.abs(a[2] - b[2]) < eps &&
           Math.abs(a[3] - b[3]) < eps;
}

function mat4Identity() {
    const m = new Float64Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

function mat4MulVec4(M, v) {
    return [
        M[0]  * v[0] + M[1]  * v[1] + M[2]  * v[2] + M[3]  * v[3],
        M[4]  * v[0] + M[5]  * v[1] + M[6]  * v[2] + M[7]  * v[3],
        M[8]  * v[0] + M[9]  * v[1] + M[10] * v[2] + M[11] * v[3],
        M[12] * v[0] + M[13] * v[1] + M[14] * v[2] + M[15] * v[3],
    ];
}

/* ═══════════════════════════════════════════════════════════════
   §3  ROTATION MATRICES
   ═══════════════════════════════════════════════════════════════ */

function rotXY(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const m = mat4Identity();
    m[0] = c;  m[1] = -s;
    m[4] = s;  m[5] = c;
    return m;
}

function rotXZ(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const m = mat4Identity();
    m[0] = c;   m[2] = -s;
    m[8] = s;   m[10] = c;
    return m;
}

function rotYZ(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const m = mat4Identity();
    m[5] = c;   m[6] = -s;
    m[9] = s;   m[10] = c;
    return m;
}

function rotXW(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const m = mat4Identity();
    m[0] = c;   m[3] = -s;
    m[12] = s;  m[15] = c;
    return m;
}

function rotYW(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const m = mat4Identity();
    m[5] = c;   m[7] = -s;
    m[13] = s;  m[15] = c;
    return m;
}

function rotZW(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const m = mat4Identity();
    m[10] = c;  m[11] = -s;
    m[14] = s;  m[15] = c;
    return m;
}

const ROTATION_BUILDERS = [rotXY, rotXZ, rotYZ, rotXW, rotYW, rotZW];

/* ═══════════════════════════════════════════════════════════════
   §4  STEREOGRAPHIC PROJECTION
   ═══════════════════════════════════════════════════════════════ */

function project4Dto3D(point4D) {
    const [x, y, z, w] = point4D;
    const denom = Math.max(W_CAMERA - w, 0.01);
    const scale = W_CAMERA / denom;
    return { x: x * scale, y: y * scale, z: z * scale };
}

/* ═══════════════════════════════════════════════════════════════
   §5  PLANE VALIDATION
   ═══════════════════════════════════════════════════════════════ */

function isValidPlane(axis, planeIdx) {
    return VALID_PLANES[axis].includes(planeIdx);
}

/* ═══════════════════════════════════════════════════════════════
   §6  FACE COLOR ROTATION
   ═══════════════════════════════════════════════════════════════ */

function rotateFaceColors(faceColors, planeIdx, direction) {
    const perm = direction > 0 ? FACE_PERM_CW[planeIdx] : FACE_PERM_CCW[planeIdx];
    const old = faceColors.slice();
    for (let i = 0; i < 8; i++) {
        faceColors[i] = old[perm[i]];
    }
}

/* ═══════════════════════════════════════════════════════════════
   §7  HYPERCUBIE
   ═══════════════════════════════════════════════════════════════ */

class Hypercubie {
    constructor(center, faceColors) {
        this.pos = vec4Copy(center);
        this.home = vec4Copy(center);
        this.faceColors = faceColors;
        this.homeFaceColors = faceColors.slice();
        this.mesh = null;
    }

    isSolved() {
        if (!vec4Equals(this.pos, this.home, 0.05)) return false;
        for (let i = 0; i < 8; i++) {
            if (this.faceColors[i] !== this.homeFaceColors[i]) return false;
        }
        return true;
    }
}

/* ═══════════════════════════════════════════════════════════════
   §8  PUZZLE OPERATIONS
   ═══════════════════════════════════════════════════════════════ */

function sliceCenterValue(index, N) {
    return -1 + (2 * index + 1) / N;
}

function getSlice(hypercubies, axis, index, N) {
    const target = sliceCenterValue(index, N);
    return hypercubies.filter(hc => Math.abs(hc.pos[axis] - target) < 0.05);
}

function snapToGrid(hc, N) {
    for (let i = 0; i < 4; i++) {
        let bestDist = Infinity;
        let bestVal = hc.pos[i];
        for (let idx = 0; idx < N; idx++) {
            const val = sliceCenterValue(idx, N);
            const dist = Math.abs(hc.pos[i] - val);
            if (dist < bestDist) {
                bestDist = dist;
                bestVal = val;
            }
        }
        hc.pos[i] = bestVal;
    }
}

function applyRotationToSlice(cubies, rotMatrix, planeIdx, direction, N) {
    for (const hc of cubies) {
        hc.pos = mat4MulVec4(rotMatrix, hc.pos);
        snapToGrid(hc, N);
        rotateFaceColors(hc.faceColors, planeIdx, direction);
    }
}

function generateHypercubies(N) {
    const result = [];
    for (let ix = 0; ix < N; ix++) {
        for (let iy = 0; iy < N; iy++) {
            for (let iz = 0; iz < N; iz++) {
                for (let iw = 0; iw < N; iw++) {
                    const cx = -1 + (2 * ix + 1) / N;
                    const cy = -1 + (2 * iy + 1) / N;
                    const cz = -1 + (2 * iz + 1) / N;
                    const cw = -1 + (2 * iw + 1) / N;
                    const center = vec4(cx, cy, cz, cw);

                    const fc = [null, null, null, null, null, null, null, null];
                    if (ix === N - 1) fc[0] = CELL_COLORS[0];
                    if (ix === 0)     fc[1] = CELL_COLORS[1];
                    if (iy === N - 1) fc[2] = CELL_COLORS[2];
                    if (iy === 0)     fc[3] = CELL_COLORS[3];
                    if (iz === N - 1) fc[4] = CELL_COLORS[4];
                    if (iz === 0)     fc[5] = CELL_COLORS[5];
                    if (iw === N - 1) fc[6] = CELL_COLORS[6];
                    if (iw === 0)     fc[7] = CELL_COLORS[7];

                    result.push(new Hypercubie(center, fc));
                }
            }
        }
    }
    return result;
}

function generateWireframe(N) {
    const vertices = [];
    const edges = [];
    const steps = N;
    const coord = (i) => -1 + (2 * i) / steps;
    const idxMap = {};
    const key = (ix, iy, iz, iw) => `${ix},${iy},${iz},${iw}`;

    for (let ix = 0; ix <= steps; ix++) {
        for (let iy = 0; iy <= steps; iy++) {
            for (let iz = 0; iz <= steps; iz++) {
                for (let iw = 0; iw <= steps; iw++) {
                    const idx = vertices.length;
                    vertices.push(vec4(coord(ix), coord(iy), coord(iz), coord(iw)));
                    idxMap[key(ix, iy, iz, iw)] = idx;
                }
            }
        }
    }

    for (let ix = 0; ix <= steps; ix++) {
        for (let iy = 0; iy <= steps; iy++) {
            for (let iz = 0; iz <= steps; iz++) {
                for (let iw = 0; iw <= steps; iw++) {
                    const cur = idxMap[key(ix, iy, iz, iw)];
                    if (ix < steps) edges.push([cur, idxMap[key(ix + 1, iy, iz, iw)]]);
                    if (iy < steps) edges.push([cur, idxMap[key(ix, iy + 1, iz, iw)]]);
                    if (iz < steps) edges.push([cur, idxMap[key(ix, iy, iz + 1, iw)]]);
                    if (iw < steps) edges.push([cur, idxMap[key(ix, iy, iz, iw + 1)]]);
                }
            }
        }
    }

    return { vertices, edges };
}

function scramble(hypercubies, N, numMoves = 20) {
    for (let i = 0; i < numMoves; i++) {
        const axis = Math.floor(Math.random() * 4);
        const sliceIdx = Math.floor(Math.random() * N);
        const validPlanes = VALID_PLANES[axis];
        const planeIdx = validPlanes[Math.floor(Math.random() * validPlanes.length)];
        const direction = Math.random() < 0.5 ? 1 : -1;
        const angle = direction * Math.PI / 2;
        const rotMatrix = ROTATION_BUILDERS[planeIdx](angle);
        const sliceCubies = getSlice(hypercubies, axis, sliceIdx, N);
        applyRotationToSlice(sliceCubies, rotMatrix, planeIdx, direction, N);
    }
}

function countSolved(hypercubies) {
    let count = 0;
    for (const hc of hypercubies) {
        if (hc.isSolved()) count++;
    }
    return count;
}

function formatHint(move) {
    const axisName = AXIS_NAMES[move.axis];
    const planeName = PLANE_NAMES[move.planeIdx];
    const dirLabel = move.direction > 0 ? "+90\u00b0" : "\u221290\u00b0";
    const keyMap = ["Q", "W", "E", "A", "S", "D"];
    const key = keyMap[move.planeIdx];
    const shiftPrefix = move.direction < 0 ? "Shift + " : "";
    return `Set axis to ${axisName} \u2192 slice ${move.sliceIdx} \u2192 press ${shiftPrefix}${key} (${planeName} ${dirLabel})`;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS — available in Node.js; global in browser
   ═══════════════════════════════════════════════════════════════ */

const TesseractEngine = {
    // Constants
    W_CAMERA, AXIS_NAMES, PLANE_AXES, VALID_PLANES, CELL_COLORS,
    FACE_PERM_CW, FACE_PERM_CCW, PLANE_NAMES, ANIM_DURATION,
    ROTATION_BUILDERS,
    // Math
    vec4, vec4Copy, vec4Equals, mat4Identity, mat4MulVec4,
    // Rotations
    rotXY, rotXZ, rotYZ, rotXW, rotYW, rotZW,
    // Projection
    project4Dto3D,
    // Validation
    isValidPlane,
    // Face colors
    rotateFaceColors,
    // Classes
    Hypercubie,
    // Puzzle ops
    sliceCenterValue, getSlice, snapToGrid, applyRotationToSlice,
    generateHypercubies, generateWireframe, scramble, countSolved,
    formatHint,
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = TesseractEngine;
} else if (typeof window !== "undefined") {
    window.TesseractEngine = TesseractEngine;
}
})();
