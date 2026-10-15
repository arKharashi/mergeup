import { createContext, use, useLayoutEffect, useState, type ReactNode } from 'react';
import type { Bilingual } from '../engine';
import type { KeyValueStore } from '../game/progress';

export type Lang = keyof Bilingual;

const KEY = 'git-together:lang';
/** The key from when the game was called Zumala Git. */
const OLD_KEY = 'zumala-git:lang';

interface LangValue {
  lang: Lang;
  setLang(lang: Lang): void;
  /** The text in the player's language. */
  t(text: Bilingual): string;
}

const LangContext = createContext<LangValue | null>(null);

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/**
 * The interface language: Arabic unless the player picked English. It's a preference of this browser,
 * kept apart from game progress. Sets the page's lang and dir, so the CSS mirrors the layout.
 */
export function LangProvider({ store, children }: { store: KeyValueStore; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => ((store.get(KEY) ?? store.get(OLD_KEY)) === 'en' ? 'en' : 'ar'));

  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);

  const value: LangValue = {
    lang,
    setLang(next) {
      store.set(KEY, next);
      setLangState(next);
    },
    t: (text) => text[lang],
  };
  return <LangContext value={value}>{children}</LangContext>;
}

export function useLang(): LangValue {
  const value = use(LangContext);
  if (!value) throw new Error('useLang needs a <LangProvider> above it');
  return value;
}

/** Switches to the other language. Its label is that language's own name. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  const other: Lang = lang === 'ar' ? 'en' : 'ar';
  return (
    <button type="button" className="btn langbtn" lang={other} onClick={() => setLang(other)}>
      {other === 'en' ? 'English' : 'العربية'}
    </button>
  );
}
