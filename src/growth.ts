export type SpeciesId = 'apple' | 'cherry' | 'orange' | 'lemon' | 'plum' | 'peach';

export interface Species {
  id: SpeciesId;
  name: string;
  emoji: string;
  blossom: string; // petal color
  blossomCenter: string;
  fruitUnripe: string;
  fruitRipe: string;
  fruitSize: number; // relative
  leaf: [string, string, string]; // shadow, base, highlight
}

export const SPECIES: Record<SpeciesId, Species> = {
  apple: {
    id: 'apple', name: 'Apple', emoji: '🍎',
    blossom: '#FFE4EC', blossomCenter: '#F7B733',
    fruitUnripe: '#9ACD32', fruitRipe: '#E0312B', fruitSize: 1,
    leaf: ['#2F6B3A', '#3F8F4A', '#6CBF5B'],
  },
  cherry: {
    id: 'cherry', name: 'Cherry', emoji: '🍒',
    blossom: '#FFB7D0', blossomCenter: '#E75A8C',
    fruitUnripe: '#C9D66B', fruitRipe: '#A4102D', fruitSize: 0.7,
    leaf: ['#2E6440', '#3B8452', '#66B86A'],
  },
  orange: {
    id: 'orange', name: 'Orange', emoji: '🍊',
    blossom: '#FFFFFF', blossomCenter: '#FFD34E',
    fruitUnripe: '#8DBF3F', fruitRipe: '#F7901E', fruitSize: 1.05,
    leaf: ['#1F5A33', '#2E7A45', '#56A85A'],
  },
  lemon: {
    id: 'lemon', name: 'Lemon', emoji: '🍋',
    blossom: '#FFFDF2', blossomCenter: '#C9B6E4',
    fruitUnripe: '#A6C94A', fruitRipe: '#FFE03D', fruitSize: 0.95,
    leaf: ['#285E35', '#377F45', '#62AE55'],
  },
  plum: {
    id: 'plum', name: 'Plum', emoji: '🟣',
    blossom: '#F4ECFF', blossomCenter: '#B48CDB',
    fruitUnripe: '#A2B85C', fruitRipe: '#6B2C91', fruitSize: 0.85,
    leaf: ['#34583A', '#46784B', '#72A767'],
  },
  peach: {
    id: 'peach', name: 'Peach', emoji: '🍑',
    blossom: '#FF9EB5', blossomCenter: '#C2185B',
    fruitUnripe: '#C5D46A', fruitRipe: '#FF9A6B', fruitSize: 1,
    leaf: ['#2F643A', '#40874A', '#78C06A'],
  },
};

export interface Stage {
  name: string;
  day: number; // streak day this stage begins
  emoji: string;
  blurb: string;
}

// 66 days: the average time it takes for a habit to become automatic. Later milestones reward keeping it going.
export const STAGES: Stage[] = [
  { day: 0, name: 'Seed', emoji: '🌰', blurb: 'Planted and waiting. Check in to wake it up.' },
  { day: 1, name: 'Sprouting', emoji: '🌱', blurb: 'A tiny shoot breaks through the soil.' },
  { day: 4, name: 'Seedling', emoji: '🌿', blurb: 'First true leaves reach for the sun.' },
  { day: 10, name: 'Sapling', emoji: '🪴', blurb: 'A slender trunk is forming.' },
  { day: 21, name: 'Young Tree', emoji: '🌳', blurb: 'Branches spread and the canopy fills in.' },
  { day: 35, name: 'Grown Tree', emoji: '🌳', blurb: 'Strong roots. This habit is taking hold.' },
  { day: 45, name: 'In Bloom', emoji: '🌸', blurb: 'Your tree is covered in blossoms.' },
  { day: 55, name: 'Bearing Fruit', emoji: '🍏', blurb: 'The blossoms are turning into fruit.' },
  { day: 66, name: 'Harvest', emoji: '🧺', blurb: 'Fully ripe. This habit is part of you now.' },
  { day: 100, name: 'Century', emoji: '🏅', blurb: 'A hundred days. Roots spread wide and the trunk grows stout.' },
  { day: 180, name: 'Old Growth', emoji: '🌲', blurb: 'Half a year. Moss on the bark and a deep, broad canopy.' },
  { day: 365, name: 'Ancient Tree', emoji: '✨', blurb: 'A full year. Your tree glows and blooms forever.' },
];

export function stageFor(streak: number): { stage: Stage; index: number; next?: Stage } {
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (streak >= STAGES[i].day) index = i;
  return { stage: STAGES[index], index, next: STAGES[index + 1] };
}

function interp(x: number, pts: [number, number][]): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x0, y0] = pts[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return pts[pts.length - 1][1];
}

export interface Growth {
  t: number; // structural growth 0..1 (seed → full tree)
  bloom: number; // blossoms 0..1
  fruit: number; // fruit size 0..1
  ripe: number; // fruit colour 0..1
  mature: number; // 66→100: surface roots, thicker trunk
  old: number; // 100→180: moss, wider and deeper canopy
  ancient: number; // 300→365: golden glow and sparkles
}

/** Maps a (possibly fractional, for animation) streak to growth parameters. */
export function growthFor(streak: number): Growth {
  const t = interp(streak, [
    [0, 0], [1, 0.07], [4, 0.2], [10, 0.38], [21, 0.62], [35, 0.9], [45, 1],
  ]);
  // Blossoms return alongside the fruit once the tree is ancient.
  const bloom = interp(streak, [[40, 0], [45, 0.7], [50, 1], [56, 1], [62, 0], [300, 0], [365, 0.6]]);
  const fruit = interp(streak, [[54, 0], [60, 0.8], [66, 1]]);
  const ripe = interp(streak, [[57, 0], [66, 1]]);
  const mature = interp(streak, [[66, 0], [100, 1]]);
  const old = interp(streak, [[100, 0], [180, 1]]);
  const ancient = interp(streak, [[300, 0], [365, 1]]);
  return { t, bloom, fruit, ripe, mature, old, ancient };
}
