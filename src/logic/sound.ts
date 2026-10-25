import { usePreferences } from '../stores/preferences';
let context: AudioContext | null = null;
export function playSound(kind: 'correct' | 'wrong' | 'reward' | 'tap') {
  if (usePreferences.getState().muted || typeof AudioContext === 'undefined') return;
  try {
    context ??= new AudioContext(); void context.resume().catch(() => {});
    const start = context.currentTime; const notes = kind === 'reward' ? [523, 659, 784] : kind === 'correct' ? [523, 659] : kind === 'wrong' ? [294, 262] : [440];
    notes.forEach((frequency, i) => { const tone = context!.createOscillator(); const volume = context!.createGain(); tone.type = 'sine'; tone.frequency.value = frequency; volume.gain.setValueAtTime(0.0001, start + i * 0.1); volume.gain.exponentialRampToValueAtTime(0.06, start + i * 0.1 + 0.015); volume.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.1 + 0.16); tone.connect(volume); volume.connect(context!.destination); tone.start(start + i * 0.1); tone.stop(start + i * 0.1 + 0.18); });
  } catch { /* Audio is optional on browsers without an available output device. */ }
}
