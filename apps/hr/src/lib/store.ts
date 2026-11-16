import { create } from 'zustand';
import type { Language } from './types';
export function readLanguage(): Language {
  try {
    return localStorage.getItem('faculty-hr-language') === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}
export const useUi = create<{ language: Language; setLanguage: (language: Language) => void }>(
  (set) => ({
    language: readLanguage(),
    setLanguage: (language) => {
      try {
        localStorage.setItem('faculty-hr-language', language);
      } catch {
        /* storage can be unavailable */
      }
      set({ language });
    },
  }),
);
