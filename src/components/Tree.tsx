import React, { memo, useMemo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';
import type { Growth, Species } from '../growth';

// Tree coordinate space. The base of the trunk sits at (BASE_X, BASE_Y).
export const VIEW_W = 300;
export const VIEW_H = 320;
export const BASE_X = 150;
export const BASE_Y = 292;

/** A single leaf/petal in a 24×24 box, shared by the falling leaves and petals. */
export const LEAF_PATH = 'M12 2C6 6 4 12 6 18c1 3 4 4 6 4s5-1 6-4c2-6 0-12-6-16z';

const MAX_DEPTH = 5;
const FALLEN_SQUASH = 0.6;
const DEG = Math.PI / 180;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(lerp(ch(pa, s), ch(pb, s), clamp(t)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

/** Deterministic random in [0,1) per (tree seed, branch key, slot) so the tree keeps its shape while growing. */
function rnd(seed: number, key: number, k: number): number {
  let h = seed ^ Math.imul(key + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Segment {
  d: string;
  w: number;
  depth: number;
}
interface Anchor {
  x: number;
  y: number;
  angle: number;
  depth: number;
  size: number; // 0..1 local growth
  key: number;
}

function buildTree(t: number, seed: number, girth = 1, reach = 1) {
  const segments: Segment[] = [];
  const tips: Anchor[] = [];
  const anchors: Anchor[] = [];
  // How many branch levels exist (fractional → the newest level is still growing).
  const D = t < 0.22 ? 0 : ((t - 0.22) / 0.78) * (MAX_DEPTH + 1);

  const grow = (
    x: number, y: number, angle: number, len: number, width: number,
    depth: number, key: number, local: number,
  ) => {
    const l = len * easeOut(local);
    const w = width * (0.35 + 0.65 * local);
    const x2 = x + Math.cos(angle) * l;
    const y2 = y + Math.sin(angle) * l;
    // Organic bend: offset the control point sideways.
    const bend = (rnd(seed, key, 1) - 0.5) * l * 0.35;
    const mx = (x + x2) / 2 + Math.cos(angle + Math.PI / 2) * bend;
    const my = (y + y2) / 2 + Math.sin(angle + Math.PI / 2) * bend;
    segments.push({ d: `M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, w, depth });

    const node: Anchor = { x: x2, y: y2, angle, depth, size: local, key };
    if (depth >= 2) anchors.push(node);

    const childLocal = clamp(D - depth);
    if (depth >= MAX_DEPTH || childLocal <= 0) {
      tips.push(node);
      return;
    }
    const spread = (15 + rnd(seed, key, 2) * 13) * DEG;
    const lean = (rnd(seed, key, 3) - 0.5) * 12 * DEG;
    const kids: number[] = [angle - spread + lean, angle + spread + lean];
    if (depth < 2 && rnd(seed, key, 4) < 0.65) kids.push(angle + lean * 0.5);
    kids.forEach((a, i) => {
      // Branches that droop too far get nudged back toward the sky.
      const up = -90 * DEG;
      const aa = a + (up - a) * (depth >= 2 ? 0.16 : 0.06);
      const ratio = 0.72 + rnd(seed, key * 4 + i + 1, 5) * 0.1;
      grow(x2, y2, aa, len * ratio * reach, width * 0.66, depth + 1, key * 4 + i + 1, childLocal);
    });
  };

  const trunkLen = 5 + 62 * Math.pow(t, 0.75);
  const trunkW = (1.6 + 13 * Math.pow(t, 1.3)) * girth;
  const trunkAngle = -90 * DEG + (rnd(seed, 0, 9) - 0.5) * 6 * DEG;
  if (t > 0.03) grow(BASE_X, BASE_Y, trunkAngle, trunkLen, trunkW, 0, 0, 1);

  return { segments, tips, anchors, D };
}

/** Leaf shape pointing along `angle`, anchored at (x,y). */
function leafPath(x: number, y: number, angle: number, size: number): string {
  const tipX = x + Math.cos(angle) * size;
  const tipY = y + Math.sin(angle) * size;
  const n = angle + Math.PI / 2;
  const bx = Math.cos(n) * size * 0.38;
  const by = Math.sin(n) * size * 0.38;
  const mx = (x + tipX) / 2;
  const my = (y + tipY) / 2;
  return `M${x.toFixed(1)} ${y.toFixed(1)}Q${(mx + bx).toFixed(1)} ${(my + by).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}Q${(mx - bx).toFixed(1)} ${(my - by).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z`;
}

/** What's left of a destroyed tree: a snapped stump, with broken branches and dead leaves on the ground. */
function wreckage(t: number, seed: number) {
  const w = Math.max(2.4, 1.6 + 13 * Math.pow(t, 1.3));
  const len = 5 + 62 * Math.pow(t, 0.75);
  const h = Math.max(3, len * 0.36);
  const left = BASE_X - w / 2;
  // Splintered top: alternating high and low points across the break.
  const top = Array.from({ length: 6 }, (_, i) => {
    const y = BASE_Y - h * (i % 2 ? 0.55 + 0.2 * rnd(seed, 90 + i, 1) : 0.8 + 0.2 * rnd(seed, 90 + i, 1));
    return `L${(left + (w * i) / 5).toFixed(1)} ${y.toFixed(1)}`;
  }).join('');
  const stump = `M${left.toFixed(1)} ${BASE_Y + 1}${top}L${(left + w).toFixed(1)} ${BASE_Y + 1}Z`;

  const sticks = Array.from({ length: 4 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const l = len * (0.22 + 0.25 * rnd(seed, 95 + i, 2));
    const cx = BASE_X + side * (w + l * 0.7 + len * (0.2 + 0.45 * rnd(seed, 95 + i, 1)));
    const cy = BASE_Y + 1 + rnd(seed, 95 + i, 3) * 4;
    const a = (rnd(seed, 95 + i, 4) - 0.5) * 20 * DEG;
    const dx = (Math.cos(a) * l) / 2;
    const dy = (Math.sin(a) * l) / 2;
    return { d: `M${(cx - dx).toFixed(1)} ${(cy - dy).toFixed(1)}L${(cx + dx).toFixed(1)} ${(cy + dy).toFixed(1)}`, w: Math.max(0.8, w * (0.4 - 0.06 * i)) };
  });

  const leafColors = ['#C98B3A', '#A8642B', '#D9A441'];
  const leaves = Array.from({ length: 8 }, (_, i) => ({
    d: leafPath(
      BASE_X + (i % 2 ? 1 : -1) * (w + 4 + rnd(seed, 110 + i, 1) * (len * 1.1 + 12)),
      BASE_Y + 1 + rnd(seed, 110 + i, 2) * 5,
      rnd(seed, 110 + i, 3) * Math.PI * 2,
      3.5 + len * 0.1,
    ),
    fill: leafColors[i % 3],
  }));

  return { stump, w, h, sticks, leaves };
}

interface Props {
  growth: Growth;
  species: Species;
  seed: number;
  width: number;
  height?: number;
  fall?: number; // 0 standing → 1 lying on the ground (one missed day)
  dead?: boolean; // destroyed (two missed days): `growth` is the tree that was lost
}

function TreeImpl({ growth, species, seed, width, height, fall = 0, dead = false }: Props) {
  const { t, bloom, fruit, ripe, mature, old, ancient } = growth;
  const h = height ?? (width * VIEW_H) / VIEW_W;

  const art = useMemo(() => {
    // Past harvest the trunk keeps thickening and the branches reach a little further.
    const girth = 1 + 0.3 * mature + 0.2 * old;
    const reach = 1 + 0.02 * mature + 0.03 * old;
    const { segments, tips, anchors } = buildTree(t, seed, girth, reach);
    // Old trees deepen in colour; ancient ones catch golden light.
    const leafDark = mixColor(species.leaf[0], '#1F3A24', 0.35 * old);
    const leafBase = mixColor(species.leaf[1], species.leaf[0], 0.25 * old);
    const leafLight = mixColor(species.leaf[2], '#F2D46B', 0.55 * ancient);

    // Young stems are green and turn to bark as the tree matures, then weather darker with age.
    const bark = mixColor(mixColor('#6FB24F', '#6B4430', smooth(0.25, 0.5, t)), '#4A3226', 0.6 * old);
    const barkLight = mixColor(mixColor('#9FD37A', '#8E6547', smooth(0.25, 0.5, t)), '#6E5241', 0.6 * old);

    // Sprout-style leaves fade out as the rounded canopy takes over.
    const sproutAlpha = 1 - smooth(0.36, 0.5, t);
    const canopy = smooth(0.26, 0.55, t);

    const sproutLeaves: { d: string; fill: string }[] = [];
    if (sproutAlpha > 0 && t > 0.03) {
      const leafSize = lerp(4, 16, smooth(0.03, 0.3, t));
      const addPair = (a: Anchor, scale: number) => {
        const s = leafSize * scale;
        sproutLeaves.push({ d: leafPath(a.x, a.y, a.angle - 55 * DEG, s), fill: leafBase });
        sproutLeaves.push({ d: leafPath(a.x, a.y, a.angle + 55 * DEG, s), fill: leafLight });
      };
      tips.forEach((a) => addPair(a, 0.5 + 0.5 * a.size));
      // A second pair lower on the stem once it's a seedling.
      if (t > 0.12 && segments.length > 0) {
        const trunkTop = tips.length === 1 && tips[0].depth === 0 ? tips[0] : null;
        if (trunkTop) {
          const mid: Anchor = {
            ...trunkTop,
            x: lerp(BASE_X, trunkTop.x, 0.55),
            y: lerp(BASE_Y, trunkTop.y, 0.55),
          };
          addPair(mid, smooth(0.12, 0.2, t) * 0.8);
        }
      }
    }

    const blobs = canopy > 0
      ? anchors.map((a) => {
          const base = a.depth >= 4 ? 15 : a.depth === 3 ? 21 : 26;
          const r = base * canopy * (0.55 + 0.45 * a.size) * (0.85 + rnd(seed, a.key, 11) * 0.3) * (1 + 0.14 * old);
          const ox = (rnd(seed, a.key, 12) - 0.5) * 6;
          const oy = (rnd(seed, a.key, 13) - 0.5) * 6;
          return { x: a.x + ox, y: a.y + oy, r, key: a.key };
        }).filter((b) => b.r > 0.5)
      : [];

    const flowers: { x: number; y: number; r: number }[] = [];
    if (bloom > 0.01) {
      blobs.forEach((b) => {
        for (let i = 0; i < 2; i++) {
          if (rnd(seed, b.key, 20 + i) > 0.8) continue;
          const ang = rnd(seed, b.key, 22 + i) * Math.PI * 2;
          const dist = Math.sqrt(rnd(seed, b.key, 24 + i)) * b.r * 0.85;
          flowers.push({ x: b.x + Math.cos(ang) * dist, y: b.y + Math.sin(ang) * dist, r: 3.4 * bloom });
        }
      });
    }

    const fruits: { x: number; y: number; r: number; color: string }[] = [];
    if (fruit > 0.01) {
      const fruitColor = mixColor(species.fruitUnripe, species.fruitRipe, ripe);
      blobs.forEach((b) => {
        if (rnd(seed, b.key, 30) > 0.55) return;
        const r = 6 * species.fruitSize * fruit * (0.85 + rnd(seed, b.key, 31) * 0.3);
        const dx = (rnd(seed, b.key, 32) - 0.5) * b.r * 1.2;
        fruits.push({ x: b.x + dx, y: b.y + b.r * 0.35, r, color: fruitColor });
      });
    }

    // Surface roots flare out from the base once the tree is past harvest.
    const trunkW = segments[0]?.w ?? 0;
    const roots = mature > 0.01
      ? [-1, 1, -1, 1].map((side, i) => {
          const len = (16 + rnd(seed, 50 + i, 1) * 14 + (i > 1 ? 10 : 0)) * mature;
          const x0 = BASE_X + side * trunkW * (i > 1 ? 0.15 : 0.3);
          const x1 = x0 + side * len;
          const y1 = BASE_Y + 2 + rnd(seed, 50 + i, 2) * 3;
          return {
            d: `M${x0.toFixed(1)} ${(BASE_Y - 6).toFixed(1)}Q${(x0 + side * len * 0.3).toFixed(1)} ${(BASE_Y - 1).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`,
            w: trunkW * (i > 1 ? 0.35 : 0.5),
          };
        })
      : [];

    // Moss clings to the lower trunk and first branches of an old tree.
    const moss = old > 0.01
      ? segments.filter((sg) => sg.depth <= 1).flatMap((sg, i) => {
          const [x0, y0, , , x2, y2] = sg.d.slice(1).split(/[ Q]/).map(Number);
          return [0.25, 0.6].map((f, j) => ({
            x: lerp(x0, x2, f) + (rnd(seed, 70 + i, j) - 0.5) * sg.w * 0.5,
            y: lerp(y0, y2, f),
            rx: sg.w * 0.35 * old,
            ry: sg.w * 0.22 * old,
          }));
        })
      : [];

    // Ancient trees: a warm halo behind the canopy and sparkles within it.
    let glow: { x: number; y: number; rx: number; ry: number } | null = null;
    if (ancient > 0.01 && blobs.length) {
      const xs = blobs.map((b) => b.x);
      const ys = blobs.map((b) => b.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      // Kept inside the viewBox so the halo fades out instead of being cut off at the top.
      const rx = (Math.max(...xs) - Math.min(...xs)) * 0.75;
      glow = { x: cx, y: cy, rx, ry: Math.min(rx, cy - 2) };
    }
    const sparkles = ancient > 0.01
      ? blobs.filter((b) => rnd(seed, b.key, 40) < 0.25).map((b) => ({
          x: b.x + (rnd(seed, b.key, 41) - 0.5) * b.r * 1.4,
          y: b.y + (rnd(seed, b.key, 42) - 0.5) * b.r * 1.4,
          r: 1.6 + rnd(seed, b.key, 43) * 1.4,
        }))
      : [];

    // Lying pose: rotated 90° about the base (crown to the right) and squashed a little, as if the canopy
    // crumpled on landing. Centered, and lifted just enough that the lower branches stay in view.
    let minX = 0;
    let maxX = 0;
    let maxY = 0;
    const addPoint = (x: number, y: number, r: number) => {
      const rx = BASE_Y - y; // rotate 90°: up becomes right, right becomes down
      const ry = (x - BASE_X) * FALLEN_SQUASH;
      minX = Math.min(minX, rx - r);
      maxX = Math.max(maxX, rx + r);
      maxY = Math.max(maxY, ry + r * FALLEN_SQUASH);
    };
    const pad = 16 * sproutAlpha;
    segments.forEach((sg) => {
      const [x0, y0, , , x2, y2] = sg.d.slice(1).split(/[ Q]/).map(Number);
      addPoint(x0, y0, sg.w / 2);
      addPoint(x2, y2, Math.max(sg.w / 2, pad));
    });
    blobs.forEach((b) => addPoint(b.x, b.y, b.r * 1.05 + 3));
    const fallen = { tx: -(minX + maxX) / 2, ty: -Math.max(0, maxY - 20) };

    return {
      segments, sproutLeaves, blobs, flowers, fruits, bark, barkLight, sproutAlpha, leafDark, leafBase, leafLight,
      roots, moss, glow, sparkles, fallen,
    };
  }, [t, bloom, fruit, ripe, mature, old, ancient, seed, species]);

  const wreck = useMemo(() => (dead ? wreckage(t, seed) : null), [dead, t, seed]);

  // A fallen tree wilts: leaves fade toward brown and the ancient glow goes out.
  const wilt = 0.45 * fall;
  const leafDark = mixColor(art.leafDark, '#5E5230', wilt);
  const leafBase = mixColor(art.leafBase, '#8A7A3E', wilt);
  const leafLight = mixColor(art.leafLight, '#A89656', wilt);
  const pose = fall > 0
    ? `translate(${(BASE_X + art.fallen.tx * fall).toFixed(2)} ${(BASE_Y + art.fallen.ty * fall).toFixed(2)}) ` +
      `scale(1 ${(1 - (1 - FALLEN_SQUASH) * fall).toFixed(3)}) rotate(${(90 * fall).toFixed(2)}) translate(${-BASE_X} ${-BASE_Y})`
    : undefined;

  // The seed stays visible for the first days, cracking open as the shoot emerges.
  const seedAlpha = dead ? 0 : 1 - smooth(0.08, 0.16, t);

  // Camera: start zoomed in on the seed and pull back as the tree grows.
  const zoom = 1 + 1.6 * (1 - smooth(0, 0.5, t));
  const vw = VIEW_W / zoom;
  const vh = VIEW_H / zoom;
  const vx = BASE_X - vw / 2;
  const vy = BASE_Y - (BASE_Y / VIEW_H) * vh;
  const crack = smooth(0.0, 0.06, t);

  return (
    <Svg width={width} height={h} viewBox={`${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`}>
      {seedAlpha > 0 && (
        <G opacity={seedAlpha}>
          <Ellipse cx={BASE_X} cy={BASE_Y + 2} rx={5.5} ry={4} fill="#8A5A3B" />
          <Ellipse cx={BASE_X - 2} cy={BASE_Y + 0.8} rx={2} ry={1.2} fill="#B07A52" />
          {crack > 0 && (
            <Path
              d={`M${BASE_X - 4} ${BASE_Y + 1}L${BASE_X - 1.5} ${BASE_Y + 1 + 1.5 * crack}L${BASE_X + 1} ${BASE_Y + 0.5}L${BASE_X + 4} ${BASE_Y + 1.5 + crack}`}
              stroke="#4B2E1C" strokeWidth={0.8} fill="none" opacity={crack}
            />
          )}
        </G>
      )}

      {wreck && (
        <G>
          {wreck.leaves.map((l, i) => (
            <Path key={`wl${i}`} d={l.d} fill={l.fill} />
          ))}
          {wreck.sticks.map((st, i) => (
            <Path key={`ws${i}`} d={st.d} stroke="#8A6A52" strokeWidth={st.w} strokeLinecap="round" />
          ))}
          <Path d={wreck.stump} fill="#6B4E3A" stroke="#4A3526" strokeWidth={Math.max(0.5, wreck.w * 0.06)} strokeLinejoin="round" />
          <Path
            d={`M${BASE_X - wreck.w * 0.18} ${BASE_Y}L${BASE_X - wreck.w * 0.12} ${BASE_Y - wreck.h * 0.55}`}
            stroke="#8E6A4E" strokeWidth={wreck.w * 0.14} strokeLinecap="round"
          />
        </G>
      )}

      {!dead && (
      <G transform={pose}>
      {art.glow && (
        <>
          <Defs>
            <RadialGradient id={`ancientGlow${seed}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFE38A" stopOpacity={0.75 * ancient} />
              <Stop offset="1" stopColor="#FFE38A" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={art.glow.x} cy={art.glow.y} rx={art.glow.rx} ry={art.glow.ry} fill={`url(#ancientGlow${seed})`} opacity={1 - fall} />
        </>
      )}

      {art.roots.map((r, i) => (
        <Path key={`r${i}`} d={r.d} stroke={art.bark} strokeWidth={r.w} strokeLinecap="round" fill="none" />
      ))}

      {art.segments.map((s, i) => (
        <Path key={`b${i}`} d={s.d} stroke={art.bark} strokeWidth={s.w} strokeLinecap="round" fill="none" />
      ))}
      {art.segments.filter((s) => s.depth <= 1 && s.w > 3).map((s, i) => (
        <Path key={`bh${i}`} d={s.d} stroke={art.barkLight} strokeWidth={s.w * 0.28} strokeLinecap="round" fill="none" transform={`translate(${-s.w * 0.22} 0)`} opacity={0.55} />
      ))}

      {art.moss.map((m, i) => (
        <Ellipse key={`m${i}`} cx={m.x} cy={m.y} rx={m.rx} ry={m.ry} fill="#5E8F45" opacity={0.9} />
      ))}

      {art.sproutAlpha > 0 && (
        <G opacity={art.sproutAlpha}>
          {art.sproutLeaves.map((l, i) => (
            <Path key={`sl${i}`} d={l.d} fill={l.fill} />
          ))}
        </G>
      )}

      {art.blobs.map((b) => (
        <Circle key={`fs${b.key}`} cx={b.x + 2} cy={b.y + 3} r={b.r * 1.05} fill={leafDark} />
      ))}
      {art.blobs.map((b) => (
        <Circle key={`fb${b.key}`} cx={b.x} cy={b.y} r={b.r} fill={leafBase} />
      ))}
      {art.blobs.map((b) => (
        <Circle key={`fh${b.key}`} cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.35} r={b.r * 0.5} fill={leafLight} opacity={0.85} />
      ))}

      {art.flowers.map((f, i) => (
        <G key={`fl${i}`}>
          <Circle cx={f.x} cy={f.y} r={f.r} fill={species.blossom} />
          <Circle cx={f.x} cy={f.y} r={f.r * 0.38} fill={species.blossomCenter} />
        </G>
      ))}

      {art.fruits.map((f, i) => (
        <G key={`fr${i}`}>
          <Path d={`M${f.x} ${f.y - f.r * 0.8}L${f.x + 1} ${f.y - f.r - 3}`} stroke="#5B3A22" strokeWidth={1.2} />
          <Circle cx={f.x} cy={f.y} r={f.r} fill={f.color} />
          <Circle cx={f.x - f.r * 0.35} cy={f.y - f.r * 0.35} r={f.r * 0.3} fill="#FFFFFF" opacity={0.45} />
        </G>
      ))}
      {art.sparkles.map((sp, i) => (
        <G key={`sp${i}`} opacity={ancient * (1 - fall)}>
          <Circle cx={sp.x} cy={sp.y} r={sp.r * 2} fill="#FFF3B0" opacity={0.35} />
          <Circle cx={sp.x} cy={sp.y} r={sp.r * 0.8} fill="#FFFBE6" />
        </G>
      ))}
      </G>
      )}
    </Svg>
  );
}

export const Tree = memo(TreeImpl);
