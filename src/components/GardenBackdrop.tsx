import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C } from '../theme';
import { SKIES, type SkyMode } from './Scene';
import { LEAF_PATH, mixColor } from './Tree';

// A quiet, slow-moving scene behind the garden that follows the real time of day:
// sunrise at dawn, a bright sun by day, a low setting sun at dusk, and a moon with stars and fireflies at night.
// Everything is kept faint so the cards stay the focus.

const LEAF_COLORS = ['#6FAE5C', '#8BC34A', '#A5C85A', '#E0B04A', '#E48A5C', '#F2A7B8'];
const LEAF_COUNT = 12;
const FIREFLY_COUNT = 14;
const STAR_COUNT = 34;

const THEME: Record<SkyMode, {
  tint: number; // strength of the sky wash over the page
  body: { x: number; y: number; color: string; glow: string } | null; // sun position as fractions of the screen
  cloud: string | null;
}> = {
  dawn: { tint: 0.26, body: { x: 0.8, y: 0.24, color: '#FFB36B', glow: '#FFD8A8' }, cloud: '#FFE6DC' },
  day: { tint: 0.2, body: { x: 0.84, y: 0.1, color: '#FFD84D', glow: '#FFF1A8' }, cloud: '#FFFFFF' },
  dusk: { tint: 0.32, body: { x: 0.72, y: 1, color: '#FF7A45', glow: '#FFB38A' }, cloud: '#F8CDBE' }, // y is overridden: it sits on the hills
  night: { tint: 0.36, body: null, cloud: null },
};

/** Linear 0→1 loop that starts part-way through, so elements are already spread out on first render. */
function useLoop(duration: number, start: number, run: boolean) {
  const v = useRef(new Animated.Value(start)).current;
  useEffect(() => {
    if (!run) return;
    let anim: Animated.CompositeAnimation;
    const first = Animated.timing(v, { toValue: 1, duration: duration * (1 - start), easing: Easing.linear, useNativeDriver: true });
    first.start(({ finished }) => {
      if (!finished) return;
      v.setValue(0);
      anim = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
      anim.start();
    });
    return () => {
      first.stop();
      anim?.stop();
    };
  }, [v, duration, start, run]);
  return v;
}

/** Smooth back-and-forth 0↔1, for swaying, breathing and twinkling. */
function usePingPong(duration: number, run: boolean, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    const ease = Easing.inOut(Easing.sin);
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
        ]),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, duration, run, delay]);
  return v;
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Deterministic pseudo-random in [0, 1) so layouts stay stable across re-renders. */
function rand(seed: number, n: number) {
  const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Leaf({ w, h, run, seed }: { w: number; h: number; run: boolean; seed: number }) {
  const r = (n: number) => rand(seed, n);
  const size = 14 + r(1) * 16;
  const fall = useLoop(16000 + r(3) * 12000, r(4), run);
  const sway = usePingPong(1800 + r(5) * 1600, run);
  const swing = 20 + r(7) * 30;
  const spin = r(8) > 0.5 ? 1 : -1;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: r(2) * w,
        top: -size * 2,
        opacity: 0.5 + r(9) * 0.5,
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, h + size * 4] }) },
          { translateX: sway.interpolate({ inputRange: [0, 1], outputRange: [-swing, swing] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin * (240 + r(10) * 240)}deg`] }) },
          { rotateX: sway.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '40deg'] }) },
        ],
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={LEAF_PATH} fill={LEAF_COLORS[Math.floor(r(6) * LEAF_COLORS.length)]} />
        <Path d="M12 5v16" stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
      </Svg>
    </Animated.View>
  );
}

function Firefly({ w, h, run, seed }: { w: number; h: number; run: boolean; seed: number }) {
  const r = (n: number) => rand(seed, n);
  const glow = usePingPong(1400 + r(1) * 1800, run, r(2) * 2000);
  const driftX = usePingPong(3000 + r(3) * 3000, run);
  const driftY = usePingPong(2600 + r(4) * 3400, run);
  const dx = 20 + r(5) * 40;
  const dy = 14 + r(6) * 30;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: r(7) * w,
        top: h * (0.35 + r(8) * 0.6),
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F9F871',
        shadowColor: '#FFF59D',
        shadowOpacity: 1,
        shadowRadius: 8,
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }),
        transform: [
          { translateX: driftX.interpolate({ inputRange: [0, 1], outputRange: [-dx, dx] }) },
          { translateY: driftY.interpolate({ inputRange: [0, 1], outputRange: [-dy, dy] }) },
        ],
      }}
    />
  );
}

function Star({ w, h, run, seed }: { w: number; h: number; run: boolean; seed: number }) {
  const r = (n: number) => rand(seed, n);
  const twinkle = usePingPong(1200 + r(1) * 2400, run, r(2) * 3000);
  const size = 1.5 + r(3) * 2.5;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: r(4) * w,
        top: r(5) * h * 0.7,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#FFFFFF',
        opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
      }}
    />
  );
}

function Cloud({ w, top, scale, duration, start, run, color }: {
  w: number; top: number; scale: number; duration: number; start: number; run: boolean; color: string;
}) {
  const drift = useLoop(duration, start, run);
  const cw = 180 * scale;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        left: 0,
        transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-cw, w + cw] }) }],
      }}
    >
      <Svg width={cw} height={70 * scale} viewBox="0 0 180 70">
        <Ellipse cx={60} cy={45} rx={50} ry={22} fill={color} />
        <Ellipse cx={100} cy={32} rx={42} ry={28} fill={color} />
        <Ellipse cx={135} cy={46} rx={40} ry={20} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/** Sun with a soft breathing halo; at dawn it bobs gently upward, by day its rays slowly turn. */
function Sun({ w, h, mode, run, cy }: { w: number; h: number; mode: SkyMode; run: boolean; cy?: number }) {
  const body = THEME[mode].body!;
  const breathe = usePingPong(4000, run);
  const turn = useLoop(60000, 0, run && mode === 'day');
  const r = Math.max(34, Math.min(60, w * 0.09));
  const box = r * 5;
  const c = box / 2;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: w * body.x - c,
        top: (cy ?? h * body.y) - c,
        width: box,
        height: box,
        transform: [{ translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0, mode === 'dawn' ? -8 : 0] }) }],
      }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }],
        }]}
      >
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0.2" stopColor={body.glow} stopOpacity={0.9} />
              <Stop offset="1" stopColor={body.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill="url(#sunGlow)" />
        </Svg>
      </Animated.View>
      {mode === 'day' && (
        <Animated.View
          style={[StyleSheet.absoluteFill, {
            transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }]}
        >
          <Svg width={box} height={box}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <Path
                  key={i}
                  d={`M${c + Math.cos(a) * r * 1.35} ${c + Math.sin(a) * r * 1.35} L${c + Math.cos(a) * r * 1.8} ${c + Math.sin(a) * r * 1.8}`}
                  stroke={body.color}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        </Animated.View>
      )}
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} fill={body.color} />
      </Svg>
    </Animated.View>
  );
}

function Moon({ w, h, run }: { w: number; h: number; run: boolean }) {
  const breathe = usePingPong(5000, run);
  const r = Math.max(30, Math.min(52, w * 0.08));
  const box = r * 5;
  const c = box / 2;
  return (
    <View style={{ position: 'absolute', left: w * 0.82 - c, top: h * 0.12 - c, width: box, height: box }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, {
          opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] }),
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
        }]}
      >
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0.2" stopColor="#FFF7D6" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#FFF7D6" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill="url(#moonGlow)" />
        </Svg>
      </Animated.View>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        {/* Crescent: outer arc on the right, inner elliptical arc carves out the shadow side. */}
        <Path d={`M${c} ${c - r} A${r} ${r} 0 1 1 ${c} ${c + r} A${r * 0.62} ${r} 0 1 0 ${c} ${c - r} Z`} fill="#FDF3C4" />
        <Circle cx={c + r * 0.55} cy={c - r * 0.25} r={r * 0.09} fill="#EADFA8" />
        <Circle cx={c + r * 0.7} cy={c + r * 0.35} r={r * 0.06} fill="#EADFA8" />
      </Svg>
    </View>
  );
}

export function GardenBackdrop({ sky }: { sky: SkyMode }) {
  const { width: w, height: h } = useWindowDimensions();
  const run = !useReduceMotion();
  const theme = THEME[sky];
  const colors = SKIES[sky];
  const night = sky === 'night';
  const seeds = useMemo(() => Array.from({ length: Math.max(LEAF_COUNT, FIREFLY_COUNT, STAR_COUNT) }, (_, i) => i + 1), []);
  const hillsH = Math.min(160, h * 0.18);
  const pageBottom = mixColor(C.bg, colors.bottom, theme.tint * 0.4); // what the washed page looks like at the bottom

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {/* Sky wash: strongest at the top, fading into the page so text stays readable. */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.top} stopOpacity={theme.tint} />
            <Stop offset="0.7" stopColor={colors.bottom} stopOpacity={theme.tint * 0.6} />
            <Stop offset="1" stopColor={colors.bottom} stopOpacity={theme.tint * 0.4} />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill="url(#wash)" />
      </Svg>

      {night && (
        <View style={[StyleSheet.absoluteFill, { opacity: 0.8 }]}>
          {seeds.slice(0, STAR_COUNT).map((s) => <Star key={s} seed={s} w={w} h={h} run={run} />)}
        </View>
      )}

      <View style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}>
        {night ? <Moon w={w} h={h} run={run} /> : <Sun key={sky} w={w} h={h} mode={sky} run={run} cy={sky === 'dusk' ? h - hillsH * 0.62 : undefined} />}
      </View>

      {/* Faint rolling hills along the bottom. Painted solid (pre-blended with the page) so the dusk sun sets behind them. */}
      <Svg width={w} height={hillsH} style={{ position: 'absolute', bottom: 0 }}>
        <Path d={`M0 ${hillsH * 0.45} Q ${w * 0.25} ${hillsH * 0.05} ${w * 0.55} ${hillsH * 0.4} T ${w} ${hillsH * 0.3} V ${hillsH} H 0 Z`} fill={mixColor(pageBottom, colors.hillFar, 0.3)} />
        <Path d={`M0 ${hillsH * 0.75} Q ${w * 0.3} ${hillsH * 0.4} ${w * 0.6} ${hillsH * 0.7} T ${w} ${hillsH * 0.6} V ${hillsH} H 0 Z`} fill={mixColor(pageBottom, colors.hill, 0.3)} />
      </Svg>

      {theme.cloud && (
        <View style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}>
          <Cloud w={w} top={h * 0.08} scale={1} duration={90000} start={0.3} run={run} color={theme.cloud} />
          <Cloud w={w} top={h * 0.28} scale={0.7} duration={120000} start={0.75} run={run} color={theme.cloud} />
          <Cloud w={w} top={h * 0.55} scale={0.85} duration={105000} start={0.1} run={run} color={theme.cloud} />
        </View>
      )}

      {night ? (
        <View style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}>
          {seeds.slice(0, FIREFLY_COUNT).map((s) => <Firefly key={s} seed={s} w={w} h={h} run={run} />)}
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}>
          {seeds.slice(0, LEAF_COUNT).map((s) => <Leaf key={s} seed={s} w={w} h={h} run={run} />)}
        </View>
      )}
    </View>
  );
}
