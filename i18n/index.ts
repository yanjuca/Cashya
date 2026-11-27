import { PT, PT_PATTERNS } from './pt';

export type Language = 'en' | 'pt';

/** The app opens in Portuguese; the choice made in Settings → Language is saved and used from then on. */
export const DEFAULT_LANGUAGE: Language = 'pt';

let currentLanguage: Language = DEFAULT_LANGUAGE;

export function getLanguage(): Language {
  return currentLanguage;
}

export function setCurrentLanguage(language: Language): void {
  currentLanguage = language;
}

export function localeFor(language: Language): string {
  return language === 'pt' ? 'pt-BR' : 'en-US';
}

export function getLocale(): string {
  return localeFor(currentLanguage);
}

export function detectDeviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    return locale.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  } catch {
    return 'en';
  }
}

export function translateTo(text: string, language: Language): string {
  if (language === 'en' || !text) return text;

  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return text;
  const [, lead, core, trail] = match;
  if (!core) return text;

  const direct = PT[core];
  if (direct !== undefined) return lead + direct + trail;

  for (const [pattern, build] of PT_PATTERNS) {
    const m = core.match(pattern);
    if (m) return lead + build(m, (s) => translateTo(s, language)) + trail;
  }

  return text;
}

export function translate(text: string): string {
  return translateTo(text, currentLanguage);
}
