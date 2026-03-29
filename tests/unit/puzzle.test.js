/**
 * Unit tests for TesseractEngine — Puzzle Logic
 *
 * Covers: isValidPlane, rotateFaceColors, Hypercubie, sliceCenterValue,
 *         getSlice, snapToGrid, applyRotationToSlice, generateHypercubies,
 *         generateWireframe, scramble, countSolved, formatHint, VALID_PLANES,
 *         FACE_PERM_CW/CCW symmetry
 */

const E = require("../../src/engine");

describe("isValidPlane", () => {
    test("each axis has exactly 3 valid planes", () => {
        for (let axis = 0; axis < 4; axis++) {
            const count = [0, 1, 2, 3, 4, 5].filter(p => E.isValidPlane(axis, p)).length;
            expect(count).toBe(3);
        }
    });

    test("X-axis allows YZ(2), YW(4), ZW(5) and blocks XY(0), XZ(1), XW(3)", () => {
        expect(E.isValidPlane(0, 2)).toBe(true);
        expect(E.isValidPlane(0, 4)).toBe(true);
        expect(E.isValidPlane(0, 5)).toBe(true);
        expect(E.isValidPlane(0, 0)).toBe(false);
        expect(E.isValidPlane(0, 1)).toBe(false);
        expect(E.isValidPlane(0, 3)).toBe(false);
    });

    test("no plane is valid for both axes it mixes", () => {
        for (let p = 0; p < 6; p++) {
            const [a1, a2] = E.PLANE_AXES[p];
            expect(E.isValidPlane(a1, p)).toBe(false);
            expect(E.isValidPlane(a2, p)).toBe(false);
        }
    });
});

describe("FACE_PERM symmetry", () => {
    test("CCW is the inverse of CW for every plane", () => {
        for (let p = 0; p < 6; p++) {
            const cw = E.FACE_PERM_CW[p];
            const ccw = E.FACE_PERM_CCW[p];
            // Applying CW then CCW should be identity
            for (let i = 0; i < 8; i++) {
                expect(ccw[cw[i]]).toBe(i);
            }
        }
    });

    test("CW permutation applied 4 times is identity", () => {
        for (let p = 0; p < 6; p++) {
            const perm = E.FACE_PERM_CW[p];
            for (let i = 0; i < 8; i++) {
                let val = i;
                for (let j = 0; j < 4; j++) val = perm[val];
                expect(val).toBe(i);
            }
        }
    });

    test("each CW permutation is a valid permutation (bijection)", () => {
        for (let p = 0; p < 6; p++) {
            const perm = E.FACE_PERM_CW[p];
            expect([...perm].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        }
    });
});

describe("rotateFaceColors", () => {
    test("CW then CCW restores original colors", () => {
        const colors = [10, 20, 30, 40, 50, 60, 70, 80];
        const original = colors.slice();
        E.rotateFaceColors(colors, 0, 1);  // CW
        E.rotateFaceColors(colors, 0, -1); // CCW
        expect(colors).toEqual(original);
    });

    test("4 CW rotations restore original colors", () => {
        for (let plane = 0; plane < 6; plane++) {
            const colors = [1, 2, 3, 4, 5, 6, 7, 8];
            const original = colors.slice();
            for (let i = 0; i < 4; i++) E.rotateFaceColors(colors, plane, 1);
            expect(colors).toEqual(original);
        }
    });

    test("XY CW rotation permutes correctly: +x→+y means fc[2] gets old fc[0]", () => {
        // XY plane CW: perm = [3,2,0,1,4,5,6,7]
        // new[i] = old[perm[i]], so new[0]=old[3], new[1]=old[2], new[2]=old[0], new[3]=old[1]
        const colors = [100, 200, 300, 400, 500, 600, 700, 800];
        E.rotateFaceColors(colors, 0, 1); // XY CW
        expect(colors[0]).toBe(400); // new[0] = old[3] (-y)
        expect(colors[1]).toBe(300); // new[1] = old[2] (+y)
        expect(colors[2]).toBe(100); // new[2] = old[0] (+x)
        expect(colors[3]).toBe(200); // new[3] = old[1] (-x)
        expect(colors[4]).toBe(500); // Z unchanged
        expect(colors[5]).toBe(600);
        expect(colors[6]).toBe(700); // W unchanged
        expect(colors[7]).toBe(800);
    });
});

describe("Hypercubie", () => {
    test("constructor sets pos, home, faceColors, homeFaceColors", () => {
        const center = [1, 2, 3, 4];
        const fc = [10, 20, null, null, null, null, null, null];
        const hc = new E.Hypercubie(center, fc);
        expect(hc.pos).toEqual(center);
        expect(hc.home).toEqual(center);
        expect(hc.pos).not.toBe(center); // copied
        expect(hc.faceColors).toBe(fc);
        expect(hc.homeFaceColors).toEqual(fc);
        expect(hc.homeFaceColors).not.toBe(fc);
    });

    test("isSolved returns true when pos equals home and colors match", () => {
        const hc = new E.Hypercubie([0.5, 0.5, 0.5, 0.5], [1, null, null, null, null, null, null, null]);
        expect(hc.isSolved()).toBe(true);
    });

    test("isSolved returns false when pos differs", () => {
        const hc = new E.Hypercubie([0.5, 0.5, 0.5, 0.5], [1, null, null, null, null, null, null, null]);
        hc.pos = [-0.5, 0.5, 0.5, 0.5];
        expect(hc.isSolved()).toBe(false);
    });

    test("isSolved returns false when colors differ", () => {
        const hc = new E.Hypercubie([0.5, 0.5, 0.5, 0.5], [1, null, null, null, null, null, null, null]);
        hc.faceColors[0] = 999;
        expect(hc.isSolved()).toBe(false);
    });
});

describe("sliceCenterValue", () => {
    test("N=2: indices 0,1 give -0.5 and +0.5", () => {
        expect(E.sliceCenterValue(0, 2)).toBeCloseTo(-0.5);
        expect(E.sliceCenterValue(1, 2)).toBeCloseTo(0.5);
    });

    test("N=3: indices 0,1,2 give -2/3, 0, +2/3", () => {
        expect(E.sliceCenterValue(0, 3)).toBeCloseTo(-2 / 3);
        expect(E.sliceCenterValue(1, 3)).toBeCloseTo(0);
        expect(E.sliceCenterValue(2, 3)).toBeCloseTo(2 / 3);
    });

    test("N=1: index 0 gives 0", () => {
        expect(E.sliceCenterValue(0, 1)).toBeCloseTo(0);
    });
});

describe("generateHypercubies", () => {
    test("N=2 produces 16 hypercubies", () => {
        const hc = E.generateHypercubies(2);
        expect(hc.length).toBe(16);
    });

    test("N=3 produces 81 hypercubies", () => {
        const hc = E.generateHypercubies(3);
        expect(hc.length).toBe(81);
    });

    test("all start solved", () => {
        const hc = E.generateHypercubies(2);
        expect(E.countSolved(hc)).toBe(16);
    });

    test("corner pieces have 4 colored faces", () => {
        const cubies = E.generateHypercubies(2);
        // For N=2 every piece is a corner → every piece should have at least 4 non-null face colors
        for (const hc of cubies) {
            const coloredCount = hc.faceColors.filter(c => c !== null).length;
            expect(coloredCount).toBe(4);
        }
    });

    test("center coords are at half-step offsets", () => {
        const cubies = E.generateHypercubies(2);
        for (const hc of cubies) {
            for (let i = 0; i < 4; i++) {
                expect(Math.abs(hc.pos[i])).toBeCloseTo(0.5);
            }
        }
    });
});

describe("generateWireframe", () => {
    test("N=2 produces (2+1)^4 = 81 vertices", () => {
        const wf = E.generateWireframe(2);
        expect(wf.vertices.length).toBe(81);
    });

    test("N=1 produces (1+1)^4 = 16 vertices", () => {
        const wf = E.generateWireframe(1);
        expect(wf.vertices.length).toBe(16);
    });

    test("all vertices are within [-1, 1] on all axes", () => {
        const wf = E.generateWireframe(3);
        for (const v of wf.vertices) {
            for (let i = 0; i < 4; i++) {
                expect(v[i]).toBeGreaterThanOrEqual(-1 - 1e-10);
                expect(v[i]).toBeLessThanOrEqual(1 + 1e-10);
            }
        }
    });

    test("edges reference valid vertex indices", () => {
        const wf = E.generateWireframe(2);
        for (const [a, b] of wf.edges) {
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThan(wf.vertices.length);
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThan(wf.vertices.length);
        }
    });

    test("edge count formula: 4 * N * (N+1)^3", () => {
        for (const n of [1, 2, 3]) {
            const wf = E.generateWireframe(n);
            const expected = 4 * n * Math.pow(n + 1, 3);
            expect(wf.edges.length).toBe(expected);
        }
    });
});

describe("getSlice", () => {
    test("N=2: each axis/index combo yields exactly N^3 = 8 cubies", () => {
        const cubies = E.generateHypercubies(2);
        for (let axis = 0; axis < 4; axis++) {
            for (let idx = 0; idx < 2; idx++) {
                const slice = E.getSlice(cubies, axis, idx, 2);
                expect(slice.length).toBe(8);
            }
        }
    });

    test("slices partition all cubies (no overlap, full coverage per axis)", () => {
        const cubies = E.generateHypercubies(3);
        for (let axis = 0; axis < 4; axis++) {
            const ids = new Set();
            for (let idx = 0; idx < 3; idx++) {
                const slice = E.getSlice(cubies, axis, idx, 3);
                for (const hc of slice) {
                    const key = hc.pos.toString();
                    expect(ids.has(key)).toBe(false);
                    ids.add(key);
                }
            }
            expect(ids.size).toBe(81);
        }
    });
});

describe("snapToGrid", () => {
    test("snaps a close position to nearest grid center", () => {
        const hc = new E.Hypercubie([0.501, -0.499, 0.5, -0.5], [null, null, null, null, null, null, null, null]);
        E.snapToGrid(hc, 2);
        expect(hc.pos[0]).toBeCloseTo(0.5);
        expect(hc.pos[1]).toBeCloseTo(-0.5);
        expect(hc.pos[2]).toBeCloseTo(0.5);
        expect(hc.pos[3]).toBeCloseTo(-0.5);
    });
});

describe("applyRotationToSlice", () => {
    test("rotating a slice does not change piece count", () => {
        const cubies = E.generateHypercubies(2);
        const slice = E.getSlice(cubies, 0, 0, 2);
        const initialLen = slice.length;
        const rot = E.rotYZ(Math.PI / 2); // Valid for X-axis
        E.applyRotationToSlice(slice, rot, 2, 1, 2);
        expect(E.getSlice(cubies, 0, 0, 2).length + E.getSlice(cubies, 0, 1, 2).length).toBe(16);
    });

    test("applying rotation and inverse returns to start", () => {
        const cubies = E.generateHypercubies(2);
        const original = cubies.map(hc => ({ pos: E.vec4Copy(hc.pos), fc: hc.faceColors.slice() }));

        const slice = E.getSlice(cubies, 0, 0, 2);
        const rot = E.rotYZ(Math.PI / 2);
        E.applyRotationToSlice(slice, rot, 2, 1, 2);

        const slice2 = E.getSlice(cubies, 0, 0, 2);
        const invRot = E.rotYZ(-Math.PI / 2);
        E.applyRotationToSlice(slice2, invRot, 2, -1, 2);

        for (let i = 0; i < cubies.length; i++) {
            expect(E.vec4Equals(cubies[i].pos, original[i].pos, 0.05)).toBe(true);
            expect(cubies[i].faceColors).toEqual(original[i].fc);
        }
    });
});

describe("scramble", () => {
    test("scramble produces non-solved state", () => {
        const cubies = E.generateHypercubies(2);
        E.scramble(cubies, 2, 40);
        const solved = E.countSolved(cubies);
        // Extremely unlikely all 16 are still solved after 40 random moves
        expect(solved).toBeLessThan(16);
    });

    test("scramble preserves piece count", () => {
        const cubies = E.generateHypercubies(2);
        E.scramble(cubies, 2, 20);
        expect(cubies.length).toBe(16);
    });

    test("all positions remain valid grid centers after scramble", () => {
        const cubies = E.generateHypercubies(3);
        E.scramble(cubies, 3, 50);
        const validCenters = [E.sliceCenterValue(0, 3), E.sliceCenterValue(1, 3), E.sliceCenterValue(2, 3)];
        for (const hc of cubies) {
            for (let i = 0; i < 4; i++) {
                const closest = validCenters.reduce((best, v) =>
                    Math.abs(hc.pos[i] - v) < Math.abs(hc.pos[i] - best) ? v : best
                );
                expect(hc.pos[i]).toBeCloseTo(closest, 5);
            }
        }
    });
});

describe("countSolved", () => {
    test("unscrambled puzzle is fully solved", () => {
        const cubies = E.generateHypercubies(2);
        expect(E.countSolved(cubies)).toBe(16);
    });

    test("countSolved returns 0-N^4 range", () => {
        const cubies = E.generateHypercubies(2);
        E.scramble(cubies, 2, 20);
        const count = E.countSolved(cubies);
        expect(count).toBeGreaterThanOrEqual(0);
        expect(count).toBeLessThanOrEqual(16);
    });
});

describe("formatHint", () => {
    test("formats a CW hint correctly", () => {
        const result = E.formatHint({ axis: 0, sliceIdx: 1, planeIdx: 2, direction: 1 });
        expect(result).toContain("X");
        expect(result).toContain("1");
        expect(result).toContain("E");
        expect(result).toContain("YZ");
        expect(result).toContain("+90");
    });

    test("formats a CCW hint with Shift prefix", () => {
        const result = E.formatHint({ axis: 3, sliceIdx: 0, planeIdx: 0, direction: -1 });
        expect(result).toContain("Shift");
        expect(result).toContain("Q");
        expect(result).toContain("W");   // W axis
        expect(result).toContain("XY");
        expect(result).toContain("\u221290");
    });
});

describe("constants integrity", () => {
    test("CELL_COLORS has 8 entries", () => {
        expect(E.CELL_COLORS.length).toBe(8);
    });

    test("ROTATION_BUILDERS has 6 entries", () => {
        expect(E.ROTATION_BUILDERS.length).toBe(6);
    });

    test("PLANE_NAMES has 6 entries", () => {
        expect(E.PLANE_NAMES.length).toBe(6);
    });

    test("VALID_PLANES has 4 entries of 3 each", () => {
        expect(E.VALID_PLANES.length).toBe(4);
        for (const vp of E.VALID_PLANES) {
            expect(vp.length).toBe(3);
        }
    });
});
