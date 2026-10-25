import { create } from 'zustand';
const KEY = 'learning-adventure:preferences:v1';
export interface Preferences { muted: boolean; largeText: boolean; zhuyin: boolean }
export const defaults: Preferences = { muted: true, largeText: false, zhuyin: true };
function load(): Preferences {
  try { const data = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { muted: typeof data.muted === 'boolean' ? data.muted : true, largeText: data.largeText === true, zhuyin: data.zhuyin !== false }; } catch { return defaults; }
}
export const usePreferences = create<Preferences & { error: string | null; change(key: keyof Preferences, value: boolean): void }>((set, get) => ({
  ...load(), error: null, change: (key, value) => {
    const next = { muted: get().muted, largeText: get().largeText, zhuyin: get().zhuyin, [key]: value };
    try { localStorage.setItem(KEY, JSON.stringify(next)); set({ ...next, error: null }); }
    catch { set({ ...next, error: '設定暫時無法保存，關閉後會還原。' }); }
  },
}));
