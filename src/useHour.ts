import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * The current local hour (0-23), kept live: re-checked at each minute boundary and whenever
 * the app returns to the foreground, so skies flip from day to dusk to night on their own.
 *
 * Dev-only on web: add `?hour=21` to the URL to preview a time of day.
 */
export function useHour(): number {
  const [hour, setHour] = useState(readHour);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setHour(readHour());
      const now = new Date();
      timer = setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
    };
    tick();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setHour(readHour()));
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return hour;
}

function readHour() {
  if (__DEV__ && Platform.OS === 'web' && typeof location !== 'undefined') {
    const forced = Number(new URLSearchParams(location.search).get('hour'));
    if (location.search.includes('hour=') && forced >= 0 && forced < 24) return Math.floor(forced);
  }
  return new Date().getHours();
}
