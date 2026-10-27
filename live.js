
const D = __DATA__;
const root = document.querySelector(".mg");
const stage = root.querySelector(".mg-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const said = stage.querySelector(".mg-said");
const heatBtn = root.querySelector(".mg-heat-btn");
const part = (name) => svg.querySelector(`[data-part="${name}"]`);
const still = matchMedia("(prefers-reduced-motion: reduce)");
const P = D.P;
const at = (p) => iso(p, P);
const NS = "http://www.w3.org/2000/svg";
const f1 = (v) => Math.round(v * 10) / 10;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const opacity = (el, v) => {
  const s = v < 0.004 ? "0" : v > 0.996 ? "1" : v.toFixed(3);
  if (el.style.opacity !== s) el.style.opacity = s;
};
const flag = (el, name, on) => (on ? el.setAttribute(name, "") : el.removeAttribute(name));

// Gradients for the flame and the heat arrow.
svg.insertAdjacentHTML(
  "afterbegin",
  `<defs><radialGradient id="mg-flame-grad" cx="50%" cy="78%" r="70%"><stop offset="0" style="stop-color:var(--mg-flame-core)"/><stop offset=".45" style="stop-color:var(--mg-flame);stop-opacity:.95"/><stop offset="1" style="stop-color:var(--mg-flame);stop-opacity:0"/></radialGradient>` +
    `<linearGradient id="mg-heat-grad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--mg-heat);stop-opacity:.95"/><stop offset=".55" style="stop-color:var(--mg-heat);stop-opacity:.4"/><stop offset="1" style="stop-color:var(--mg-heat);stop-opacity:0"/></linearGradient></defs>`,
);

// ------------------------------------------------------------ parts
const el = {
  fall: part("fall"),
  coil: part("coil"),
  lampBurn: part("lamp-burn"),
  lampStir: part("lamp-stir"),
  cru: part("cru"),
  cruChar: part("cru-char"),
  cruAsh: part("cru-ash"),
  smoke: part("smoke"),
  cloud: part("cloud"),
  stirbar: part("stirbar"),
  mould: part("mould"),
  mouldGel: part("mould-gel"),
  drip: part("drip"),
  dryBlock: part("dry-block"),
  dryWet: part("dry-wet"),
  dryVapour: part("dry-vapour"),
  ventVapour: part("vent-vapour"),
  gauge: part("gauge"),
  lampDry: [part("lamp-dry-0"), part("lamp-dry-1")],
  flame: part("flame"),
  gauzeGlow: part("gauze-glow"),
  tile: part("tile"),
  heat: part("heat"),
  carry: part("carry"),
  lensLiquid: part("lens-liquid"),
  lensLinks: part("lens-links"),
  lensDots: part("lens-dots"),
  steps: [...svg.querySelectorAll(".mg-step")],
  specPorosity: root.querySelector('[data-value="porosity"]'),
  specDensity: root.querySelector('[data-value="density"]'),
};

// ------------------------------------------------------------ falling husk from the chute
const FALL_TOP = at(D.CHUTE_END.map((v, i) => (i === 2 ? v - 4 : v)));
const FALL_BOT = at(D.HEAP);
el.fall.innerHTML = Array.from({ length: 6 }, () => `<ellipse class="mg-carry-dot" data-kind="husk" rx="1.3" ry="0.55"/>`).join("");
const fallDots = [...el.fall.children];

// ------------------------------------------------------------ carriers between stations
const CARRY = [
  { kind: "husk", t: [0.55, 0.95], a: D.HEAP, b: [D.CRU.o[0], D.CRU.o[1], D.CRU.top], h: 42, n: 6 },
  { kind: "ash", t: [2.0, 2.25], a: [D.CRU.o[0], D.CRU.o[1], D.CRU.top], b: [D.BK.o[0], D.BK.o[1], D.BK.o[2] + D.BK.h], h: 52, n: 6 },
  { kind: "drop", t: [3.0, 3.3], a: [D.BK.o[0] + D.BK.r + 2, 0, D.BK.o[2] + D.BK.h - 1], b: [D.MOULD.x, D.MOULD.y, D.MOULD.top + 1], h: 30, n: 7 },
  { kind: "block", t: [4.0, 4.14], a: [D.MOULD.x, D.MOULD.y, 3], b: [D.PORT[0], D.PORT[1] + 6, D.PORT[2] - 6], h: 40 },
  { kind: "tile", t: [5.0, 5.28], a: [D.PORT[0], D.PORT[1] + 6, D.PORT[2] - 6], b: [D.TILE.x + D.TILE.w / 2, D.TILE.y + D.TILE.d / 2, D.TILE.z], h: 46 },
];
const arcAt = (c, u) => {
  const p = lerp3(c.a, c.b, u);
  p[2] += c.h * 4 * u * (1 - u);
  return p;
};
for (const c of CARRY) {
  const g = document.createElementNS(NS, "g");
  g.style.opacity = "0";
  if (c.kind === "block" || c.kind === "tile") {
    const b = c.kind === "block" ? D.MOULD.block : { x: -D.TILE.w / 2, y: -D.TILE.d / 2, w: D.TILE.w, d: D.TILE.d, r: D.TILE.r };
    const h = c.kind === "block" ? 8 : D.TILE.h;
    g.innerHTML = `<g class="${c.kind === "block" ? "mg-gel" : "mg-aero"}">${solidSvg(slabOf(b, 0, h, P, 2, 0.4), { tone: "mid" })}</g>`;
  } else {
    g.innerHTML = Array.from({ length: c.n }, () => (c.kind === "husk" ? `<ellipse class="mg-carry-dot" data-kind="husk" rx="1.4" ry="0.6"/>` : `<circle class="mg-carry-dot" data-kind="${c.kind}" r="${c.kind === "drop" ? 1.2 : 1}"/>`)).join("");
  }
  el.carry.append(g);
  c.g = g;
}
function drawCarry(p, time) {
  for (const c of CARRY) {
    const u = (p - c.t[0]) / (c.t[1] - c.t[0]);
    const on = u > 0 && u < 1;
    opacity(c.g, on ? Math.min(1, u * 8, (1 - u) * 6) : 0);
    if (!on) continue;
    if (c.kind === "block" || c.kind === "tile") {
      c.g.setAttribute("transform", translateAlong(P, arcAt(c, u)));
    } else {
      [...c.g.children].forEach((dot, i) => {
        const v = Math.min(1, Math.max(0, u * 1.35 - i * 0.06));
        const [x, y] = at(arcAt(c, v));
        dot.setAttribute("cx", f1(x + Math.sin(i * 2.3 + time * 3) * 0.6));
        dot.setAttribute("cy", f1(y));
        dot.style.opacity = v <= 0 || v >= 1 ? "0" : "1";
      });
    }
  }
}

// ------------------------------------------------------------ wisps (smoke and vapour)
function wisps(group, base, rise, count, time, spread, alpha) {
  if (alpha < 0.004) {
    if (group.childElementCount) group.innerHTML = "";
    opacity(group, 0);
    return;
  }
  opacity(group, alpha);
  const [x0, y0] = at(base);
  const lines = [];
  for (let i = 0; i < count; i++) {
    const ph = (time * 0.35 + i / count) % 1;
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const s = j / 10;
      const yy = y0 - (ph * 0.5 + s * 0.5) * rise;
      const xx = x0 + (i - (count - 1) / 2) * spread + Math.sin(s * 5 + time * 1.6 + i * 2) * (1 + s * 3);
      pts.push(`${f1(xx)} ${f1(yy)}`);
    }
    const fade = Math.sin(Math.PI * ph);
    lines.push(`<path d="M${pts.join("L")}" style="opacity:${(fade * 0.8).toFixed(2)}"/>`);
  }
  group.innerHTML = lines.join("");
}

// ------------------------------------------------------------ stirrer bar
function stirbarAt(angle) {
  const [cx, cy, z] = D.BK.o;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ring = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    const u = Math.cos(t) * 6;
    const v = Math.sin(t) * 1.3;
    ring.push([cx + u * c - v * s, cy + u * s + v * c]);
  }
  return solidSvg(extrude(ring, z + 0.8, 1.6, P), { tone: "mid", crease: "none" });
}

// ------------------------------------------------------------ drips from the burette
el.drip.innerHTML = `<ellipse class="mg-carry-dot" data-kind="drop" rx="0.9" ry="1.3"/><ellipse class="mg-carry-dot" data-kind="drop" rx="0.9" ry="1.3"/>`;
const drips = [...el.drip.children];
const DRIP_TOP = at(D.BUR_TIP);
const DRIP_BOT = at([D.BUR_TIP[0], D.BUR_TIP[1], D.MOULD.top]);

// ------------------------------------------------------------ gauge needle (face up, like the dial example)
const GAUGE_R = 7.2;
const needleAt = (share) => {
  const a = -Math.PI * 0.75 + Math.PI * 1.5 * share;
  const [x, y, z] = D.GAUGE;
  return lineOnTop([x - Math.sin(a) * 2, y + Math.cos(a) * 2], [x + Math.sin(a) * GAUGE_R, y - Math.cos(a) * GAUGE_R], z + 0.2, P);
};

// ------------------------------------------------------------ flame and heat arrow
const FB = at(D.BUN);
const FLAME_H = screenRise(D.GAUZE_Z + 2 - D.BUN[2], P);
function flamePath(time, k) {
  const h = FLAME_H * (0.92 + 0.08 * Math.sin(time * 13) * Math.sin(time * 7.3));
  const w = 6 * D.KS * (1 + 0.06 * Math.sin(time * 11));
  const sway = Math.sin(time * 5.1) * 0.7;
  const [x, y] = FB;
  const top = y - h * k;
  return `M${f1(x - w * 0.55)} ${f1(y)}C${f1(x - w * 1.2)} ${f1(y - h * 0.35 * k)} ${f1(x - w * 0.5 + sway)} ${f1(y - h * 0.75 * k)} ${f1(x + sway)} ${f1(top)}C${f1(x + w * 0.5 + sway)} ${f1(y - h * 0.75 * k)} ${f1(x + w * 1.2)} ${f1(y - h * 0.35 * k)} ${f1(x + w * 0.55)} ${f1(y)}Z`;
}
el.flame.innerHTML = `<path class="mg-flame-outer"/><path class="mg-flame-inner"/>`;
const [flameOuter, flameInner] = el.flame.children;
// The arrow lies on the tile's front face: a shaft from the gauze into the tile, fading out before the top.
const YF = D.TILE.y + D.TILE.d + 0.06;
const XC = D.TILE.x + D.TILE.w / 2;
const onFace = (x, z) => at([x, YF, z]);
function arrowShape(z0, z1, half) {
  const pts = [onFace(XC - half, z0), onFace(XC + half, z0), onFace(XC + half, z1), onFace(XC - half, z1)];
  return `M${pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L")}Z`;
}
function chevron(z, half) {
  const a = onFace(XC - half * 2.2, z - half * 1.6);
  const b = onFace(XC, z);
  const c = onFace(XC + half * 2.2, z - half * 1.6);
  const c2 = onFace(XC + half * 2.2, z - half * 2.4);
  const b2 = onFace(XC, z - half * 0.8);
  const a2 = onFace(XC - half * 2.2, z - half * 2.4);
  return `M${[a, b, c, c2, b2, a2].map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L")}Z`;
}
const heatBox = (() => {
  const top = onFace(XC, D.TILE.z + D.TILE.h);
  const bot = onFace(XC, D.TILE.z - 4);
  return { top: top[1], bot: bot[1] };
})();
function drawHeat(time, level) {
  opacity(el.heat, level);
  if (level < 0.004) return;
  const z0 = D.TILE.z;
  const z1 = D.TILE.z + D.TILE.h * 0.78;
  const parts = [`<path d="${arrowShape(z0 - 4, z1, 1.8)}"/>`];
  for (let i = 0; i < 3; i++) {
    const ph = (time * 0.55 + i / 3) % 1;
    const z = z0 + 3 + ph * (z1 - z0 - 2);
    const fade = (1 - ph) * Math.min(1, ph * 6);
    parts.push(`<path d="${chevron(z, 2.2)}" style="opacity:${fade.toFixed(2)}"/>`);
  }
  el.heat.innerHTML = parts.join("");
  const grad = svg.querySelector("#mg-heat-grad");
  grad.setAttribute("gradientUnits", "userSpaceOnUse");
  grad.setAttribute("x1", "0");
  grad.setAttribute("x2", "0");
  grad.setAttribute("y1", f1(heatBox.bot));
  grad.setAttribute("y2", f1(heatBox.top + 2));
}

// ------------------------------------------------------------ the network in the lens
const NET = D.NET;
const LR = D.LENS_R * 0.92;
el.lensLiquid.innerHTML = `<circle class="mg-liquidfill" r="${f1(D.LENS_R)}"/>` + NET.pores.map(([x, y, r]) => `<circle class="mg-air" cx="${f1(x * LR)}" cy="${f1(y * LR)}" r="0"/>`).join("");
const lensFill = el.lensLiquid.children[0];
const lensAir = [...el.lensLiquid.children].slice(1);
el.lensLinks.innerHTML = NET.links.map(() => `<line class="mg-link"/>`).join("");
const linkEls = [...el.lensLinks.children];
el.lensDots.innerHTML = NET.pts.map(() => `<circle class="mg-np" r="${f1(0.036 * LR)}"/>`).join("");
const dotEls = [...el.lensDots.children];
function drawLens(p, time, liquid) {
  const toSol = smooth01(2.2, 2.9, p);
  const toGel = smooth01(3.15, 3.9, p);
  const brown = toSol * (1 - toGel);
  const pos = NET.pts.map((g, i) => {
    const a = NET.ash[i];
    const s = NET.sol[i];
    const x0 = a[0] + (s[0] - a[0]) * toSol;
    const y0 = a[1] + (s[1] - a[1]) * toSol;
    const jx = Math.sin(time * 1.3 + i * 1.7) * 0.03 * brown;
    const jy = Math.cos(time * 1.1 + i * 2.3) * 0.03 * brown;
    return [(x0 + (g[0] - x0) * toGel + jx) * LR, (y0 + (g[1] - y0) * toGel + jy) * LR];
  });
  dotEls.forEach((d, i) => {
    d.setAttribute("cx", f1(pos[i][0]));
    d.setAttribute("cy", f1(pos[i][1]));
  });
  const linked = smooth01(3.55, 3.95, p);
  linkEls.forEach((l, j) => {
    const [a, b] = NET.links[j];
    l.setAttribute("x1", f1(pos[a][0]));
    l.setAttribute("y1", f1(pos[a][1]));
    l.setAttribute("x2", f1(pos[b][0]));
    l.setAttribute("y2", f1(pos[b][1]));
  });
  opacity(el.lensLinks, linked);
  // Liquid is there from the dissolve to the end of drying; each pore empties on its own as the liquid leaves.
  const wet = smooth01(2.1, 2.35, p);
  opacity(lensFill, wet * (0.25 + 0.75 * Math.min(1, liquid * 1.4)));
  lensAir.forEach((c, j) => {
    const [, , r, order] = NET.pores[j];
    const open = smooth01(4.1 + order * 0.6, 4.3 + order * 0.6, p) * wet;
    c.setAttribute("r", f1(r * LR * open));
  });
}

// ------------------------------------------------------------ state and loop
const STEP_SECONDS = 3.2;
const HOLD = 6;
let p = 0;
let target = 0;
let touring = !still.matches;
let clock = 0;
let userHeat = null;
let heatLevel = 0;
let bar = 0;
let barRate = 0;
let time = 0;
let frame = 0;
let last = 0;
let visible = false;
let idleTimer = 0;
const tourAt = (t) => {
  const cycle = 6 * STEP_SECONDS + HOLD;
  const c = t % cycle;
  return Math.min(6, c / STEP_SECONDS);
};
const heatWanted = () => (userHeat !== null ? userHeat : touring && p > 5.6);

function draw() {
  const s = stateAt(Math.min(p, 5.999));
  const busy = (a, b) => smooth01(a, a + 0.12, p) * (1 - smooth01(b - 0.12, b, p));
  // Step marks on the bench.
  el.steps.forEach((m, i) => flag(m, "data-on", i <= s.i));
  // 1. falling husk while the heap is fed.
  const feeding = 1 - smooth01(0.9, 1.1, p);
  opacity(el.fall, feeding);
  fallDots.forEach((d, i) => {
    const ph = (time * 0.9 + i / fallDots.length) % 1;
    d.setAttribute("cx", f1(FALL_TOP[0] + (FALL_BOT[0] - FALL_TOP[0]) * ph + Math.sin(i * 3.1) * 1.5));
    d.setAttribute("cy", f1(FALL_TOP[1] + (FALL_BOT[1] - FALL_TOP[1]) * ph * ph));
  });
  // 2. burn.
  const burning = busy(1.05, 2.0);
  opacity(el.coil, burning * (0.75 + 0.25 * Math.sin(time * 2.4)));
  flag(el.lampBurn, "data-hot", burning > 0.5);
  opacity(el.cru, smooth01(0.85, 1.0, p) * (1 - smooth01(2.0, 2.15, p)));
  opacity(el.cruChar, s.char);
  opacity(el.cruAsh, s.burn);
  wisps(el.smoke, [D.CRU.o[0], D.CRU.o[1], D.CRU.top + 1], 26, 3, time, 4, busy(1.15, 1.95) * (1 - s.burn * 0.6));
  // 3. dissolve.
  opacity(el.cloud, smooth01(2.12, 2.3, p) * (1 - s.dissolved) * (1 - smooth01(3.9, 4, p)));
  const stirring = busy(2.05, 3.05);
  flag(el.lampStir, "data-on", stirring > 0.5);
  barRate += ((stirring * 9) - barRate) * 0.05;
  // 4. gel.
  opacity(el.mould, smooth01(3.05, 3.3, p) * (1 - smooth01(4.0, 4.1, p)));
  opacity(el.mouldGel, s.set);
  const dripping = busy(3.25, 3.85);
  drips.forEach((d, i) => {
    const ph = (time * 1.4 + i * 0.5) % 1;
    const [x, y] = [DRIP_TOP[0], DRIP_TOP[1] + (DRIP_BOT[1] - DRIP_TOP[1]) * ph * ph];
    d.setAttribute("cx", f1(x));
    d.setAttribute("cy", f1(y));
    d.style.opacity = (dripping * Math.min(1, (1 - ph) * 5)).toFixed(2);
  });
  // 5. dry.
  opacity(el.dryBlock, smooth01(4.1, 4.18, p) * (1 - smooth01(5.0, 5.08, p)));
  opacity(el.dryWet, s.liquid * 0.85);
  const drying = busy(4.1, 5.0);
  wisps(el.ventVapour, D.VENT, 30, 2, time, 3, drying * Math.max(0.25, s.liquid));
  wisps(el.dryVapour, D.DRY_BLOCK, 10, 3, time * 1.5, 5, drying * s.liquid);
  const pressure = 0.06 + 0.7 * drying * (0.6 + 0.4 * s.liquid);
  gaugeShare += (pressure - gaugeShare) * 0.06;
  el.gauge.setAttribute("d", needleAt(gaugeShare));
  flag(el.lampDry[0], "data-on", drying > 0.5);
  flag(el.lampDry[1], "data-on", p >= 5);
  // 6. tile, flame and heat.
  opacity(el.tile, s.tile);
  el.tile.setAttribute("transform", translateAlong(P, [0, 0, (1 - s.tile) * 10]));
  opacity(el.flame, heatLevel);
  if (heatLevel > 0.004) {
    flameOuter.setAttribute("d", flamePath(time, 1));
    flameInner.setAttribute("d", flamePath(time + 0.3, 0.38));
  }
  opacity(el.gauzeGlow, heatLevel * 0.3);
  drawHeat(time, heatLevel * s.tile);
  drawCarry(p, time);
  drawLens(p, time, s.liquid);
  // Words.
  const text = readoutOf(p, heatLevel > 0.5 && s.i === 5);
  if (readout.textContent !== text) readout.textContent = text;
  const ps = s.i < 3 ? "—" : s.i === 3 ? "~95% · liquid" : s.i === 4 ? `~95% · ${Math.round(s.liquid * 100)}% liq.` : ">90% air";
  const ds = s.i < 3 ? "—" : `~${s.density.toFixed(2)} g/cm³`;
  if (el.specPorosity.textContent !== ps) el.specPorosity.textContent = ps;
  if (el.specDensity.textContent !== ds) el.specDensity.textContent = ds;
  flag(el.specPorosity, "data-empty", s.i < 3);
  flag(el.specDensity, "data-empty", s.i < 3);
  stage.setAttribute("aria-valuenow", String(s.i + 1));
  stage.setAttribute("aria-valuetext", s.stage.name);
  heatBtn.setAttribute("aria-pressed", String(heatWanted()));
}
let gaugeShare = 0.06;

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  time += calm ? 0 : dt;
  if (touring) {
    clock += dt;
    target = tourAt(clock);
  }
  p = calm ? target : p + (target - p) * (1 - Math.exp(-dt / (touring ? 0.05 : 0.45)));
  if (Math.abs(target - p) < 0.0005) p = target;
  const wantHeat = heatWanted() ? 1 : 0;
  heatLevel = calm ? wantHeat : heatLevel + (wantHeat - heatLevel) * (1 - Math.exp(-dt / 0.35));
  bar += barRate * dt;
  el.stirbar.innerHTML = stirbarAt(bar);
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
const resumeLater = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (still.matches) return;
    touring = true;
    clock = p * STEP_SECONDS;
    run();
  }, 4000);
};
const steer = (next) => {
  touring = false;
  target = Math.min(6, Math.max(0, next));
  resumeLater();
  run();
};
const announce = () => {
  const s = stateAt(Math.min(target, 5.999));
  said.textContent = `${s.stage.name}: ${s.stage.says}`;
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = ((event.clientX - box.left) / box.width - 0.06) / 0.86;
  steer(share * 6);
});
stage.addEventListener("pointerleave", resumeLater);
stage.addEventListener("keydown", (event) => {
  let to = null;
  const here = Math.min(5, Math.floor(target + 0.001));
  if (/^[1-6]$/.test(event.key)) to = Number(event.key) - 1 + 0.55;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = Math.min(5, here + 1) + 0.55;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = Math.max(0, here - 1) + 0.55;
  if (event.key === "Home") to = 0.55;
  if (event.key === "End") to = 6;
  if (event.key === "h" || event.key === "H") {
    toggleHeat();
    event.preventDefault();
    return;
  }
  if (to === null) return;
  event.preventDefault();
  steer(to === 5.55 ? 6 : to);
  announce();
});
function toggleHeat() {
  userHeat = !heatWanted();
  if (userHeat && target < 5.5) steer(6);
  said.textContent = userHeat ? "Flame on under the tile. The flower on top stays cool." : "Flame off.";
  run();
}
heatBtn.addEventListener("click", toggleHeat);
still.addEventListener("change", () => {
  touring = !still.matches;
  run();
});
if (still.matches) target = p = 6;
draw();
window.__mg = {
  get p() { return p; },
  set: (v) => { touring = false; clearTimeout(idleTimer); target = p = v; run(); },
  heat: (on) => { userHeat = on; heatLevel = on ? 1 : 0; run(); },
  tour: (on) => { touring = on; run(); },
};
