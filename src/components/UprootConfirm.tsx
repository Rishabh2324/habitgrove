import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { playSfx } from '../sfx';
import { C } from '../theme';

interface Pt {
  x: number;
  y: number;
  d: number; // distance from the impact point, used to reveal cracks outward
}

const RAYS = 12;
const RINGS = [14, 34, 75, 135, 215, 320, 460, 620];
const CRACK_MS = 450;

const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, d: a.d + (b.d - a.d) * t });

/** Point along a ray (a polyline running outward) at distance `r` from the impact. */
function pointAt(ray: Pt[], r: number): Pt {
  for (let i = 1; i < ray.length; i++) {
    if (ray[i].d >= r) return lerpPt(ray[i - 1], ray[i], (r - ray[i - 1].d) / (ray[i].d - ray[i - 1].d || 1));
  }
  return ray[ray.length - 1];
}

/** The part of a polyline within `reach` of the impact, so cracks appear to race outward. */
function truncate(pts: Pt[], reach: number): Pt[] {
  if (pts[0].d > reach) return [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].d <= reach) out.push(pts[i]);
    else {
      out.push(lerpPt(pts[i - 1], pts[i], (reach - pts[i - 1].d) / (pts[i].d - pts[i - 1].d || 1)));
      break;
    }
  }
  return out;
}

const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

/** A spider-web fracture: jagged rays from the impact, rings of cracks between them, and a few glinting shards. */
function buildFracture(w: number, h: number, px: number, py: number) {
  const rand = Math.random;
  const maxR = Math.hypot(Math.max(px, w - px), Math.max(py, h - py)) + 30;
  const dist = (x: number, y: number) => Math.hypot(x - px, y - py);

  const rays: Pt[][] = [];
  const base = rand() * Math.PI * 2;
  for (let i = 0; i < RAYS; i++) {
    const a = base + (i * Math.PI * 2) / RAYS + (rand() - 0.5) * 0.35;
    const pts: Pt[] = [{ x: px, y: py, d: 0 }];
    let x = px;
    let y = py;
    while (dist(x, y) < maxR) {
      const step = 22 + rand() * 50;
      const dir = a + (rand() - 0.5) * 0.45;
      x += Math.cos(dir) * step;
      y += Math.sin(dir) * step;
      pts.push({ x, y, d: dist(x, y) });
    }
    rays.push(pts);
  }

  // Short forks splitting off the main rays.
  const forks: Pt[][] = [];
  rays.forEach((ray) => {
    ray.forEach((p, j) => {
      if (j < 2 || rand() > 0.22) return;
      const a = Math.atan2(p.y - py, p.x - px) + (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.35);
      const pts: Pt[] = [p];
      let { x, y } = p;
      for (let k = 0; k < 2 + Math.floor(rand() * 2); k++) {
        x += Math.cos(a + (rand() - 0.5) * 0.4) * (14 + rand() * 26);
        y += Math.sin(a + (rand() - 0.5) * 0.4) * (14 + rand() * 26);
        pts.push({ x, y, d: Math.max(pts[pts.length - 1].d, dist(x, y)) });
      }
      forks.push(pts);
    });
  });

  // Concentric cracks bridging neighbouring rays, bowed slightly toward the impact.
  const rings: { pts: Pt[]; d: number }[] = [];
  const shards: { points: string; d: number; opacity: number }[] = [];
  RINGS.forEach((r, k) => {
    if (r > maxR) return;
    for (let i = 0; i < RAYS; i++) {
      const A = pointAt(rays[i], r * (0.92 + rand() * 0.16));
      const B = pointAt(rays[(i + 1) % RAYS], r * (0.92 + rand() * 0.16));
      if (rand() < 0.75) {
        const pull = 0.88 + rand() * 0.1;
        const mx = px + ((A.x + B.x) / 2 - px) * pull + (rand() - 0.5) * 6;
        const my = py + ((A.y + B.y) / 2 - py) * pull + (rand() - 0.5) * 6;
        rings.push({ pts: [A, { x: mx, y: my, d: r }, B], d: r });
      }
      // Some cells between rings catch the light like loose shards of glass.
      const next = RINGS[k + 1];
      if (next && next <= maxR && rand() < 0.35) {
        const C2 = pointAt(rays[(i + 1) % RAYS], next);
        const D2 = pointAt(rays[i], next);
        shards.push({
          points: [A, B, C2, D2].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
          d: next,
          opacity: 0.04 + rand() * 0.08,
        });
      }
    }
  });

  return { rays, forks, rings, shards, maxR };
}

interface Props {
  habitName: string;
  streak: number;
  totalDays: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Full-screen "shattered glass" confirmation shown before a tree (and its streak) is uprooted. */
export function UprootConfirm({ habitName, streak, totalDays, onCancel, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const { width: w, height: h } = useWindowDimensions();
  const px = w * 0.5;
  const py = h * 0.3;
  const fracture = useMemo(() => buildFracture(w, h, px, py), [w, h, px, py]);

  const crack = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0.8)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const [reach, setReach] = useState(0);

  useEffect(() => {
    playSfx('crack');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    const t = setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}), 180);
    const id = crack.addListener(({ value }) => setReach(value * fracture.maxR));
    Animated.parallel([
      Animated.timing(dim, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(crack, { toValue: 1, duration: CRACK_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.sequence(
        [-12, 11, -8, 6, -3, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true })),
      ),
      Animated.sequence([
        Animated.delay(CRACK_MS - 120),
        Animated.spring(card, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
      ]),
    ]).start();
    return () => {
      clearTimeout(t);
      crack.removeListener(id);
    };
  }, [crack, dim, flash, shake, card, fracture.maxR]);

  const cancel = () => {
    Haptics.selectionAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(dim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(card, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => onCancel());
  };

  const line = (pts: Pt[], key: string, width: number) => {
    const d = toPath(pts);
    return (
      <React.Fragment key={key}>
        <Path d={d} stroke="rgba(0,0,0,0.45)" strokeWidth={width + 1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d={d} stroke="rgba(255,255,255,0.9)" strokeWidth={width} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </React.Fragment>
    );
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={cancel}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: dim }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,8,0.62)' }]} />
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]} pointerEvents="none">
          <Svg width={w} height={h}>
            {fracture.shards.filter((s) => s.d <= reach).map((s, i) => (
              <Polygon key={`s${i}`} points={s.points} fill="#FFFFFF" opacity={s.opacity} />
            ))}
            {fracture.rays.map((r, i) => line(truncate(r, reach), `r${i}`, 1.3))}
            {fracture.forks.map((f, i) => line(truncate(f, reach), `f${i}`, 0.8))}
            {fracture.rings.filter((r) => r.d <= reach).map((r, i) => line(r.pts, `g${i}`, 0.9))}
            <Circle cx={px} cy={py} r={26} fill="#FFFFFF" opacity={0.18} />
            <Circle cx={px} cy={py} r={7} fill="#FFFFFF" opacity={0.85} />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flash }]} />

        <Animated.View
          style={[
            s.card,
            {
              bottom: insets.bottom + 24,
              width: Math.min(w - 32, 420),
              opacity: card,
              transform: [
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
                { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
              ],
            },
          ]}
        >
          <Text style={s.emoji}>💔</Text>
          {streak > 0 ? (
            <>
              <Text style={s.title}>Break your {streak}-day streak?</Text>
              <View style={s.streakRow}>
                <Text style={s.streakOld}>🔥 {streak}</Text>
                <Text style={s.arrow}>→</Text>
                <Text style={s.streakNew}>0</Text>
              </View>
            </>
          ) : (
            <Text style={s.title}>Uproot this tree?</Text>
          )}
          <Text style={s.body}>
            Uprooting “{habitName}” destroys the tree
            {totalDays > 0 ? ` and wipes all ${totalDays} ${totalDays === 1 ? 'day' : 'days'} of progress` : ''}. This can’t be
            undone.
          </Text>
          <Pressable onPress={cancel} style={({ pressed }) => [s.keepBtn, pressed && { opacity: 0.85 }]}>
            <Text style={s.keepText}>🌱  Keep my tree</Text>
          </Pressable>
          <Pressable onPress={onConfirm} style={({ pressed }) => [s.uprootBtn, pressed && { opacity: 0.7 }]}>
            <Text style={s.uprootText}>Uproot anyway</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: {
    position: 'absolute', alignSelf: 'center', backgroundColor: C.card, borderRadius: 28, padding: 22, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 6, textAlign: 'center', letterSpacing: -0.3 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  streakOld: { fontSize: 26, fontWeight: '900', color: C.flame, textDecorationLine: 'line-through' },
  arrow: { fontSize: 20, color: C.inkSoft, fontWeight: '700' },
  streakNew: { fontSize: 26, fontWeight: '900', color: C.danger },
  body: { fontSize: 15, color: C.inkSoft, textAlign: 'center', marginTop: 12, lineHeight: 21 },
  keepBtn: { alignSelf: 'stretch', backgroundColor: C.green, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  keepText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  uprootBtn: {
    alignSelf: 'stretch', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10,
    borderWidth: 1, borderColor: '#E6C9C4',
  },
  uprootText: { color: C.danger, fontSize: 15, fontWeight: '800' },
});
