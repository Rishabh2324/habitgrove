import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { Health } from '../dates';
import { growthFor, type Species } from '../growth';
import { useHour } from '../useHour';
import { BASE_X, BASE_Y, Tree, VIEW_H, VIEW_W } from './Tree';

export type SkyMode = 'dawn' | 'day' | 'dusk' | 'night';

export function skyForHour(h: number): SkyMode {
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}

export const SKIES: Record<SkyMode, { top: string; bottom: string; hill: string; hillFar: string; ground: string }> = {
  dawn: { top: '#FF9A8B', bottom: '#FFE0B5', hill: '#8FC57C', hillFar: '#B8D9A0', ground: '#77B35E' },
  day: { top: '#5DB8F5', bottom: '#D8F0FF', hill: '#86C96F', hillFar: '#B5DE9F', ground: '#6DB055' },
  dusk: { top: '#5B4B8A', bottom: '#FFB38A', hill: '#6E9E62', hillFar: '#9C9F80', ground: '#5E8F4C' },
  night: { top: '#0B1D3A', bottom: '#2F4A7A', hill: '#2F5A3C', hillFar: '#3C5C58', ground: '#2A5236' },
};

const SUN_COLOR: Record<SkyMode, string> = { dawn: '#FFB36B', day: '#FFE066', dusk: '#FF7A45', night: '#FDF6D8' };

/** Animates a number toward `target`, re-rendering on each frame. */
function useAnimatedNumber(target: number, duration: number) {
  const anim = useRef(new Animated.Value(target)).current;
  const [value, setValue] = useState(target);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setValue(v));
    return () => anim.removeListener(id);
  }, [anim]);
  useEffect(() => {
    if (duration <= 0) {
      anim.stopAnimation();
      anim.setValue(target);
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, target, duration]);
  return value;
}

function useLoop(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}

function Cloud({ y, scale, duration, delay, width }: { y: number; scale: number; duration: number; delay: number; width: number }) {
  const p = useLoop(duration, delay);
  const translateX = p.interpolate({ inputRange: [0, 1], outputRange: [-140 * scale, width + 20] });
  return (
    <Animated.View style={[styles.abs, { top: y, transform: [{ translateX }] }]} pointerEvents="none">
      <Svg width={120 * scale} height={50 * scale} viewBox="0 0 120 50">
        <Ellipse cx={60} cy={34} rx={52} ry={14} fill="#FFFFFF" opacity={0.9} />
        <Circle cx={42} cy={26} r={16} fill="#FFFFFF" opacity={0.9} />
        <Circle cx={68} cy={20} r={20} fill="#FFFFFF" opacity={0.9} />
      </Svg>
    </Animated.View>
  );
}

/** Pollen by day, fireflies by night: small glowing dots drifting upward. */
function Mote({ x, y, delay, night }: { x: number; y: number; delay: number; night: boolean }) {
  const p = useLoop(5200, delay);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [0, -70] });
  const translateX = p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 8, 0, -8, 0] });
  const opacity = p.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const size = night ? 5 : 4;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          left: x, top: y, width: size, height: size, borderRadius: size,
          backgroundColor: night ? '#F9F871' : '#FFF6C8',
          shadowColor: '#FFF59D', shadowOpacity: 1, shadowRadius: 6,
          opacity, transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  );
}

function Petal({ x, y, fall, delay, color }: { x: number; y: number; fall: number; delay: number; color: string }) {
  const p = useLoop(4800, delay);
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [0, fall] });
  const translateX = p.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0, 18, -6, 26] });
  const rotate = p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '320deg'] });
  const opacity = p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.abs, styles.petal, { left: x, top: y, backgroundColor: color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }]}
    />
  );
}

/** A burst of falling water drops, replayed whenever `signal` changes. */
function Rain({ signal, width, groundY, centerX }: { signal: number; width: number; groundY: number; centerX: number }) {
  const drops = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      x: centerX + (Math.random() - 0.5) * Math.min(width * 0.6, 220),
      delay: i * 45 + Math.random() * 120,
      v: new Animated.Value(0),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signal],
  );
  useEffect(() => {
    if (!signal) return;
    Animated.parallel(
      drops.map((d) =>
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.timing(d.v, { toValue: 1, duration: 750, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    ).start();
  }, [drops, signal]);
  if (!signal) return null;
  return (
    <>
      {drops.map((d, i) => {
        const translateY = d.v.interpolate({ inputRange: [0, 1], outputRange: [0, groundY + 10] });
        const opacity = d.v.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View key={i} pointerEvents="none" style={[styles.abs, styles.drop, { left: d.x, top: -14, opacity, transform: [{ translateY }] }]} />
        );
      })}
    </>
  );
}

interface SceneProps {
  streak: number; // target (may be animated toward)
  duration: number; // growth animation duration in ms (0 = jump)
  species: Species;
  seed: number;
  width: number;
  height: number;
  waterSignal: number;
  sky?: SkyMode;
  health?: Health;
  lost?: number; // streak of the destroyed tree, drawn as its wreckage
}

export function Scene({ streak, duration, species, seed, width, height, waterSignal, sky: skyProp, health = 'healthy', lost = 0 }: SceneProps) {
  const shown = useAnimatedNumber(streak, duration);
  const dead = health === 'dead';
  const growth = growthFor(dead ? lost : shown);
  // Topples over after a missed day and stands back up once watered.
  const fall = useAnimatedNumber(health === 'fallen' ? 1 : 0, 1300);
  const hour = useHour();
  const skyMode = skyProp ?? skyForHour(hour);
  const sky = SKIES[skyMode];
  const night = skyMode === 'night';

  const groundY = height - 64;
  // High at midday; low on the horizon at dawn, and sinking behind the far hills at dusk.
  const sunY = skyMode === 'day' ? 62 : skyMode === 'dawn' ? groundY - 120 : groundY - 72;
  const treeW = Math.min(width * 1.02, 420);
  const treeH = (treeW * VIEW_H) / VIEW_W;
  const treeLeft = (width - treeW) / 2;
  const treeTop = groundY - (treeH * BASE_Y) / VIEW_H;
  const baseX = treeLeft + (treeW * BASE_X) / VIEW_W;

  // Saplings wave in the breeze; big trees barely move.
  const swayDeg = dead ? 0 : (3.2 - 2.2 * growth.t) * (1 - fall);
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sway]);
  const rotate = sway.interpolate({ inputRange: [-1, 1], outputRange: [`${-swayDeg}deg`, `${swayDeg}deg`] });

  const stars = useMemo(
    () => Array.from({ length: 28 }, () => ({ x: Math.random() * width, y: Math.random() * groundY * 0.6, r: Math.random() * 1.2 + 0.4 })),
    [width, groundY],
  );
  const motes = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({ x: width * 0.15 + Math.random() * width * 0.7, y: groundY - 40 - Math.random() * 180, delay: i * 700 })),
    [width, groundY],
  );
  const petals = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({
      x: baseX - 110 + Math.random() * 200,
      y: treeTop + treeH * 0.2 + Math.random() * treeH * 0.25,
      delay: i * 530,
    })),
    [baseX, treeTop, treeH],
  );

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.top} />
            <Stop offset="1" stopColor={sky.bottom} />
          </LinearGradient>
          <LinearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8B5E3C" />
            <Stop offset="1" stopColor="#5C3B24" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
        {night
          ? (
            <>
              {stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={0.8} />)}
              <Circle cx={width - 70} cy={60} r={22} fill="#FDF6D8" />
              <Circle cx={width - 60} cy={54} r={20} fill={sky.top} />
            </>
          )
          : (
            <>
              <Circle cx={width - 70} cy={sunY} r={46} fill="#FFF3B0" opacity={0.35} />
              <Circle cx={width - 70} cy={sunY} r={28} fill={SUN_COLOR[skyMode]} />
            </>
          )}
        <Path d={`M0 ${groundY - 40} Q ${width * 0.25} ${groundY - 95} ${width * 0.55} ${groundY - 45} T ${width} ${groundY - 60} V ${height} H 0 Z`} fill={sky.hillFar} />
        <Path d={`M0 ${groundY - 12} Q ${width * 0.3} ${groundY - 50} ${width * 0.6} ${groundY - 18} T ${width} ${groundY - 25} V ${height} H 0 Z`} fill={sky.hill} />
        <Rect x={0} y={groundY - 4} width={width} height={height} fill={sky.ground} />
        <Ellipse cx={baseX} cy={groundY + 4} rx={58} ry={13} fill="url(#soil)" />
        <Ellipse cx={baseX} cy={groundY + 1} rx={46} ry={7} fill="#9C6B45" opacity={0.6} />
        {Array.from({ length: 22 }, (_, i) => {
          const gx = (i / 22) * width + ((i * 37) % 11);
          if (Math.abs(gx - baseX) < 64) return null;
          const gy = groundY + 6 + ((i * 13) % 30);
          return <Path key={i} d={`M${gx} ${gy} q -2 -8 -5 -11 M${gx} ${gy} q 1 -9 3 -13 M${gx} ${gy} q 3 -6 7 -8`} stroke={night ? '#23452D' : '#4E8F3E'} strokeWidth={1.6} fill="none" />;
        })}
      </Svg>

      {!night && (
        <>
          <Cloud y={28} scale={0.9} duration={46000} delay={0} width={width} />
          <Cloud y={80} scale={0.6} duration={62000} delay={9000} width={width} />
        </>
      )}

      <Animated.View
        style={[styles.abs, { left: treeLeft, top: treeTop, transformOrigin: `${(BASE_X / VIEW_W) * 100}% ${(BASE_Y / VIEW_H) * 100}%`, transform: [{ rotate }] }]}
      >
        <Tree growth={growth} species={species} seed={seed} width={treeW} height={treeH} fall={fall} dead={dead} />
      </Animated.View>

      {growth.bloom > 0.3 && !dead && fall < 0.5 && petals.map((p, i) => (
        <Petal key={i} x={p.x} y={p.y} fall={groundY - p.y} delay={p.delay} color={species.blossom} />
      ))}
      {motes.map((m, i) => <Mote key={i} x={m.x} y={m.y} delay={m.delay} night={night} />)}
      <Rain signal={waterSignal} width={width} groundY={groundY} centerX={baseX} />
      {night && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,20,50,0.18)' }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  petal: { width: 7, height: 5, borderRadius: 4, borderTopLeftRadius: 0 },
  drop: { width: 5, height: 11, borderRadius: 4, backgroundColor: '#6EC8FF', borderTopLeftRadius: 1, borderTopRightRadius: 1 },
});
