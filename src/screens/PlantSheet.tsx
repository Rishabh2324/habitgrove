import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPECIES, type SpeciesId } from '../growth';
import { C } from '../theme';

const IDEAS = ['📚 Read 20 minutes', '🧘 Meditate', '🏃 Exercise', '💧 Drink 2L water', '✍️ Journal', '🛌 Sleep by 11'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onPlant: (name: string, species: SpeciesId, priorDays: number) => void;
}

export function PlantSheet({ visible, onClose, onPlant }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<SpeciesId>('apple');
  const [prior, setPrior] = useState('');
  const trimmed = name.trim();
  const priorDays = Math.min(parseInt(prior, 10) || 0, 3650);

  const submit = () => {
    if (!trimmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPlant(trimmed, species, priorDays);
    setName('');
    setSpecies('apple');
    setPrior('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={s.handle} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.title}>Plant a new seed 🌰</Text>
            <Text style={s.sub}>What habit will this tree grow from?</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Read 20 minutes"
              placeholderTextColor="#A8A08D"
              style={s.input}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <View style={s.ideas}>
              {IDEAS.map((idea) => (
                <Pressable key={idea} onPress={() => setName(idea.slice(idea.indexOf(' ') + 1))} style={s.idea}>
                  <Text style={s.ideaText}>{idea}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>Choose your tree</Text>
            <View style={s.speciesGrid}>
              {Object.values(SPECIES).map((sp) => {
                const on = sp.id === species;
                return (
                  <Pressable
                    key={sp.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSpecies(sp.id);
                    }}
                    style={[s.speciesCard, on && s.speciesOn]}
                  >
                    <View style={[s.swatch, { backgroundColor: sp.blossom, borderColor: sp.blossomCenter }]}>
                      <View style={[s.fruit, { backgroundColor: sp.fruitRipe }]} />
                    </View>
                    <Text style={s.speciesName}>{sp.emoji} {sp.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.label}>Already on a streak?</Text>
            <TextInput
              value={prior}
              onChangeText={(t) => setPrior(t.replace(/[^0-9]/g, ''))}
              placeholder="Days done before today (optional)"
              placeholderTextColor="#A8A08D"
              style={[s.input, { marginTop: 0 }]}
              keyboardType="number-pad"
              maxLength={4}
            />
            {priorDays > 0 && (
              <Text style={s.sub}>Your tree starts at a {priorDays}-day streak. Water it today to make it {priorDays + 1}.</Text>
            )}

            <Pressable onPress={submit} disabled={!trimmed} style={[s.btn, !trimmed && { opacity: 0.45 }]}>
              <Text style={s.btnText}>Plant seed</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,30,20,0.35)' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10,
    maxHeight: '90%', width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D5CBB5', alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.inkSoft, marginTop: 4 },
  input: {
    marginTop: 16, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: C.ink,
  },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  idea: { backgroundColor: '#ECE5D5', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 11 },
  ideaText: { fontSize: 13, color: C.ink, fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 22, marginBottom: 10 },
  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  speciesCard: {
    width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: C.card,
    borderWidth: 2, borderColor: C.line,
  },
  speciesOn: { borderColor: C.green, backgroundColor: '#EEF7EC' },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  fruit: { width: 16, height: 16, borderRadius: 8 },
  speciesName: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 6 },
  btn: { backgroundColor: C.green, borderRadius: 18, paddingVertical: 17, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
