import { type AudioPlayer, createAudioPlayer } from 'expo-audio';

// Short synthesized effects (see scripts/gen-sfx.py, encoded by scripts/build-audio.sh). Players live at
// module scope so a sound keeps playing after the screen that triggered it unmounts (e.g. uprooting closes the tree).
const SOUNDS = {
  water: { source: require('../assets/sounds/water.m4a'), volume: 0.7 },
  uproot: { source: require('../assets/sounds/uproot.m4a'), volume: 0.8 },
  timelapse: { source: require('../assets/sounds/timelapse.m4a'), volume: 0.8 },
  crack: { source: require('../assets/sounds/crack.m4a'), volume: 0.8 },
};

type Sfx = keyof typeof SOUNDS;

const players = Object.fromEntries(
  Object.entries(SOUNDS).map(([name, { source, volume }]) => {
    const player = createAudioPlayer(source);
    player.volume = volume;
    return [name, player];
  }),
) as Record<Sfx, AudioPlayer>;

export function playSfx(name: Sfx) {
  const p = players[name];
  p.seekTo(0).catch(() => {});
  p.play();
}

export function stopSfx(name: Sfx) {
  players[name].pause();
}
