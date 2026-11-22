import { create } from 'zustand';

export type FacultyLanguage = 'en' | 'ar';
export const facultyLanguageKey = 'faculty-language';
const legacyKeys = ['hr', 'facilities', 'inventory', 'student-affairs'];

export function readLanguage(): FacultyLanguage {
  try {
    const preference = localStorage.getItem(facultyLanguageKey);
    if (preference === 'en' || preference === 'ar') return preference;
    const migrated = legacyKeys.some(
      (module) => localStorage.getItem(`faculty-${module}-language`) === 'ar',
    )
      ? 'ar'
      : 'en';
    if (legacyKeys.some((module) => localStorage.getItem(`faculty-${module}-language`) !== null)) {
      localStorage.setItem(facultyLanguageKey, migrated);
    }
    return migrated;
  } catch {
    return 'en';
  }
}

export const useFacultyLanguage = create<{
  language: FacultyLanguage;
  setLanguage: (value: FacultyLanguage) => void;
}>((set) => ({
  language: readLanguage(),
  setLanguage(language) {
    try {
      localStorage.setItem(facultyLanguageKey, language);
    } catch {
      /* The in-memory preference still works. */
    }
    set({ language });
  },
}));
