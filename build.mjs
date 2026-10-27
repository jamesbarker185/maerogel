import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";

// World units are about 1 px. The process line runs along +x on one bench, left to right.
const W = 760;
const H = 580;
const AZIMUTH = 40;
const ELEVATION = 30;

const BENCH = { x: -320, y: -76, w: 640, d: 140, r: 10 };
const BENCH_H = 14;
const FOOT_H = 6;

const X = { husk: -252, burn: -162, beaker: -62, mould: 34, dryer: 136, stand: 250 };

const P = k.fitProjection([...k.boxCorners(BENCH, -BENCH_H - FOOT_H, 0), [-320, -60, 96], [296, -58, 162], [330, -4, 246]], W, H, {
  pad: 24,
  azimuth: AZIMUTH,
  elevation: ELEVATION,
});
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0.5) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const pathOf3 = (points, closed = true) => k.pathOf(points.map(at), closed);
const shadeOf = (normal) => Math.min(3, G.toneOf(normal, P));
const up = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const facing = (x, y, z) => G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, -1]); // axis out of a +y face
const tint = (name, svg, extra = "") => `<g class="${name}"${extra}>${svg}</g>`;
const f1 = (v) => +v.toFixed(1);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A flat face of any polygon, shaded by its normal like the kit's sides.
function faceSvg(points, normal, { tone = "mid", inner = "", top = false, className } = {}) {
  const d = pathOf3(points);
  const fill = top ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${shadeOf(normal)}" d="${d}"/>`;
  return `<g class="iso-solid${className ? ` ${className}` : ""}"><path class="iso-fill" d="${d}"/>${fill}${inner}<path class="iso-line iso-edge" data-tone="${tone}" d="${d}"/></g>`;
}
const topPoly = (plan, z, steps = 3) => k.pathOf(k.ringOf(plan, steps).map(([x, y]) => at([x, y, z])), true);
const ellipseOn = (F, s, r) => G.circleOf(F, s, r, P, 72);
const feet = (plan, inset, r = 3) => byDepth(k.corners(plan, inset)).map(([x, y]) => S(k.cylinder(x, y, r, 0, 2, P, 20), { tone: "lo" })).join("");
// A knob on a +y face: a short disc with a knurl and a pointer line on its face.
function frontKnob(x, y, z, r = 3.4) {
  const F = facing(x, y, z);
  const ribs = G.ribsOf(F, 0, 2.6, r, 28, P, { fade: [0.1, 0.55] });
  return S(G.disc(0, 2.6, r, F, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }) + Ln(k.segment([x, y + 2.65, z], [x, y + 2.65, z + r - 0.8], P), { tone: "hi" });
}
const lampOn = (x, y, z, part) => {
  const [sx, sy] = at([x, y + 0.05, z]);
  return Ln(G.circleOf(facing(x, y, z), 0.05, 1.7, P, 24), { tone: "lo" }) + `<circle class="mg-lamp" data-part="${part}" cx="${f1(sx)}" cy="${f1(sy)}" r="1.1"/>`;
};

const out = [];

// ---------------------------------------------------------------- bench
out.push(`<path class="iso-halo" d="${k.haloOf(BENCH, -BENCH_H - FOOT_H, BENCH_H, P)}"/>`);
for (const [x, y] of byDepth([...k.corners(BENCH, 24), [0, BENCH.y + 24], [0, BENCH.y + BENCH.d - 24]])) {
  out.push(S(k.cylinder(x, y, 9, -BENCH_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 7, -BENCH_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
}
out.push(S(slab(BENCH, -BENCH_H, BENCH_H, 8, 1.6), { tone: "mid" }));
out.push(Ln(k.planOutline(k.insetPlan(BENCH, 6), 0, P), { tone: "lo" }));
{
  const screws = k.corners(BENCH, 13);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 16)).join(""), { tone: "lo" }), Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  const side = k.sideTicks(BENCH.x + 30, BENCH.x + BENCH.w - 30, 8, 5, BENCH.y + BENCH.d, 0, [2.2, 4.2], P, "x");
  out.push(Ln(side.minor, { tone: "lo" }), Ln(side.major, { tone: "mid" }));
  // Ruler strip along the near edge, one tick every 5 units.
  const strip = { x: -290, y: BENCH.y + BENCH.d - 14, w: 250, d: 7, r: 1 };
  out.push(S(slab(strip, 0, 0.7), { tone: "lo", crease: "none" }));
  const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.7, [2, 3.8], P);
  out.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
  out.push(Dots([at([strip.x + 2, strip.y + 3.5, 0.7]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.7])], { size: 0.45 }));
  // Station marks: six small engraved rings along the back groove, one per step.
  out.push(Ln(Object.values(X).map((x) => k.ring(x, BENCH.y + 12, 2.2, 0, P, 20)).join(""), { tone: "lo" }));
  out.push(Object.values(X).map((x, i) => `<circle class="mg-step" data-step="${i}" cx="${f1(at([x, BENCH.y + 12, 0])[0])}" cy="${f1(at([x, BENCH.y + 12, 0])[1])}" r="1.2"/>`).join(""));
  // Label plate.
  const label = { x: -22, y: BENCH.y + BENCH.d - 30, w: 80, d: 22, r: 1.5 };
  out.push(S(slab(label, 0, 1, 3), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(label, 1.8), 1, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 6, label.y + 9.5], 1, P, "x"), "MAEROGEL · UTM", { size: 4.4, tone: "lo" }));
  out.push(Ln([0, 1, 2].map((row) => k.onTop([[label.x + 6, label.y + 13.5 + row * 2.6], [label.x + [66, 50, 36][row], label.y + 13.5 + row * 2.6]], 1, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 2.8, label.y + label.d / 2, 1]), at([label.x + label.w - 2.8, label.y + label.d / 2, 1])], { size: 0.45 }));
}

// ---------------------------------------------------------------- 1. husk: mill chute over a heap on a tray
const HOP = { x: -314, y: -68, w: 36, d: 36, r: 2 };
const HOP_Z = [58, 90];
const HEAP = [X.husk, 4];
const HEAP_Z = 4;
const HEAP_R = 19;
const HEAP_H = 13;
const CHUTE = [
  [HOP.x + HOP.w, -52, 66],
  [X.husk - 2, -8, 38],
];
{
  for (const [x, y] of byDepth(k.corners(HOP, 3))) {
    if (y > -50 && x > -310) continue; // the near leg is drawn after the hopper
    out.push(S(slab({ x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, r: 0.6 }, 0, HOP_Z[0], 2, 0.3), { tone: "mid", crease: "none" }));
  }
  // Cross brace between the back legs.
  out.push(S(slab({ x: HOP.x + 3, y: HOP.y + 2, w: HOP.w - 6, d: 2, r: 0.4 }, 24, 3, 2, 0.3), { tone: "lo", crease: "none" }));
  const hopper = k.slabOf(HOP, HOP_Z[0], HOP_Z[1] - HOP_Z[0], P, 3, 0.8);
  out.push(S(hopper, { tone: "mid", inner: Ln(k.sideSeam(HOP, HOP_Z[0] + 8, P, 3) + k.sideSeam(HOP, HOP_Z[1] - 6, P, 3), { tone: "faint" }) }));
  // Open top with husk inside, and a lid propped at the back.
  out.push(`<path class="mg-void" d="${topPoly(k.insetPlan(HOP, 2), HOP_Z[1], 2)}"/>`);
  out.push(tint("mg-husk", `<path class="mg-fillface" d="${topPoly(k.insetPlan(HOP, 3), HOP_Z[1], 2)}"/>`));
  out.push(Ln(k.planOutline(k.insetPlan(HOP, 2), HOP_Z[1], P, 2), { tone: "lo" }));
  const leg = k.corners(HOP, 3).find(([x, y]) => y > -50 && x > -310);
  out.push(S(slab({ x: leg[0] - 1.6, y: leg[1] - 1.6, w: 3.2, d: 3.2, r: 0.6 }, 0, HOP_Z[0], 2, 0.3), { tone: "mid", crease: "none" }));
  // Slide gate on the +x face where the chute leaves.
  out.push(S(slab({ x: HOP.x + HOP.w, y: -58, w: 2, d: 12, r: 0.4 }, 62, 10, 2, 0.3), { tone: "mid" }));

  // Tray and heap.
  const TRAY = { x: HEAP[0] - 26, y: HEAP[1] - 24, w: 52, d: 48, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 3, P)}" style="opacity:.4"/>`);
  out.push(S(slab(TRAY, 0, 4, 3, 0.5), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(TRAY, 2), 4, P, 3), { tone: "lo" }));
  out.push(tint("mg-husk", `<path class="mg-fillface" d="${topPoly(k.insetPlan(TRAY, 3), 4, 3)}"/>`));
  const c = (HEAP_R * HEAP_R - HEAP_H * HEAP_H) / (2 * HEAP_H); // sphere-cap heap
  const RS = HEAP_H + c;
  const radius = (s) => Math.sqrt(Math.max(0, RS * RS - (s + c) * (s + c)));
  const slope = (s) => -(s + c) / Math.max(0.6, radius(s));
  const prof = Array.from({ length: 25 }, (_, i) => {
    const s = (HEAP_H * i) / 24;
    return i === 24 ? [s, 0] : [s, radius(s), 1];
  });
  const FH = up(HEAP[0], HEAP[1], HEAP_Z);
  const marks = [];
  const rand = rng(7);
  for (let n = 0; n < 160 && marks.length < 64; n++) {
    const s = rand() * HEAP_H * 0.92;
    const a = rand() * Math.PI * 2;
    const r = radius(s);
    const normal = G.unit3([Math.cos(a), Math.sin(a), -slope(s)]);
    if (G.dot3(normal, V) < 0.22) continue;
    const p = G.pointOf(FH, s, r + 0.05, a);
    const t = rand() * Math.PI;
    const tan = G.unit3(G.cross3(normal, [Math.cos(t), Math.sin(t), 0.3]));
    marks.push(k.segment(G.add3(p, G.mul3(tan, -1.3)), G.add3(p, G.mul3(tan, 1.3)), P));
  }
  out.push(tint("mg-husk", S(G.solidOf(prof, FH, P, { smooth: { slope } }), { tone: "mid", inner: `<path class="mg-grain" d="${marks.join("")}"/>` })));
  out.push(`<g data-part="fall"></g>`);

  // Chute: an open trough of three plates, from the hopper gate down over the heap.
  const a = G.unit3(G.sub3(CHUTE[1], CHUTE[0]));
  const u = G.unit3(G.cross3(a, [0, 0, 1]));
  const v = G.cross3(u, a);
  const L = G.len3(G.sub3(CHUTE[1], CHUTE[0]));
  const F = G.frameOf(CHUTE[0], a, u, v);
  const near = G.dot3(u, V) > 0 ? 1 : -1;
  const wall = (side) => G.prismOf(F, [[side * 5, -4], [side * 4, -4], [side * 4, 3], [side * 5, 3]].map(([x, y]) => [x, y]), 0, L, P);
  const post = G.lerp3(CHUTE[0], CHUTE[1], 0.55);
  out.push(S(k.cylinder(post[0], post[1], 3.4, 0, 1.6, P, 20), { tone: "lo" }));
  out.push(S(k.cylinder(post[0], post[1], 1.5, 1.6, post[2] - 6.4, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: post[0] - 3, y: post[1] - 3, w: 6, d: 6, r: 0.8 }, post[2] - 6.4, 2.2, 2, 0.3), { tone: "mid" }));
  out.push(S(wall(-near), { tone: "mid" }));
  out.push(S(G.prismOf(F, [[-5, -4], [5, -4], [5, -3], [-5, -3]], 0, L, P), { tone: "mid" }));
  const inChute = [];
  for (let i = 0; i < 18; i++) {
    const p = G.add3(G.add3(CHUTE[0], G.mul3(a, 3 + ((L - 6) * (i + 0.5)) / 18)), G.add3(G.mul3(u, ((i * 7) % 5) - 2), G.mul3(v, -2.4)));
    inChute.push(k.segment(G.add3(p, G.mul3(a, -1.1)), G.add3(p, G.mul3(a, 1.1)), P));
  }
  out.push(tint("mg-husk", `<path class="mg-grain" d="${inChute.join("")}"/>`));
  out.push(S(wall(near), { tone: "mid" }));
}

// ---------------------------------------------------------------- 2. burn: hot plate with a porcelain crucible
const HP = { x: X.burn - 26, y: -26, w: 52, d: 52, r: 4 };
const HP_TOP = 15;
const CRU = up(X.burn, 0, HP_TOP + 1.6);
const CRU_H = 10;
const CRU_LEVEL = 6.2;
{
  out.push(`<path class="iso-halo" d="${k.haloOf(HP, 0, 4, P)}" style="opacity:.5"/>`);
  out.push(feet(HP, 5));
  out.push(S(slab(HP, 2, HP_TOP - 2, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(HP, 6, P, 4), { tone: "faint" }) }));
  out.push(frontKnob(X.burn - 12, HP.y + HP.d, 8.5));
  out.push(lampOn(X.burn + 6, HP.y + HP.d, 8.5, "lamp-burn"));
  // Vent slots on the +x side.
  out.push(Ln([0, 1, 2, 3].map((i) => pathOf3([[HP.x + HP.w + 0.05, -14 + i * 7, 5], [HP.x + HP.w + 0.05, -10 + i * 7, 5], [HP.x + HP.w + 0.05, -10 + i * 7, 11], [HP.x + HP.w + 0.05, -14 + i * 7, 11]])).join(""), { tone: "lo" }));
  out.push(S(k.cylinder(X.burn, 0, 21, HP_TOP, 1.6, P, 72, 0.5), { tone: "hi", crease: "lo" }));
  out.push(Ln([8, 12.5, 17].map((r) => k.ring(X.burn, 0, r, HP_TOP + 1.6, P, 64)).join(""), { tone: "faint" }));
  out.push(`<g class="mg-coil" data-part="coil" style="opacity:0">${[8, 12.5, 17].map((r) => `<path d="${k.ring(X.burn, 0, r, HP_TOP + 1.6, P, 64)}"/>`).join("")}</g>`);
  // Crucible.
  const prof = [[0, 8], [1.6, 9.2, 1], [4, 11, 1], [7, 12.4, 1], [CRU_H, 13.2]];
  out.push(S(G.solidOf(prof, CRU, P), { tone: "hi", crease: "lo" }));
  const rim = ellipseOn(CRU, CRU_H, 12.3);
  out.push(`<path class="mg-void" d="${rim}"/>`);
  out.push(`<clipPath id="cru-clip"><path d="${rim}"/></clipPath>`);
  const content = ellipseOn(CRU, CRU_LEVEL, 11.8);
  const grains = [];
  const rand = rng(11);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 10.5;
    const p = G.pointOf(CRU, CRU_LEVEL + 0.05, r, a);
    const t = rand() * Math.PI;
    grains.push(k.segment([p[0] - Math.cos(t) * 1.2, p[1] - Math.sin(t) * 1.2, p[2]], [p[0] + Math.cos(t) * 1.2, p[1] + Math.sin(t) * 1.2, p[2]], P));
  }
  out.push(
    `<g clip-path="url(#cru-clip)" data-part="cru" style="opacity:0">` +
      tint("mg-husk", `<path class="mg-fillface" d="${content}"/><path class="mg-grain" d="${grains.join("")}"/>`) +
      `<g data-part="cru-char" style="opacity:0"><path class="mg-char" d="${content}"/></g>` +
      `<g data-part="cru-ash" style="opacity:0"><path class="mg-ash" d="${content}"/><path class="mg-ash-fleck" d="${grains.slice(0, 14).join("")}"/></g>` +
      `<path class="iso-line" data-tone="faint" d="${G.arcOf(CRU, CRU_LEVEL, 11.8, P, { inward: true, least: -1 })}"/>` +
      `</g>`,
  );
  out.push(Ln(rim, { tone: "lo" }));
  out.push(`<g data-part="smoke" class="mg-smoke" style="opacity:0"></g>`);
  // Crucible tongs lying on the bench in front.
  const tong = (x0, y0, x1, y1, w) => {
    const n = G.unit3([-(y1 - y0), x1 - x0, 0]);
    return k.extrude([[x0 + n[0] * w, y0 + n[1] * w], [x1 + n[0] * w, y1 + n[1] * w], [x1 - n[0] * w, y1 - n[1] * w], [x0 - n[0] * w, y0 - n[1] * w]], 0, 1.2, P);
  };
  out.push(S(tong(X.burn - 30, 46, X.burn + 18, 38, 0.9), { tone: "mid", crease: "none" }));
  out.push(S(tong(X.burn - 30, 46, X.burn + 16, 52, 0.9), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(X.burn - 30, 46, 1.8, 0, 2, P, 16), { tone: "mid" }));
}

// ---------------------------------------------------------------- 3. dissolve: stirrer, beaker, NaOH bottle
const ST = { x: X.beaker - 27, y: -27, w: 54, d: 54, r: 5 };
const ST_TOP = 11;
const BK = up(X.beaker, 0, ST_TOP + 1);
const BK_R = 16;
const BK_H = 40;
const BK_LEVEL = 25;
{
  // Reagent bottle (amber glass) behind the stirrer.
  const BOT = up(X.beaker + 30, -46, 0);
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: X.beaker + 21, y: -55, w: 18, d: 18, r: 9 }, 0, 2, P)}" style="opacity:.4"/>`);
  out.push(tint("mg-amber", S(G.solidOf([[0, 8], [20, 8], [23, 6.5, 1], [25.5, 3.6, 1], [27, 3.2]], BOT, P), { tone: "mid", inner: Ln(G.arcOf(BOT, 6, 8, P) + G.arcOf(BOT, 16, 8, P), { tone: "faint" }) })));
  out.push(S(G.solidOf([[27, 3.8], [32, 3.8]], BOT, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(BOT, 27, 32, 3.8, 22, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));

  out.push(`<path class="iso-halo" d="${k.haloOf(ST, 0, 4, P)}" style="opacity:.5"/>`);
  out.push(feet(ST, 5));
  out.push(S(slab(ST, 2, ST_TOP - 2, 4, 0.6), { tone: "mid", inner: Ln(k.sideSeam(ST, 5.5, P, 4), { tone: "faint" }) }));
  out.push(frontKnob(X.beaker - 12, ST.y + ST.d, 6.5));
  out.push(frontKnob(X.beaker + 2, ST.y + ST.d, 6.5));
  out.push(lampOn(X.beaker + 16, ST.y + ST.d, 6.5, "lamp-stir"));
  out.push(S(k.cylinder(X.beaker, 0, 21, ST_TOP, 1, P, 72, 0.4), { tone: "hi", crease: "lo" }));
  // Beaker: glass body, then liquid, then the front glass marks.
  out.push(tint("mg-glass", S(G.solidOf([[0, BK_R], [BK_H, BK_R]], BK, P), { tone: "mid", crease: "none" })));
  out.push(`<g data-part="stirbar"></g>`);
  out.push(tint("mg-liquid", S(G.solidOf([[0.8, BK_R - 0.7], [BK_LEVEL, BK_R - 0.7]], BK, P), { tone: "lo", crease: "none" })));
  {
    const rand = rng(23);
    const cloud = [];
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * (BK_R - 2.5);
      const s = 2 + rand() * (BK_LEVEL - 4);
      const [sx, sy] = at(G.pointOf(BK, s, r, a));
      cloud.push(`<circle cx="${f1(sx)}" cy="${f1(sy)}" r="${(0.5 + rand() * 0.6).toFixed(2)}"/>`);
    }
    out.push(`<g class="mg-cloud" data-part="cloud" style="opacity:0">${cloud.join("")}</g>`);
  }
  out.push(Ln(G.arcOf(BK, BK_LEVEL, BK_R - 0.7, P, { least: -1 }), { tone: "mid", className: "mg-meniscus" }));
  const face = G.angleToward(BK, V);
  const ticks = [8, 14, 20, 26, 32].map((s, i) => G.arcOf(BK, s, BK_R + 0.05, P, { from: face - (i % 2 ? 0.18 : 0.32), to: face - 0.02, trim: 0 }));
  out.push(Ln(ticks.join(""), { tone: "mid", free: true }));
  out.push(`<path class="mg-shine" d="${k.pathOf([at(G.pointOf(BK, 3, BK_R, face - 0.62)), at(G.pointOf(BK, BK_H - 4, BK_R, face - 0.62))], false)}"/>`);
  out.push(Ln(ellipseOn(BK, BK_H, BK_R) + G.arcOf(BK, BK_H - 1.4, BK_R, P), { tone: "mid" }));
  // Pouring lip.
  out.push(S(k.extrude([[X.beaker + BK_R - 1, -2.4], [X.beaker + BK_R + 2.6, 0], [X.beaker + BK_R - 1, 2.4]], ST_TOP + 1 + BK_H - 2, 2, P), { tone: "mid", crease: "none" }));
}

// ---------------------------------------------------------------- 4. gel: mould under a burette of acid
const MO = { x: X.mould - 24, y: -16, w: 48, d: 38, r: 2 };
const MO_WALL = 2;
const MO_TOP = 13;
const MO_LEVEL = 10.5;
const IN = k.insetPlan(MO, MO_WALL);
const BUR = [X.mould, 2];
const BUR_Z = [36, 110];
const ROD = [X.mould - 38, 2];
{
  // Retort stand behind.
  const BASE = { x: ROD[0] - 12, y: ROD[1] - 16, w: 24, d: 30, r: 2 };
  out.push(S(slab(BASE, 0, 3, 3, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(ROD[0], ROD[1], 2.4, 3, 2, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(ROD[0], ROD[1], 1.4, 5, 115, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(ROD[0], ROD[1], 1.9, 120, 1.2, P, 16), { tone: "mid" }));
  // Mould: base, far walls, content, near walls.
  out.push(`<path class="iso-halo" d="${k.haloOf(MO, 0, 3, P)}" style="opacity:.5"/>`);
  out.push(S(slab(MO, 0, 2, 3, 0.4), { tone: "mid" }));
  const wallPlan = {
    back: { x: MO.x, y: MO.y, w: MO.w, d: MO_WALL, r: 0.6 },
    left: { x: MO.x, y: MO.y, w: MO_WALL, d: MO.d, r: 0.6 },
    front: { x: MO.x, y: MO.y + MO.d - MO_WALL, w: MO.w, d: MO_WALL, r: 0.6 },
    right: { x: MO.x + MO.w - MO_WALL, y: MO.y, w: MO_WALL, d: MO.d, r: 0.6 },
  };
  out.push(S(slab(wallPlan.back, 2, MO_TOP - 2, 2, 0.3), { tone: "mid" }));
  out.push(S(slab(wallPlan.left, 2, MO_TOP - 2, 2, 0.3), { tone: "mid" }));
  out.push(`<path class="mg-floor" d="${topPoly(IN, 2, 2)}"/>`);
  const level = topPoly(IN, MO_LEVEL, 2);
  const flecks = [];
  const rand = rng(31);
  for (let i = 0; i < 40; i++) flecks.push(at([IN.x + 2 + rand() * (IN.w - 4), IN.y + 2 + rand() * (IN.d - 4), MO_LEVEL]));
  out.push(
    `<g data-part="mould" style="opacity:0">` +
      `<path class="mg-sol" d="${level}"/>` +
      `<g data-part="mould-gel" style="opacity:0"><path class="mg-gelface" d="${level}"/>${Dots(flecks, { size: 0.45, tone: "lo" })}</g>` +
      `<path class="iso-line" data-tone="faint" d="${k.planOutline(k.insetPlan(IN, 0.6), MO_LEVEL, P, 2)}"/>` +
      `</g>`,
  );
  out.push(S(slab(wallPlan.right, 2, MO_TOP - 2, 2, 0.3), { tone: "mid" }));
  out.push(S(slab(wallPlan.front, 2, MO_TOP - 2, 2, 0.3), { tone: "mid" }));
  out.push(Dots([[MO.x + 4, MO.y + MO.d - 1], [MO.x + MO.w - 4, MO.y + MO.d - 1]].map(([x, y]) => at([x, y, MO_TOP])), { size: 0.4 }));
  // Arm and clamp from the rod to the burette.
  out.push(S(slab({ x: ROD[0] - 4, y: ROD[1] - 4, w: 8, d: 8, r: 1 }, 92, 7, 2, 0.4), { tone: "mid" }));
  out.push(S(slab({ x: ROD[0] + 4, y: ROD[1] - 1.2, w: BUR[0] - ROD[0] - 7, d: 2.4, r: 0.6 }, 94.5, 2.4, 2, 0.3), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: BUR[0] - 4, y: BUR[1] - 4, w: 8, d: 8, r: 1.4 }, 92, 7, 3, 0.4), { tone: "mid" }));
  // Burette: tip cone, stopcock, glass tube with acid, scale ticks.
  const FB = up(BUR[0], BUR[1], 26);
  out.push(tint("mg-glass", S(G.solidOf([[0, 0.7], [6, 1.6], [10, 2.4]], FB, P), { tone: "mid", crease: "none" })));
  out.push(S(G.disc(10, 14, 3.4, FB, P), { tone: "mid" }));
  out.push(S(slab({ x: BUR[0] + 3.4, y: BUR[1] - 0.8, w: 7, d: 1.6, r: 0.6 }, 37, 1.8, 2, 0.2), { tone: "mid", crease: "none" }));
  const tube = up(BUR[0], BUR[1], 40);
  out.push(tint("mg-glass", S(G.solidOf([[0, 2.4], [BUR_Z[1] - 40, 2.4]], tube, P), { tone: "mid", crease: "none" })));
  out.push(tint("mg-acid", S(G.solidOf([[0, 1.8], [44, 1.8]], tube, P), { tone: "lo", crease: "none" })));
  const bf = G.angleToward(tube, V);
  out.push(Ln([6, 14, 22, 30, 38, 46, 54, 62].map((s, i) => G.arcOf(tube, s, 2.45, P, { from: bf - (i % 2 ? 0.5 : 0.9), to: bf + 0.1, trim: 0 })).join(""), { tone: "mid", free: true }));
  out.push(Ln(ellipseOn(tube, BUR_Z[1] - 40, 2.4), { tone: "mid" }));
  out.push(`<g data-part="drip"></g>`);
}

// ---------------------------------------------------------------- 5. dry: chamber with a porthole, gauge and vent
const DR = { x: X.dryer - 34, y: -44, w: 68, d: 62, r: 4 };
const DR_Z = [4, 66];
const PORT = [X.dryer, DR.y + DR.d, 34];
const PORT_R = 13;
const GAUGE = [X.dryer - 18, -16];
const GAUGE_Z = 74;
const VENT = [X.dryer + 20, -26];
{
  out.push(`<path class="iso-halo" d="${k.haloOf(DR, 0, 6, P)}"/>`);
  for (const [x, y] of byDepth(k.corners(DR, 6))) {
    out.push(S(k.cylinder(x, y, 4, 0, 1.4, P, 20), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 2.8, 1.4, DR_Z[0] - 1.4, P, 20), { tone: "mid" }));
  }
  out.push(S(slab(DR, DR_Z[0], DR_Z[1] - DR_Z[0], 4, 0.8), { tone: "mid", inner: Ln(k.sideSeam(DR, DR_Z[0] + 8, P, 4) + k.sideSeam(DR, DR_Z[1] - 7, P, 4), { tone: "faint" }) }));
  out.push(Ln(k.planOutline(k.insetPlan(DR, 4), DR_Z[1], P, 4), { tone: "faint" }));
  const yF = DR.y + DR.d + 0.05;
  // Door outline on the front, hinges at its left, a latch at its right.
  out.push(Ln(pathOf3([[DR.x + 8, yF, 15], [DR.x + DR.w - 8, yF, 15], [DR.x + DR.w - 8, yF, 55], [DR.x + 8, yF, 55]]), { tone: "lo" }));
  for (const z of [20, 46]) out.push(S(k.cylinder(DR.x + 8, yF + 1.2, 1.6, z, 6, P, 16), { tone: "mid" }));
  out.push(S(slab({ x: DR.x + DR.w - 15, y: yF, w: 2.4, d: 3, r: 0.5 }, 28, 2, 2, 0.2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: DR.x + DR.w - 15, y: yF, w: 2.4, d: 3, r: 0.5 }, 40, 2, 2, 0.2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: DR.x + DR.w - 15.6, y: yF + 3, w: 3.6, d: 2.6, r: 1 }, 26, 18, 2, 0.3), { tone: "hi", crease: "lo" }));
  // Porthole: the chamber's inside, the gel block on a rack, its liquid, then the bezel.
  const FP = facing(PORT[0], yF, PORT[2]);
  const glass = ellipseOn(FP, 2.45, PORT_R);
  out.push(S(G.ringBand(0, 2.4, PORT_R, PORT_R + 4, FP, P), { tone: "mid", inner: Dots(G.dotsOf(FP, 2.4, PORT_R + 2, 8, P, { all: true }), { size: 0.45 }) }));
  out.push(`<clipPath id="port-clip"><path d="${glass}"/></clipPath>`);
  out.push(`<g clip-path="url(#port-clip)"><path class="mg-cavity" d="${glass}"/>`);
  {
    const rack = { x: X.dryer - 16, y: -10, w: 32, d: 22, r: 0.5 };
    out.push(`<g class="mg-inside">`);
    out.push(Ln([0, 1, 2, 3, 4, 5, 6].map((i) => k.lineOnTop([rack.x + i * 5.33, rack.y], [rack.x + i * 5.33, rack.y + rack.d], 24, P)).join("") + k.planOutline(rack, 24, P, 1), { tone: "mid" }));
    const blk = { x: X.dryer - 13, y: -8, w: 26, d: 18, r: 0.8 };
    out.push(`<g data-part="dry-block" style="opacity:0">${tint("mg-gel", S(slab(blk, 24.2, 10, 2, 0.3), { tone: "mid" }))}<g data-part="dry-wet">${tint("mg-wet", S(slab(blk, 24.2, 10, 2, 0), { tone: "lo", crease: "none" }))}</g></g>`);
    out.push(`<g data-part="dry-vapour" class="mg-vapour"></g>`);
    out.push(`</g>`);
  }
  out.push(`<path class="mg-glare" d="${k.pathOf([at([PORT[0] - 8, yF, PORT[2] + 4]), at([PORT[0] - 2, yF, PORT[2] + 10])], false)}"/></g>`);
  // Control panel on the +x side: two lamps and a rocker switch.
  const xS = DR.x + DR.w + 0.05;
  out.push(Ln(pathOf3([[xS, -30, 44], [xS, -2, 44], [xS, -2, 58], [xS, -30, 58]]), { tone: "lo" }));
  for (const [i, y] of [-24, -16].entries()) {
    const [sx, sy] = at([xS, y, 51]);
    out.push(`<circle class="mg-lamp" data-part="lamp-dry-${i}" cx="${f1(sx)}" cy="${f1(sy)}" r="1.3"/>`);
  }
  out.push(Ln(pathOf3([[xS, -9, 48], [xS, -5, 48], [xS, -5, 54], [xS, -9, 54]]), { tone: "mid" }));
  out.push(Ln([0, 1, 2, 3, 4].map((i) => pathOf3([[xS, -36 + i * 7, 12], [xS, -32 + i * 7, 12], [xS, -32 + i * 7, 30], [xS, -36 + i * 7, 30]])).join(""), { tone: "lo" }));
  // Gauge on a riser, face up.
  out.push(S(k.cylinder(GAUGE[0], GAUGE[1], 3, DR_Z[1], 1.4, P, 20), { tone: "mid" }));
  out.push(S(k.cylinder(GAUGE[0], GAUGE[1], 1.6, DR_Z[1] + 1.4, GAUGE_Z - DR_Z[1] - 1.4, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(GAUGE[0], GAUGE[1], 10, GAUGE_Z, 4, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(Ln(k.ring(GAUGE[0], GAUGE[1], 8.6, GAUGE_Z + 4, P, 64), { tone: "lo" }));
  const gt = k.radialTicks(GAUGE[0], GAUGE[1], 8.2, 30, 5, GAUGE_Z + 4, [1, 2], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(Ln(gt.minor, { tone: "lo" }), Ln(gt.major, { tone: "mid" }));
  out.push(`<path data-part="gauge" class="iso-line" data-tone="lit" data-free="end" style="stroke-width:1.1" d=""/>`);
  out.push(Ln(k.ring(GAUGE[0], GAUGE[1], 1.2, GAUGE_Z + 4, P, 16), { tone: "mid" }));
  // Vent stack with a valve wheel and a rain cap.
  out.push(S(k.cylinder(VENT[0], VENT[1], 4, DR_Z[1], 2, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(VENT[0], VENT[1], 2.2, DR_Z[1] + 2, 8, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(VENT[0], VENT[1], 3.6, DR_Z[1] + 10, 4, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(VENT[0], VENT[1], 7, DR_Z[1] + 14, 1.4, P, 40), { tone: "mid", inner: Ln(k.ring(VENT[0], VENT[1], 4.6, DR_Z[1] + 15.4, P, 32), { tone: "faint" }) }));
  out.push(S(k.cylinder(VENT[0], VENT[1], 2.2, DR_Z[1] + 15.4, 10, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(VENT[0], VENT[1], 4.4, DR_Z[1] + 25.4, 1.4, P, 24), { tone: "mid" }));
  out.push(`<g data-part="vent-vapour" class="mg-vapour"></g>`);
}

// ---------------------------------------------------------------- 6. test: tripod over a Bunsen burner, tile and flower
const BUN = [X.stand, 8];
const BUN_TOP = 26;
const RING_Z = 54;
const RING_R = 20;
const GAUZE = { x: X.stand - 23, y: BUN[1] - 23, w: 46, d: 46, r: 1 };
const GAUZE_Z = RING_Z + 0.8;
const TILE = { x: X.stand - 17, y: BUN[1] - 17, w: 34, d: 34, r: 1.4 };
const TILE_Z = GAUZE_Z + 0.6;
const TILE_H = 10;
const TAP = [X.stand - 42, 40];
{
  const legAngles = [-Math.PI / 2 - 0.5, Math.PI / 2 - 0.2, Math.PI + 0.5].map((a) => a);
  const legOf = (a) => [
    [BUN[0] + Math.cos(a) * RING_R, BUN[1] + Math.sin(a) * RING_R, RING_Z],
    [BUN[0] + Math.cos(a) * 30, BUN[1] + Math.sin(a) * 30, 0],
  ];
  const legs = legAngles.map((a) => ({ a, pts: legOf(a), depth: k.depthOf(legOf(a)[1], P) })).sort((p, q) => p.depth - q.depth);
  const legSvg = (pts) => tubePieces(pts, 0.9, P, { maxLength: 400, caps: [false, true] }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("") + S(k.cylinder(pts[1][0], pts[1][1], 1.6, 0, 0.8, P, 12), { tone: "lo" });
  out.push(legSvg(legs[0].pts));
  // Gas tap and hose.
  out.push(S(slab({ x: TAP[0] - 6, y: TAP[1] - 5, w: 12, d: 10, r: 1.5 }, 0, 6, 3, 0.4), { tone: "mid" }));
  out.push(S(slab({ x: TAP[0] - 1.2, y: TAP[1] - 4, w: 2.4, d: 8, r: 0.6 }, 6, 1.6, 2, 0.2), { tone: "hi", crease: "lo" }));
  const hose = G.fillet(
    [
      [TAP[0], TAP[1] - 5, 3],
      [TAP[0], TAP[1] - 22, 3],
      [BUN[0] - 9, BUN[1] + 8, 3],
      [BUN[0] - 3, BUN[1] + 2, 4.5],
    ],
    6,
    7,
  );
  out.push(tubePieces(hose, 1.3, P, { maxLength: 400 }).map((piece) => tint("mg-hose", tubeSvg(piece, { tone: "mid" }))).join(""));
  // Burner.
  const FBn = up(BUN[0], BUN[1], 0);
  out.push(S(G.solidOf([[0, 7.5], [1.4, 7.5], [2.6, 5, 1], [3.4, 3.2]], FBn, P), { tone: "mid" }));
  out.push(S(G.disc(3.4, BUN_TOP, 2.6, FBn, P), { tone: "mid", inner: Ln(G.arcOf(FBn, 14, 2.6, P), { tone: "faint" }) }));
  out.push(S(G.disc(6, 10, 3.3, FBn, P), { tone: "mid", inner: Dots([at(G.pointOf(FBn, 8, 3.35, G.angleToward(FBn, V)))], { size: 0.7, tone: "lo" }) }));
  out.push(Ln(ellipseOn(FBn, BUN_TOP, 2), { tone: "lo" }));
  out.push(`<g data-part="flame" style="opacity:0"></g>`);
  // Ring, back legs, gauze, tile, front legs.
  const ring = G.arcPoints(up(BUN[0], BUN[1], RING_Z), 0, RING_R, 0, Math.PI * 2, 64);
  out.push(tubePieces(ring, 0.8, P, { maxLength: 400, closed: true }).map((piece) => tubeSvg(piece, { tone: "mid" })).join(""));
  out.push(legSvg(legs[1].pts));
  out.push(legSvg(legs[2].pts));
  out.push(S(slab(GAUZE, RING_Z + 0.8 - 0.6, 0.6, 2, 0), { tone: "mid", crease: "none" }));
  {
    const grid = [];
    for (let i = 1; i < 12; i++) {
      const x = GAUZE.x + (GAUZE.w * i) / 12;
      const y = GAUZE.y + (GAUZE.d * i) / 12;
      grid.push(k.lineOnTop([x, GAUZE.y], [x, GAUZE.y + GAUZE.d], GAUZE_Z, P), k.lineOnTop([GAUZE.x, y], [GAUZE.x + GAUZE.w, y], GAUZE_Z, P));
    }
    out.push(Ln(grid.join(""), { tone: "faint" }));
    out.push(`<path class="mg-ceramic" d="${k.ring(BUN[0], BUN[1], 10, GAUZE_Z, P, 48)}"/>`);
    out.push(`<g data-part="gauze-glow" class="mg-glowface" style="opacity:0"><path d="${k.ring(BUN[0], BUN[1], 10, GAUZE_Z, P, 48)}"/></g>`);
  }
  // Tile (appears at the end) with the flower on it, then the heat arrow fading through it.
  const flower = [];
  {
    const c = [BUN[0] + 1, BUN[1] - 1];
    const F = 1.35;
    const z = TILE_Z + TILE_H + 0.05;
    flower.push(Ln(k.onTop([[1, 2], [4, 6], [6, 10.5], [7, 12.6]].map(([u, v]) => [c[0] + u * F, c[1] + v * F]), z, P), { tone: "mid", className: "mg-stem" }));
    flower.push(`<path class="mg-leaf" d="${k.onTop([[4.4, 6.6], [8.5, 4.6], [10.2, 6.4], [5.2, 7.6]].map(([u, v]) => [c[0] + u * F, c[1] + v * F]), z, P, true)}"/>`);
    const petals = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const pts = [];
      for (let j = 0; j <= 16; j++) {
        const t = (j / 16) * Math.PI * 2;
        const u = (3.3 + Math.cos(t) * 3.1) * F;
        const v = Math.sin(t) * 1.9 * F;
        pts.push([c[0] + Math.cos(a) * u - Math.sin(a) * v, c[1] + Math.sin(a) * u + Math.cos(a) * v]);
      }
      petals.push({ d: k.onTop(pts, z + 0.3, P, true), depth: k.depthOf([c[0] + Math.cos(a) * 3, c[1] + Math.sin(a) * 3, z], P) });
    }
    petals.sort((p, q) => p.depth - q.depth);
    flower.push(petals.map((p) => `<path class="mg-petal" d="${p.d}"/>`).join(""));
    const [cx, cy] = at([c[0], c[1], z + 0.6]);
    flower.push(`<ellipse class="mg-pistil" cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(2.6 * KS)}" ry="${f1(1.5 * KS)}"/>`);
    flower.push(Dots([[c[0] - 0.6, c[1]], [c[0] + 0.6, c[1] + 0.3], [c[0], c[1] - 0.6]].map(([x, y]) => at([x, y, z + 0.7])), { size: 0.35, tone: "mid" }));
  }
  out.push(
    `<g data-part="tile" style="opacity:0">` +
      tint("mg-aero", S(slab(TILE, TILE_Z, TILE_H, 3, 0.8), { tone: "mid", crease: "faint", inner: Ln(k.sideSeam(TILE, TILE_Z + TILE_H * 0.5, P, 3), { tone: "faint" }) })) +
      `<g data-part="heat" class="mg-heat" style="opacity:0"></g>` +
      flower.join("") +
      `</g>`,
  );
}

// ---------------------------------------------------------------- loupe on an arm, looking at the tile
const LOUPE = { base: [296, -58], post: 160, centre: [330, -4, 196], r: 44 };
{
  const B = { x: LOUPE.base[0] - 11, y: LOUPE.base[1] - 11, w: 22, d: 22, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(B, 0, 3, P)}" style="opacity:.5"/>`);
  out.push(S(slab(B, 0, 8, 3, 0.6), { tone: "mid" }));
  out.push(Dots(k.corners(B, 3.5).map(([x, y]) => at([x, y, 8])), { size: 0.45 }));
  out.push(S(k.cylinder(LOUPE.base[0], LOUPE.base[1], 2, 8, LOUPE.post - 8, P, 16), { tone: "mid", crease: "none", inner: Ln(k.sideArc(LOUPE.base[0], LOUPE.base[1], 2, 60, P, 12), { tone: "faint" }) }));
  const knuckle = [LOUPE.base[0], LOUPE.base[1], LOUPE.post + 2];
  const lensF = G.frameAlong(LOUPE.centre, V);
  // Arm from the knuckle to the lens rim, ending on the rim's right side.
  const rimAngle = G.angleToward(lensF, G.sub3(knuckle, LOUPE.centre));
  const rimPt = G.pointOf(lensF, 0, LOUPE.r + 4, rimAngle);
  const arm = G.fillet([knuckle, [knuckle[0] - 6, knuckle[1] + 14, knuckle[2] + 12], rimPt], 8, 7);
  out.push(tubePieces(arm, 1.6, P, { maxLength: 400, caps: [false, false] }).map((piece) => tubeSvg(piece, { tone: "mid" })).join(""));
  out.push(S(G.sphereOf(knuckle, 3.4, P), { tone: "mid" }));
  out.push(S(G.sphereOf(rimPt, 2.6, P), { tone: "mid" }));
  // The lens: a ring facing the viewer, the network drawn inside it (the ring's fill is its hull, so it goes first).
  out.push(S(G.ringBand(-1.6, 1.6, LOUPE.r, LOUPE.r + 4, lensF, P), { tone: "mid" }));
  const [lx, ly] = at(LOUPE.centre);
  const lr = LOUPE.r * KS;
  out.push(`<g data-part="lens" transform="translate(${f1(lx)} ${f1(ly)})"><clipPath id="lens-clip"><circle r="${f1(lr)}"/></clipPath><circle class="mg-lensbg" r="${f1(lr)}"/><g clip-path="url(#lens-clip)"><g data-part="lens-liquid"></g><g data-part="lens-links"></g><g data-part="lens-dots"></g></g><circle class="mg-lensglare" r="${f1(lr - 3)}"/></g>`);
}

// ---------------------------------------------------------------- carriers (material in flight between stations)
out.push(`<g data-part="carry"></g>`);

// ---------------------------------------------------------------- the network in the lens
// Particles join in branching necklaces with pores between them. Sol positions are the same particles, scattered.
const NET = (() => {
  // Nodes spread over the lens (dart throwing), joined to their nearest neighbours; each join is a string of beads.
  const rand = rng(5);
  const nodes = [];
  for (let n = 0; n < 4000 && nodes.length < 46; n++) {
    const r = Math.sqrt(rand()) * 1.08;
    const a = rand() * Math.PI * 2;
    const p = [Math.cos(a) * r, Math.sin(a) * r];
    if (nodes.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.26)) nodes.push(p);
  }
  const edges = [];
  nodes.forEach((p, i) => {
    const near = nodes.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1]), j]).filter(([d, j]) => j !== i && d < 0.42).sort((a, b) => a[0] - b[0]).slice(0, 3);
    for (const [, j] of near) if (!edges.some(([a, b]) => (a === j && b === i) || (a === i && b === j))) edges.push([i, j]);
  });
  const pts = nodes.map((p) => [...p]);
  const links = [];
  for (const [i, j] of edges) {
    const [a, b] = [nodes[i], nodes[j]];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.085));
    let prev = i;
    for (let s = 1; s < n; s++) {
      const t = s / n;
      const wob = Math.sin(t * Math.PI) * (rand() - 0.5) * 0.06;
      const idx = pts.length;
      pts.push([a[0] + (b[0] - a[0]) * t - (b[1] - a[1]) * wob, a[1] + (b[1] - a[1]) * t + (b[0] - a[0]) * wob]);
      links.push([prev, idx]);
      prev = idx;
    }
    links.push([prev, j]);
  }
  const sol = pts.map(() => {
    const r = Math.sqrt(rand()) * 1.05;
    const a = rand() * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  // In the ash the silica is a dense, glassy clump: the same beads packed into a small blob.
  const ash = pts.map(() => {
    const r = Math.sqrt(rand()) * 0.42;
    const a = rand() * Math.PI * 2;
    return [Math.cos(a) * r * 1.15 - 0.05, Math.sin(a) * r + 0.05];
  });
  // Pores: grid points far from every bead, with that distance as their size.
  const pores = [];
  for (let gx = -1; gx <= 1; gx += 0.07)
    for (let gy = -1; gy <= 1; gy += 0.07) {
      if (gx * gx + gy * gy > 1.1) continue;
      const d = Math.min(...pts.map(([x, y]) => Math.hypot(x - gx, y - gy)));
      if (d > 0.07) pores.push([+gx.toFixed(3), +gy.toFixed(3), +(d - 0.03).toFixed(3), rand()]);
    }
  const r3 = (v) => +v.toFixed(3);
  return { pts: pts.map((p) => p.map(r3)), sol: sol.map((p) => p.map(r3)), ash: ash.map((p) => p.map(r3)), links, pores };
})();

// ---------------------------------------------------------------- page
const DATA = {
  P,
  KS,
  W,
  H,
  X,
  HEAP: [HEAP[0], HEAP[1], HEAP_Z + HEAP_H],
  CHUTE_END: CHUTE[1],
  CRU: { o: CRU.o, level: CRU_LEVEL, top: CRU.o[2] + CRU_H },
  BK: { o: BK.o, r: BK_R, h: BK_H, level: BK_LEVEL },
  MOULD: { x: X.mould, y: MO.y + MO.d / 2, top: MO_LEVEL, block: { x: -10, y: -7, w: 20, d: 14, r: 0.8 } },
  BUR_TIP: [BUR[0], BUR[1], 26],
  PORT: [PORT[0], DR.y + DR.d, PORT[2]],
  PORT_R,
  GAUGE: [GAUGE[0], GAUGE[1], GAUGE_Z + 4],
  VENT: [VENT[0], VENT[1], DR_Z[1] + 26.8],
  DRY_BLOCK: [X.dryer, 1, 32],
  BUN: [BUN[0], BUN[1], BUN_TOP],
  GAUZE_Z,
  TILE: { ...TILE, z: TILE_Z, h: TILE_H },
  LENS_R: LOUPE.r * KS,
  NET,
};

const LABEL_TEXT =
  "A process line on a workbench that turns rice husk into silica aerogel. From left to right: a mill chute pouring golden husk onto a heap; a hot plate with a porcelain crucible where the husk burns to white ash; a stirrer with a beaker where the ash dissolves into a clear silicate solution; a mould under a burette where the solution sets into a translucent gel; a drying chamber with a porthole; and a pale blue aerogel tile on a tripod over a Bunsen burner with a flower resting on it. A magnifier on an arm shows the silica network and its pores.";

const svg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: out, className: "mg-svg" });
const stage = `<div class="mg-stage" tabindex="0" role="slider" aria-roledescription="process step" aria-valuemin="1" aria-valuemax="6" aria-valuenow="1" aria-valuetext="Rice husk" aria-label="Maerogel process line. Move the pointer across the figure, or press 1 to 6 or the arrow keys, to run the material along the line. Press H to light the flame under the tile."><span class="mg-said" aria-live="polite"></span>${svg}</div>`;

const caption = `Maerogel turns rice husk, a rice-mill waste, into silica aerogel, one of the lightest solids and best thermal insulators known. Husk burned in air leaves a white ash that is ${M.ASH_SILICA[0]}–${M.ASH_SILICA[1]}% amorphous silica. The silica is dissolved, set into a wet gel whose silica skeleton holds a fine network of nanoscale pores full of liquid, then dried so the liquid leaves without the network collapsing. What remains is mostly air in a silica lattice, so heat crosses it slowly: a flame under the tile leaves a flower on top unharmed. Developed by Prof. Halimaton Hamdan at Universiti Teknologi Malaysia (US patent granted 2011); the Merdeka Award citation puts its cost about ${M.COST_SAVING}% below conventional aerogel. The dissolve, gel and dry steps here follow the typical sol-gel aerogel route (sodium hydroxide, then acid, then drying that avoids collapsing the pores) and are generic: the patent's own conditions are not shown. Porosity and density are illustrative.`;

const specs = `<dl class="mg-specs" aria-label="Key numbers">
<div data-spec="silica"><dt>Silica in ash</dt><dd>${M.ASH_SILICA[0]}–${M.ASH_SILICA[1]}%</dd></div>
<div data-spec="porosity"><dt>Porosity <i>illus.</i></dt><dd data-value="porosity">—</dd></div>
<div data-spec="density"><dt>Density <i>illus.</i></dt><dd data-value="density">—</dd></div>
<div data-spec="cost"><dt>Cost vs conventional</dt><dd>~${M.COST_SAVING}% lower</dd></div>
</dl>`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Maerogel, Universiti Teknologi Malaysia",
  hint: "Move across to run the line · H for heat",
  readout: M.readoutOf(0, false),
  keys: [
    { mark: "lit", label: "The material at each step: husk, ash, solution, gel, aerogel" },
    { mark: "raised", label: "Chute, hot plate, stirrer, mould, dryer and test stand" },
    { mark: "flat", label: "Magnifier: the silica network and its pores" },
  ],
  caption,
  body: `<span class="mg-credit">Invented by Prof. Halimaton Hamdan</span><button class="mg-heat-btn" type="button" aria-pressed="false"><span class="mg-heat-dot"></span>Heat</button>${stage}`,
}).replace("<figcaption", `${specs}<figcaption`);

const CSS = readFileSync(join(HERE, "maerogel.css"), "utf8");
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Maerogel", theme, body: `<style>${CSS}</style><div class="mg">${plate}</div>`, script: kitScript() + MODEL + LIVE, width: 800 });
const name = theme === "light" ? "maerogel.html" : "maerogel-dark.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${out.length} items`, "scale", KS.toFixed(3), "net", NET.pts.length, "pts", NET.pores.length, "pores");
