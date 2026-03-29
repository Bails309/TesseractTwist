/**
 * Unit tests for TesseractEngine — 4D Math functions
 *
 * Covers: vec4, vec4Copy, vec4Equals, mat4Identity, mat4MulVec4,
 *         all 6 rotation matrices, project4Dto3D
 */

const E = require("../../src/engine");

describe("vec4", () => {
    test("creates a 4-element array", () => {
        const v = E.vec4(1, 2, 3, 4);
        expect(v).toEqual([1, 2, 3, 4]);
    });

    test("handles zeros", () => {
        expect(E.vec4(0, 0, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    test("handles negative values", () => {
        expect(E.vec4(-1, -2, -3, -4)).toEqual([-1, -2, -3, -4]);
    });
});

describe("vec4Copy", () => {
    test("returns a shallow copy", () => {
        const v = [1, 2, 3, 4];
        const copy = E.vec4Copy(v);
        expect(copy).toEqual(v);
        expect(copy).not.toBe(v); // different reference
    });

    test("mutations to copy don't affect original", () => {
        const v = [1, 2, 3, 4];
        const copy = E.vec4Copy(v);
        copy[0] = 99;
        expect(v[0]).toBe(1);
    });
});

describe("vec4Equals", () => {
    test("identical vectors are equal", () => {
        expect(E.vec4Equals([1, 2, 3, 4], [1, 2, 3, 4])).toBe(true);
    });

    test("slightly different vectors within epsilon are equal", () => {
        expect(E.vec4Equals([1, 2, 3, 4], [1 + 1e-7, 2, 3, 4])).toBe(true);
    });

    test("different vectors are not equal", () => {
        expect(E.vec4Equals([1, 2, 3, 4], [1, 2, 3, 5])).toBe(false);
    });

    test("respects custom epsilon", () => {
        expect(E.vec4Equals([1, 2, 3, 4], [1.01, 2, 3, 4], 0.1)).toBe(true);
        expect(E.vec4Equals([1, 2, 3, 4], [1.01, 2, 3, 4], 0.001)).toBe(false);
    });
});

describe("mat4Identity", () => {
    test("returns a 16-element Float64Array", () => {
        const m = E.mat4Identity();
        expect(m).toBeInstanceOf(Float64Array);
        expect(m.length).toBe(16);
    });

    test("has 1s on diagonal and 0s elsewhere", () => {
        const m = E.mat4Identity();
        for (let i = 0; i < 16; i++) {
            expect(m[i]).toBe(i % 5 === 0 ? 1 : 0);
        }
    });
});

describe("mat4MulVec4", () => {
    test("identity matrix preserves vector", () => {
        const v = [3, 7, -2, 5];
        const result = E.mat4MulVec4(E.mat4Identity(), v);
        expect(result).toEqual(v);
    });

    test("scaling matrix scales all components", () => {
        const m = E.mat4Identity();
        m[0] = 2; m[5] = 3; m[10] = 4; m[15] = 5;
        const result = E.mat4MulVec4(m, [1, 1, 1, 1]);
        expect(result).toEqual([2, 3, 4, 5]);
    });

    test("zero vector yields zero vector", () => {
        const m = E.mat4Identity();
        expect(E.mat4MulVec4(m, [0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    });
});

describe("rotation matrices", () => {
    const PI2 = Math.PI / 2;
    const eps = 1e-10;

    function expectVec4Close(result, expected, tolerance = eps) {
        for (let i = 0; i < 4; i++) {
            expect(result[i]).toBeCloseTo(expected[i], 10);
        }
    }

    describe("rotXY — rotates X and Y, leaves Z and W", () => {
        test("90° sends +X to +Y", () => {
            const m = E.rotXY(PI2);
            expectVec4Close(E.mat4MulVec4(m, [1, 0, 0, 0]), [0, 1, 0, 0]);
        });

        test("90° sends +Y to -X", () => {
            const m = E.rotXY(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 1, 0, 0]), [-1, 0, 0, 0]);
        });

        test("leaves Z unchanged", () => {
            const m = E.rotXY(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 0, 1, 0]), [0, 0, 1, 0]);
        });

        test("leaves W unchanged", () => {
            const m = E.rotXY(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 0, 0, 1]), [0, 0, 0, 1]);
        });

        test("0° is identity", () => {
            const m = E.rotXY(0);
            expectVec4Close(E.mat4MulVec4(m, [1, 2, 3, 4]), [1, 2, 3, 4]);
        });

        test("360° returns to start", () => {
            const m = E.rotXY(2 * Math.PI);
            expectVec4Close(E.mat4MulVec4(m, [1, 2, 3, 4]), [1, 2, 3, 4]);
        });
    });

    describe("rotXZ — rotates X and Z, leaves Y and W", () => {
        test("90° sends +X to +Z", () => {
            const m = E.rotXZ(PI2);
            expectVec4Close(E.mat4MulVec4(m, [1, 0, 0, 0]), [0, 0, 1, 0]);
        });

        test("leaves Y unchanged", () => {
            const m = E.rotXZ(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 1, 0, 0]), [0, 1, 0, 0]);
        });
    });

    describe("rotYZ — rotates Y and Z, leaves X and W", () => {
        test("90° sends +Y to +Z", () => {
            const m = E.rotYZ(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 1, 0, 0]), [0, 0, 1, 0]);
        });

        test("leaves X unchanged", () => {
            const m = E.rotYZ(PI2);
            expectVec4Close(E.mat4MulVec4(m, [1, 0, 0, 0]), [1, 0, 0, 0]);
        });
    });

    describe("rotXW — rotates X and W, leaves Y and Z", () => {
        test("90° sends +X to +W", () => {
            const m = E.rotXW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [1, 0, 0, 0]), [0, 0, 0, 1]);
        });

        test("leaves Y unchanged", () => {
            const m = E.rotXW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 1, 0, 0]), [0, 1, 0, 0]);
        });

        test("leaves Z unchanged", () => {
            const m = E.rotXW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 0, 1, 0]), [0, 0, 1, 0]);
        });
    });

    describe("rotYW — rotates Y and W, leaves X and Z", () => {
        test("90° sends +Y to +W", () => {
            const m = E.rotYW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 1, 0, 0]), [0, 0, 0, 1]);
        });

        test("leaves X unchanged", () => {
            const m = E.rotYW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [1, 0, 0, 0]), [1, 0, 0, 0]);
        });
    });

    describe("rotZW — rotates Z and W, leaves X and Y", () => {
        test("90° sends +Z to +W", () => {
            const m = E.rotZW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 0, 1, 0]), [0, 0, 0, 1]);
        });

        test("leaves X unchanged", () => {
            const m = E.rotZW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [1, 0, 0, 0]), [1, 0, 0, 0]);
        });

        test("leaves Y unchanged", () => {
            const m = E.rotZW(PI2);
            expectVec4Close(E.mat4MulVec4(m, [0, 1, 0, 0]), [0, 1, 0, 0]);
        });
    });

    describe("rotation composition", () => {
        test("four 90° rotations return to identity", () => {
            for (const rotFn of E.ROTATION_BUILDERS) {
                const v = [1, 2, 3, 4];
                let result = v;
                for (let i = 0; i < 4; i++) {
                    result = E.mat4MulVec4(rotFn(PI2), result);
                }
                expectVec4Close(result, v);
            }
        });

        test("CW then CCW returns to start", () => {
            for (const rotFn of E.ROTATION_BUILDERS) {
                const v = [1, 2, 3, 4];
                const fwd = E.mat4MulVec4(rotFn(PI2), v);
                const back = E.mat4MulVec4(rotFn(-PI2), fwd);
                expectVec4Close(back, v);
            }
        });
    });
});

describe("project4Dto3D", () => {
    test("origin projects to origin", () => {
        const p = E.project4Dto3D([0, 0, 0, 0]);
        expect(p.x).toBe(0);
        expect(p.y).toBe(0);
        expect(p.z).toBe(0);
    });

    test("positive w makes projection larger (closer)", () => {
        const p0 = E.project4Dto3D([1, 0, 0, 0]);
        const p1 = E.project4Dto3D([1, 0, 0, 1]);
        expect(p1.x).toBeGreaterThan(p0.x);
    });

    test("negative w makes projection smaller (farther)", () => {
        const p0 = E.project4Dto3D([1, 0, 0, 0]);
        const pn = E.project4Dto3D([1, 0, 0, -1]);
        expect(pn.x).toBeLessThan(p0.x);
    });

    test("w near W_CAMERA clamps to prevent infinity", () => {
        const p = E.project4Dto3D([1, 0, 0, E.W_CAMERA - 0.001]);
        expect(isFinite(p.x)).toBe(true);
        expect(p.x).toBeGreaterThan(0);
    });

    test("returns plain object with x, y, z", () => {
        const p = E.project4Dto3D([1, 2, 3, 0]);
        expect(typeof p.x).toBe("number");
        expect(typeof p.y).toBe("number");
        expect(typeof p.z).toBe("number");
    });
});
