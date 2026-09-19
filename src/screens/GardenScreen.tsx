import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useGardenAmbience } from '../ambience';
import { playSfx } from '../sfx';
import { GardenBackdrop } from '../components/GardenBackdrop';
import { BASE_Y, hashString, Tree, VIEW_H, VIEW_W } from '../components/Tree';
import { skyForHour, SKIES, type SkyMode } from '../components/Scene';
import { dayKey, streakStatus, type StreakStatus } from '../dates';
import { growthFor, SPECIES, stageFor } from '../growth';
import { quoteFor } from '../quotes';
import type { Habit } from '../store';
import { useHour } from '../useHour';
import { C } from '../theme';

function MiniScene({ habit, status, w, h, skyMode }: { habit: Habit; status: StreakStatus; w: number; h: number; skyMode: SkyMode }) {
  const dead = status.health === 'dead';
  const sky = SKIES[skyMode];
  const groundY = h - 22;
  const treeW = w * 0.8;
  const treeH = (treeW * VIEW_H) / VIEW_W;
  return (
    <View style={{ width: w, height: h, overflow: 'hidden' }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`g${habit.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.top} />
            <Stop offset="1" stopColor={sky.bottom} />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={`url(#g${habit.id})`} />
        <Rect y={groundY - 3} width={w} height={h} fill={sky.ground} />
        <Ellipse cx={w / 2} cy={groundY + 3} rx={30} ry={7} fill="#7A4F31" />
      </Svg>
      <View style={{ position: 'absolute', left: (w - treeW) / 2, top: groundY - (treeH * BASE_Y) / VIEW_H }}>
        <Tree
          growth={growthFor(dead ? status.lost : status.streak)}
          species={SPECIES[habit.species]}
          seed={hashString(habit.id)}
          width={treeW}
          height={treeH}
          fall={status.health === 'fallen' ? 1 : 0}
          dead={dead}
        />
      </View>
    </View>
  );
}

interface Props {
  habits: Habit[];
  onOpen: (id: string) => void;
  onToggleToday: (id: string) => void;
  onPlant: () => void;
}

export function GardenScreen({ habits, onOpen, onToggleToday, onPlant }: Props) {
  const insets = useSafeAreaInsets();
  const ambience = useGardenAmbience();
  const { width } = useWindowDimensions();
  const contentW = Math.min(width, 640);
  const cols = contentW > 520 ? 3 : 2;
  const gap = 14;
  const cardW = (contentW - 20 * 2 - gap * (cols - 1)) / cols;
  const today = dayKey();
  const hour = useHour();
  const skyMode = skyForHour(hour);
  const quote = quoteFor(today);

  const doneToday = habits.filter((h) => h.done.includes(today)).length;
  const statuses = habits.map((h) => streakStatus(new Set(h.done)));
  const longest = statuses.length ? Math.max(...statuses.map((st) => st.streak)) : 0;

  const startPlanting = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPlant();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <GardenBackdrop sky={skyMode} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, alignItems: 'center' }}
      >
        <View style={{ width: contentW, paddingHorizontal: 20 }}>
          <View style={s.header}>
            <Text style={[s.title, { flex: 1 }]}>Your Garden</Text>
            <Pressable
              hitSlop={8}
              onPress={ambience.toggle}
              style={({ pressed }) => [s.soundBtn, !ambience.enabled && s.soundBtnOff, pressed && { opacity: 0.7 }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: ambience.enabled }}
              accessibilityLabel="Nature sounds"
            >
              <Text style={s.soundBtnText}>{ambience.enabled ? '🐦' : '🔇'}</Text>
            </Pressable>
          </View>

          <View style={s.quote} accessible accessibilityLabel={`Quote of the day: ${quote.text}, ${quote.author}`}>
            <Text style={s.quoteText}>“{quote.text}”</Text>
            <Text style={s.quoteAuthor}>— {quote.author}</Text>
          </View>

          {habits.length > 0 && (
            <View style={s.stats}>
              <Stat value={`${doneToday}/${habits.length}`} label="watered today" />
              <View style={s.statDivider} />
              <Stat value={`${longest}🔥`} label="best active streak" />
              <View style={s.statDivider} />
              <Stat value={`${habits.length}`} label={habits.length === 1 ? 'tree' : 'trees'} />
            </View>
          )}

          {habits.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 64 }}>🌰</Text>
              <Text style={s.emptyTitle}>Your garden is waiting</Text>
              <Text style={s.emptyText}>
                Plant a seed for a habit you want to build. Check in each day and watch it grow from a tiny sprout into a
                fruit-bearing tree.
              </Text>
              <Pressable style={({ pressed }) => [s.plantBtn, pressed && { opacity: 0.85 }]} onPress={startPlanting}>
                <Text style={s.plantBtnText}>Plant your first seed</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[s.grid, { gap }]}>
              {habits.map((h, i) => {
                const status = statuses[i];
                const { streak } = status;
                const { stage } = stageFor(streak);
                const done = h.done.includes(today);
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => onOpen(h.id)}
                    style={({ pressed }) => [s.card, { width: cardW }, pressed && { transform: [{ scale: 0.97 }] }]}
                  >
                    <MiniScene habit={h} status={status} w={cardW} h={cardW * 0.95} skyMode={skyMode} />
                    <View style={s.cardBody}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardName} numberOfLines={1}>{h.name}</Text>
                        <Text style={s.cardMeta} numberOfLines={1}>
                          {status.health === 'fallen'
                            ? `🪵 Fallen · 🔥 ${streak}`
                            : status.health === 'dead'
                              ? '💀 Destroyed'
                              : `${streak > 0 ? `🔥 ${streak} · ` : ''}${stage.name}`}
                        </Text>
                      </View>
                      <Pressable
                        hitSlop={10}
                        onPress={() => {
                          Haptics.impactAsync(done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          if (!done) playSfx('water');
                          // The last tree of the day watered: a small celebration just after the watering tap.
                          if (!done && doneToday === habits.length - 1) {
                            setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}), 250);
                          }
                          onToggleToday(h.id);
                        }}
                        style={[s.check, done && s.checkDone]}
                        accessibilityLabel={done ? `Undo today's check-in for ${h.name}` : `Check in ${h.name} for today`}
                      >
                        <Text style={[s.checkText, done && { color: '#fff' }]}>{done ? '✓' : '💧'}</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={startPlanting}
                style={({ pressed }) => [s.card, s.plantCard, { width: cardW, minHeight: cardW * 0.95 + 64 }, pressed && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 34 }}>🌰</Text>
                <Text style={s.plantCardText}>Plant a seed</Text>
                <Text style={s.plantCardSub}>Start a new habit</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  soundBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.line,
  },
  soundBtnOff: { backgroundColor: C.card },
  soundBtnText: { fontSize: 20 },
  title: { color: C.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  quote: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.greenSoft },
  quoteText: { color: C.ink, fontSize: 15, lineHeight: 21, fontStyle: 'italic', fontWeight: '500' },
  quoteAuthor: { color: C.inkSoft, fontSize: 12, fontWeight: '700', marginTop: 4 },
  stats: {
    flexDirection: 'row', backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, marginTop: 18, marginBottom: 20,
    borderWidth: 1, borderColor: C.line,
  },
  statDivider: { width: 1, backgroundColor: C.line },
  statValue: { fontSize: 20, fontWeight: '800', color: C.ink },
  statLabel: { fontSize: 11, color: C.inkSoft, marginTop: 2, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: C.line,
    shadowColor: '#3B2F1A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.ink },
  cardMeta: { fontSize: 12, color: C.inkSoft, marginTop: 2, fontWeight: '600' },
  check: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: C.greenSoft, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F2F8F0',
  },
  checkDone: { backgroundColor: C.green, borderColor: C.green },
  checkText: { fontSize: 16, fontWeight: '800', color: C.green },
  plantCard: {
    alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#CFC3A8',
    backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0,
  },
  plantCardText: { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 8 },
  plantCardSub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 12 },
  emptyText: { fontSize: 15, color: C.inkSoft, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  plantBtn: { backgroundColor: C.green, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 28, marginTop: 24 },
  plantBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
