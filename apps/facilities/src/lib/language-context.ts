import { createContext, useContext } from 'react';

export type Language = 'en' | 'ar';
export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (value: string) => string;
} | null>(null);

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
}
