import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReminderCard } from '../components/ReminderCard';
import { Scene } from '../components/Scene';
import { UprootConfirm } from '../components/UprootConfirm';
import { hashString } from '../components/Tree';
import { addDays, bestStreak, currentStreak, dayKey, parseKey } from '../dates';
import { SPECIES, STAGES, stageFor } from '../growth';
import { playSfx, stopSfx } from '../sfx';
import type { Habit, Reminder } from '../store';
import { C } from '../theme';

interface Props {
  habit: Habit;
  onBack: () => void;
  onToggleDay: (key?: string) => void;
  onDelete: () => void;
  onSetReminder: (reminder: Reminder | null) => void;
}

const TIMELAPSE_MS = 9000;

export function HabitScreen({ habit, onBack, onToggleDay, onDelete, onSetReminder }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const contentW = Math.min(width, 640);
  const species = SPECIES[habit.species];
  const seed = useMemo(() => hashString(habit.id), [habit.id]);

  const done = useMemo(() => new Set(habit.done), [habit.done]);
  const today = dayKey();
  const doneToday = done.has(today);
  const streak = currentStreak(done);
  const best = Math.max(bestStreak(done), streak);
  const { stage, index: stageIndex, next } = stageFor(streak);
  const stageStart = stage.day;
  const progress = next ? (streak - stageStart) / (next.day - stageStart) : 1;
  // Streak is alive from yesterday but today isn't watered yet.
  const atRisk = !doneToday && streak > 0;

  // What the scene is showing. Lags the real streak slightly so the water lands first.
  // Starts as a seed so opening the tree replays its growth up to today.
  const [scene, setScene] = useState({ streak: 0, duration: 0 });
  const [waterSignal, setWaterSignal] = useState(0);
  const [timelapse, setTimelapse] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      stopSfx('timelapse');
    },
    [],
  );

  // Grow from seed to the current streak on open; bigger trees take a little longer.
  useEffect(() => {
    if (streak > 0) later(() => setScene({ streak: prevStreak.current, duration: 900 + 1600 * Math.min(streak, 66) / 66 }), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevStreak = useRef(streak);
  useEffect(() => {
    const prev = prevStreak.current;
    prevStreak.current = streak;
    if (prev === streak || timelapse) return;
    const grew = streak > prev;
    later(() => setScene({ streak, duration: grew ? 1800 : 1200 }), grew ? 650 : 0);
    if (grew && stageFor(streak).index > stageFor(prev).index) {
      const st = stageFor(streak).stage;
      later(() => {
        setBanner(`${st.emoji}  Your tree is now: ${st.name}!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, 1900);
      later(() => setBanner(null), 5200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streak]);

  const bannerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(bannerAnim, { toValue: banner ? 1 : 0, useNativeDriver: true, friction: 6 }).start();
  }, [banner, bannerAnim]);

  const water = () => {
    if (!doneToday) {
      setWaterSignal((n) => n + 1);
      playSfx('water');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onToggleDay();
  };

  const playTimelapse = () => {
    setTimelapse(true);
    playSfx('timelapse');
    setScene({ streak: 0, duration: 0 });
    later(() => setScene({ streak: Math.max(70, prevStreak.current), duration: TIMELAPSE_MS }), 60);
    later(() => setScene({ streak: prevStreak.current, duration: 1500 }), TIMELAPSE_MS + 1800);
    later(() => setTimelapse(false), TIMELAPSE_MS + 3400);
  };

  // Calendar: last 5 full weeks, Monday-first, ending with the current week.
  const weeks = useMemo(() => {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 0 = Monday
    const start = addDays(now, -dow - 28);
    return Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  }, []);

  const sceneH = Math.max(340, Math.min(height * 0.52, 520));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, alignItems: 'center' }} bounces={false}>
        <View style={{ width, alignItems: 'center' }}>
          <Scene
            streak={scene.streak}
            duration={scene.duration}
            species={species}
            seed={seed}
            width={width}
            height={sceneH + insets.top}
            waterSignal={waterSignal}
          />
          <View style={[s.topBar, { top: insets.top + 8, width: contentW }]}>
            <Pressable onPress={onBack} style={s.glassBtn} hitSlop={8}>
              <Text style={s.glassText}>‹  Garden</Text>
            </Pressable>
            <Pressable onPress={playTimelapse} disabled={timelapse} style={[s.glassBtn, timelapse && { opacity: 0.6 }]} hitSlop={8}>
              <Text style={s.glassText}>{timelapse ? 'Growing…' : '▶  Time-lapse'}</Text>
            </Pressable>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              s.banner,
              {
                top: insets.top + 64,
                opacity: bannerAnim,
                transform: [{ scale: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              },
            ]}
          >
            <Text style={s.bannerText}>{banner}</Text>
          </Animated.View>
        </View>

        <View style={[s.sheet, { width: contentW }]}>
          <Text style={s.name}>{habit.name}</Text>
          <Text style={s.species}>{species.emoji} {species.name} tree · planted {formatDate(habit.createdAt)}</Text>

          <View style={s.streakRow}>
            <View style={s.streakBox}>
              <Text style={s.streakNum}>{streak}</Text>
              <Text style={s.streakLabel}>day streak 🔥</Text>
            </View>
            <View style={s.streakBox}>
              <Text style={[s.streakNum, { color: C.ink }]}>{best}</Text>
              <Text style={s.streakLabel}>best streak 🏆</Text>
            </View>
            <View style={s.streakBox}>
              <Text style={[s.streakNum, { color: C.ink }]}>{habit.done.length}</Text>
              <Text style={s.streakLabel}>total days 💧</Text>
            </View>
          </View>

          <Pressable
            onPress={water}
            style={({ pressed }) => [s.waterBtn, doneToday && s.waterBtnDone, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <Text style={[s.waterText, doneToday && { color: C.greenDark }]}>
              {doneToday ? '✓  Watered today · tap to undo' : '💧  Water today'}
            </Text>
          </Pressable>
          {atRisk && (
            <Text style={s.risk}>Your {streak}-day streak is still alive — water today to keep it growing.</Text>
          )}

          <View style={s.card}>
            <View style={s.stageHeader}>
              <Text style={{ fontSize: 30 }}>{stage.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.stageName}>{stage.name}</Text>
                <Text style={s.stageBlurb}>{stage.blurb}</Text>
              </View>
            </View>
            {next ? (
              <>
                <View style={s.progressTrack}>
                  <ProgressFill value={progress} />
                </View>
                <Text style={s.progressLabel}>
                  {next.day - streak} more {next.day - streak === 1 ? 'day' : 'days'} until {next.emoji} {next.name}
                </Text>
              </>
            ) : (
              <Text style={s.progressLabel}>Fully grown. Keep watering to keep it fruiting.</Text>
            )}
          </View>

          <ReminderCard reminder={habit.reminder} onChange={onSetReminder} />

          <Text style={s.section}>Growth journey</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {STAGES.map((st, i) => {
              const reached = i <= stageIndex;
              return (
                <View key={st.name} style={[s.chip, reached && s.chipOn, i === stageIndex && s.chipNow]}>
                  <Text style={{ fontSize: 20, opacity: reached ? 1 : 0.35 }}>{st.emoji}</Text>
                  <Text style={[s.chipName, !reached && { color: '#A59E8C' }]}>{st.name}</Text>
                  <Text style={s.chipDay}>day {st.day}</Text>
                </View>
              );
            })}
          </ScrollView>

          <Text style={s.section}>Last 5 weeks</Text>
          <View style={s.card}>
            <View style={s.calRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <Text key={i} style={s.calHead}>{d}</Text>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={wi} style={s.calRow}>
                {week.map((d) => {
                  const key = dayKey(d);
                  const future = key > today;
                  const on = done.has(key);
                  return (
                    <Pressable
                      key={key}
                      disabled={future}
                      onPress={() => {
                        // Filling in a day is a watering, so it feels like one; clearing it is a lighter tap.
                        Haptics.impactAsync(on ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        onToggleDay(key);
                      }}
                      style={[s.calCell, on && s.calCellOn, key === today && s.calToday, future && { opacity: 0.25 }]}
                    >
                      <Text style={[s.calText, on && { color: '#fff' }]}>{d.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Text style={s.calHint}>Forgot a day? Tap it to fill it in.</Text>
          </View>

          <Pressable onPress={() => setConfirmDelete(true)} style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}>
            <Text style={s.deleteText}>Uproot tree</Text>
          </Pressable>
        </View>
      </ScrollView>
      {confirmDelete && (
        <UprootConfirm
          habitName={habit.name}
          streak={streak}
          totalDays={habit.done.length}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            playSfx('uproot');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
            onDelete();
          }}
        />
      )}
    </View>
  );
}

function ProgressFill({ value }: { value: number }) {
  const v = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, value]);
  return (
    <Animated.View
      style={[s.progressFill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]}
    />
  );
}

function formatDate(key: string) {
  return parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const s = StyleSheet.create({
  topBar: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  glassBtn: { backgroundColor: 'rgba(255,255,255,0.75)', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20 },
  glassText: { color: C.ink, fontWeight: '700', fontSize: 14 },
  banner: {
    position: 'absolute', alignSelf: 'center', backgroundColor: '#FFFCF5', paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  bannerText: { color: C.ink, fontWeight: '800', fontSize: 16 },
  sheet: {
    backgroundColor: C.bg, marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22,
  },
  name: { fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  species: { fontSize: 14, color: C.inkSoft, marginTop: 4, fontWeight: '600' },
  streakRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  streakBox: { flex: 1, backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  streakNum: { fontSize: 28, fontWeight: '900', color: C.flame },
  streakLabel: { fontSize: 12, color: C.inkSoft, fontWeight: '600', marginTop: 2 },
  waterBtn: {
    marginTop: 16, backgroundColor: C.water, borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    shadowColor: C.water, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  waterBtnDone: { backgroundColor: C.greenSoft, shadowOpacity: 0, elevation: 0 },
  waterText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  risk: { color: C.flame, fontWeight: '700', fontSize: 13, textAlign: 'center', marginTop: 10 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginTop: 16, borderWidth: 1, borderColor: C.line },
  stageHeader: { flexDirection: 'row', alignItems: 'center' },
  stageName: { fontSize: 18, fontWeight: '800', color: C.ink },
  stageBlurb: { fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  progressTrack: { height: 10, backgroundColor: '#ECE5D5', borderRadius: 5, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: C.green, borderRadius: 5 },
  progressLabel: { fontSize: 13, color: C.inkSoft, marginTop: 8, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '800', color: C.ink, marginTop: 24, marginBottom: 10 },
  chip: { width: 86, alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: '#EFE8D8' },
  chipOn: { backgroundColor: C.greenSoft },
  chipNow: { borderWidth: 2, borderColor: C.green },
  chipName: { fontSize: 11, fontWeight: '800', color: C.ink, marginTop: 4, textAlign: 'center' },
  chipDay: { fontSize: 10, color: C.inkSoft, marginTop: 1 },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calHead: { width: 36, textAlign: 'center', fontSize: 12, color: C.inkSoft, fontWeight: '700' },
  calCell: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EBDD' },
  calCellOn: { backgroundColor: C.green },
  calToday: { borderWidth: 2, borderColor: C.water },
  calText: { fontSize: 13, fontWeight: '700', color: C.ink },
  calHint: { fontSize: 12, color: C.inkSoft, textAlign: 'center', marginTop: 6 },
  deleteBtn: { marginTop: 28, paddingVertical: 14, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#E6C9C4' },
  deleteText: { color: C.danger, fontWeight: '700' },
});
