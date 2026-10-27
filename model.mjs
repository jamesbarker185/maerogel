// Maerogel: rice husk to silica aerogel. One progress value p runs 0..6 through the six stations.
// Sourced: ash silica 92–97% amorphous (UTM / Prof. Halimaton Hamdan), cost about 80% below conventional
// aerogel (Merdeka Award citation). The dissolve, gel and dry steps are the generic sol-gel route, not the
// patent's own conditions. Porosity and density are illustrative values for a silica aerogel.

export const ASH_SILICA = [92, 97]; // % amorphous SiO2 in the white ash
export const COST_SAVING = 80; // % lower than conventional aerogel, per the Merdeka Award citation
export const POROSITY = 95; // % air, illustrative (silica aerogels run above 90%)
export const DENSITY = 0.1; // g/cm3, illustrative (under 0.2)
export const GEL_DENSITY = 1.05; // g/cm3 of the wet gel, mostly liquid, illustrative

export const STAGES = [
  { key: "husk", name: "Rice husk", says: "mill waste; about a fifth of its mass burns to ash" },
  { key: "burn", name: "Burning", says: "controlled burn in air leaves white ash" },
  { key: "dissolve", name: "Dissolving", says: "ash + NaOH → sodium silicate (generic)" },
  { key: "gel", name: "Gelling", says: "acid sets a silica network, pores full of liquid" },
  { key: "dry", name: "Drying", says: "liquid leaves, network stays (generic)" },
  { key: "aerogel", name: "Aerogel", says: "mostly air in a silica lattice" },
];

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth01 = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Everything the drawing shows, as a function of p.
export function stateAt(p) {
  const i = Math.min(5, Math.max(0, Math.floor(p)));
  const burn = smooth01(1.15, 1.85, p); // husk in the dish: 0 golden, 1 white ash
  const char = smooth01(1.1, 1.45, p) * (1 - smooth01(1.5, 1.9, p)); // black stage in between
  const dissolved = smooth01(2.25, 2.9, p); // ash cloud in the beaker clears
  const set = smooth01(3.3, 3.9, p); // sol in the mould sets to gel
  const liquid = 1 - smooth01(4.15, 4.9, p); // share of pore volume still liquid
  const tile = smooth01(5.25, 5.45, p);
  return {
    i,
    stage: STAGES[i],
    burn,
    char,
    dissolved,
    set,
    liquid,
    tile,
    porosity: i >= 3 ? POROSITY : null,
    density: i < 3 ? null : i < 4 ? GEL_DENSITY : DENSITY + (GEL_DENSITY - DENSITY) * liquid,
  };
}

export function readoutOf(p, heat) {
  const s = stateAt(p);
  const head = `${s.i + 1}/6 · ${s.stage.name}`;
  if (s.i === 4) return `${head} · pores ${Math.round(s.liquid * 100)}% liquid`;
  if (s.i === 5 && heat) return `${head} · flame on · top stays cool`;
  if (s.i === 1) return `${head} · ${s.burn < 0.98 ? "husk → ash" : `ash ${ASH_SILICA[0]}–${ASH_SILICA[1]}% SiO₂`}`;
  if (s.i === 2) return `${head} · ${Math.round(s.dissolved * 100)}% dissolved`;
  if (s.i === 3) return `${head} · ${s.set < 0.98 ? "sol → gel" : "wet gel"}`;
  if (s.i === 5) return `${head} · ~${POROSITY}% air`;
  return `${head} · golden husk`;
}
