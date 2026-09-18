import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GardenScreen } from './src/screens/GardenScreen';
import { HabitScreen } from './src/screens/HabitScreen';
import { PlantSheet } from './src/screens/PlantSheet';
import { onReminderTapped, syncReminders } from './src/reminders';
import { useHabits } from './src/store';
import { C } from './src/theme';

// Hold the native splash (the app icon) until the garden has loaded, then fade it out.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });

export default function App() {
  const { habits, loaded, plant, toggleDay, remove, setReminder } = useHabits();
  const [openId, setOpenId] = useState<string | null>(null);
  const [planting, setPlanting] = useState(false);
  const open = habits.find((h) => h.id === openId);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // Keep scheduled reminders in step with the garden: on any change, and when the app returns to the
  // foreground (so a new day's reminders get queued and already-watered trees stay quiet).
  useEffect(() => {
    if (!loaded) return;
    syncReminders(habits).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncReminders(habits).catch(() => {});
    });
    return () => sub.remove();
  }, [habits, loaded]);

  // Tapping a reminder opens that tree.
  useEffect(() => onReminderTapped(setOpenId), []);

  // Android hardware back returns from a tree to the garden.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenId(null);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!loaded ? (
        <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.green} />
        </View>
      ) : open ? (
        <HabitScreen
          key={open.id}
          habit={open}
          onBack={() => setOpenId(null)}
          onToggleDay={(key) => toggleDay(open.id, key)}
          onDelete={() => {
            setOpenId(null);
            remove(open.id);
          }}
          onSetReminder={(r) => setReminder(open.id, r)}
        />
      ) : (
        <GardenScreen
          habits={habits}
          onOpen={setOpenId}
          onToggleToday={(id) => toggleDay(id)}
          onPlant={() => setPlanting(true)}
        />
      )}
      <PlantSheet
        visible={planting}
        onClose={() => setPlanting(false)}
        onPlant={(name, species, priorDays) => {
          const id = plant(name, species, priorDays);
          setPlanting(false);
          setOpenId(id);
        }}
      />
    </SafeAreaProvider>
  );
}
