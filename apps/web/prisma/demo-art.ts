/**
 * Generates illustrative SVG artwork for demonstration listings. These are deliberately stylised
 * (not photographs) and carry a visible "Illustrative image" label, so no demo listing is ever
 * presented with a photo that could be mistaken for a real property.
 */
type Kind = "house" | "apartment" | "land" | "commercial" | "shortstay" | "farm";

const PALETTES = [
  { sky1: "#F6D8A8", sky2: "#E9A96B", hill: "#2F6B57", hill2: "#1F4D3F", sea: "#2E7D8C", accent: "#C8962E" },
  { sky1: "#CFE6F2", sky2: "#8FC1DA", hill: "#3D7A5E", hill2: "#285A45", sea: "#1F6F86", accent: "#0F766E" },
  { sky1: "#F3E3C7", sky2: "#D9B88A", hill: "#5C7F3A", hill2: "#3F5F26", sea: "#3B8496", accent: "#B45309" },
  { sky1: "#E6E0F3", sky2: "#B9A9D9", hill: "#356B60", hill2: "#22504A", sea: "#2B6E8A", accent: "#0B1F3A" },
];

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function house(r: () => number, p: (typeof PALETTES)[number]) {
  const wall = ["#F4EFE6", "#EDE3D1", "#F7F1E8", "#E8EEF0"][Math.floor(r() * 4)];
  const roof = ["#9A3B2E", "#7A4B33", "#3C4A5C", "#8C5A2B"][Math.floor(r() * 4)];
  return `
  <g transform="translate(250 250)">
    <rect x="0" y="80" width="300" height="150" fill="${wall}" stroke="#00000022"/>
    <polygon points="-20,85 150,0 320,85" fill="${roof}"/>
    <rect x="40" y="120" width="50" height="50" fill="#7FB3C8" stroke="#ffffff" stroke-width="4"/>
    <rect x="210" y="120" width="50" height="50" fill="#7FB3C8" stroke="#ffffff" stroke-width="4"/>
    <rect x="125" y="140" width="50" height="90" fill="${p.accent}"/>
    <rect x="-40" y="230" width="380" height="10" fill="#00000018"/>
  </g>
  <rect x="160" y="420" width="60" height="70" rx="30" fill="${p.hill2}"/>
  <rect x="610" y="400" width="70" height="90" rx="35" fill="${p.hill2}"/>`;
}

function apartment(r: () => number, p: (typeof PALETTES)[number]) {
  const floors = 4 + Math.floor(r() * 3);
  const h = floors * 46;
  let windows = "";
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < 4; c++) {
      windows += `<rect x="${290 + c * 58}" y="${490 - h + 14 + f * 46}" width="36" height="26" fill="${r() > 0.3 ? "#9CC9DA" : "#F2D58C"}"/>`;
    }
  }
  return `
  <rect x="270" y="${490 - h}" width="250" height="${h}" fill="#F1EDE6" stroke="#00000020"/>
  <rect x="262" y="${484 - h}" width="266" height="10" fill="${p.accent}"/>
  ${windows}
  <rect x="540" y="${520 - h * 0.7}" width="120" height="${h * 0.7 - 30}" fill="#E4DED3" stroke="#00000018"/>`;
}

function commercial(r: () => number, p: (typeof PALETTES)[number]) {
  return `
  <rect x="220" y="300" width="360" height="190" fill="#F3F0EA" stroke="#00000020"/>
  <rect x="220" y="282" width="360" height="30" fill="${p.accent}"/>
  <rect x="245" y="340" width="90" height="150" fill="#8DB8C9"/>
  <rect x="355" y="340" width="90" height="150" fill="#8DB8C9"/>
  <rect x="465" y="340" width="90" height="150" fill="#8DB8C9"/>
  <rect x="215" y="488" width="370" height="8" fill="#00000020"/>
  ${r() > 0.5 ? `<rect x="610" y="380" width="120" height="110" fill="#D8D2C6"/>` : ""}`;
}

function land(r: () => number, p: (typeof PALETTES)[number]) {
  let posts = "";
  for (let i = 0; i < 9; i++) posts += `<rect x="${180 + i * 55}" y="${430 - (i % 2) * 4}" width="6" height="40" fill="#6B4F2A"/>`;
  return `
  <polygon points="140,470 700,450 760,540 80,560" fill="#B9A167" opacity="0.85"/>
  ${posts}
  <line x1="180" y1="440" x2="626" y2="436" stroke="#6B4F2A" stroke-width="3"/>
  <circle cx="${600 + r() * 60}" cy="390" r="38" fill="${p.hill}"/>
  <rect x="${596 + r() * 60}" y="410" width="8" height="40" fill="#5A3E20"/>
  <circle cx="230" cy="380" r="30" fill="${p.hill2}"/>`;
}

function farm(r: () => number, p: (typeof PALETTES)[number]) {
  let rows = "";
  for (let i = 0; i < 7; i++) rows += `<path d="M ${60 + i * 20} ${560} Q 400 ${430 + i * 12} ${760 - i * 10} 560" stroke="${p.hill}" stroke-width="10" fill="none" opacity="${0.6 + r() * 0.4}"/>`;
  return `<rect x="0" y="440" width="800" height="160" fill="#8FA65A"/>${rows}`;
}

const SCENES: Record<Kind, typeof house> = {
  house,
  apartment,
  commercial,
  land,
  shortstay: apartment,
  farm,
};

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function demoSvg(kind: Kind, seed: number, label: string): string {
  const r = rng(seed * 7919 + kind.length);
  const p = PALETTES[seed % PALETTES.length]!;
  const scene = SCENES[kind](r, p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="1600" height="1200" role="img" aria-label="Illustrative image: ${escapeXml(label)}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky1}"/><stop offset="1" stop-color="${p.sky2}"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#sky)"/>
  <circle cx="${120 + r() * 560}" cy="${90 + r() * 60}" r="34" fill="#FFF4D6" opacity="0.9"/>
  <path d="M0 360 Q 160 ${250 + r() * 60} 320 330 T 640 ${300 + r() * 40} T 800 330 V600 H0 Z" fill="${p.hill}"/>
  <path d="M0 420 Q 200 ${370 + r() * 30} 420 410 T 800 400 V600 H0 Z" fill="${p.hill2}"/>
  ${kind === "shortstay" || r() > 0.6 ? `<rect x="0" y="520" width="800" height="80" fill="${p.sea}" opacity="0.8"/>` : `<rect x="0" y="490" width="800" height="110" fill="#C9B98F"/>`}
  ${scene}
  <rect x="16" y="552" width="250" height="32" rx="16" fill="#0B1F3A" opacity="0.78"/>
  <text x="141" y="573" font-family="Arial, sans-serif" font-size="15" fill="#ffffff" text-anchor="middle">Illustrative image · demo</text>
</svg>`;
}

export type DemoKind = Kind;
