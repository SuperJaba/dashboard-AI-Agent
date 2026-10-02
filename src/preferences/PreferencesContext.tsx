import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type Language = 'pl' | 'en' | 'hi';

type TranslationKey =
  | 'settings.title'
  | 'settings.theme'
  | 'settings.theme.dark'
  | 'settings.theme.light'
  | 'settings.language'
  | 'settings.serverConfig'
  | 'settings.close'
  | 'sidebar.dashboard'
  | 'sidebar.agents'
  | 'sidebar.workspaces'
  | 'sidebar.addProject'
  | 'sidebar.remote'
  | 'sidebar.addServer'
  | 'sidebar.socketTunnel'
  | 'sidebar.signOut';

const TRANSLATIONS: Record<Language, Record<TranslationKey, string>> = {
  pl: {
    'settings.title': 'Ustawienia',
    'settings.theme': 'Motyw',
    'settings.theme.dark': 'Ciemny',
    'settings.theme.light': 'Jasny',
    'settings.language': 'Język',
    'settings.serverConfig': 'Konfiguracja serwera LLM',
    'settings.close': 'Zamknij',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.agents': 'Agenci AI',
    'sidebar.workspaces': 'Workspaces',
    'sidebar.addProject': 'Dodaj projekt',
    'sidebar.remote': 'Remote',
    'sidebar.addServer': 'Dodaj serwer',
    'sidebar.socketTunnel': 'Socket / Tunel PC',
    'sidebar.signOut': 'Wyloguj',
  },
  en: {
    'settings.title': 'Settings',
    'settings.theme': 'Theme',
    'settings.theme.dark': 'Dark',
    'settings.theme.light': 'Light',
    'settings.language': 'Language',
    'settings.serverConfig': 'LLM Server Configuration',
    'settings.close': 'Close',
    'sidebar.dashboard': 'Dashboard',
    'sidebar.agents': 'AI Agents',
    'sidebar.workspaces': 'Workspaces',
    'sidebar.addProject': 'Add Project',
    'sidebar.remote': 'Remote',
    'sidebar.addServer': 'Add Server',
    'sidebar.socketTunnel': 'Socket / PC Tunnel',
    'sidebar.signOut': 'Sign Out',
  },
  hi: {
    'settings.title': 'सेटिंग्स',
    'settings.theme': 'थीम',
    'settings.theme.dark': 'डार्क',
    'settings.theme.light': 'लाइट',
    'settings.language': 'भाषा',
    'settings.serverConfig': 'LLM सर्वर कॉन्फ़िगरेशन',
    'settings.close': 'बंद करें',
    'sidebar.dashboard': 'डैशबोर्ड',
    'sidebar.agents': 'एआई एजेंट',
    'sidebar.workspaces': 'वर्कस्पेस',
    'sidebar.addProject': 'प्रोजेक्ट जोड़ें',
    'sidebar.remote': 'रिमोट',
    'sidebar.addServer': 'सर्वर जोड़ें',
    'sidebar.socketTunnel': 'सॉकेट / पीसी टनल',
    'sidebar.signOut': 'साइन आउट',
  },
};

interface PreferencesContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'dashboard_theme';
const LANGUAGE_STORAGE_KEY = 'dashboard_language';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') {return 'dark';}
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') {return 'pl';}
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'en' || stored === 'hi' ? stored : 'pl';
}

async function fetchRemoteSettings(): Promise<{ theme: Theme; language: Language } | null> {
  const token = window.localStorage.getItem('dashboard_token');
  if (!token) {return null;}
  try {
    const res = await fetch('/api/user-settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {return null;}
    const data = await res.json();
    return {
      theme: data.theme === 'light' ? 'light' : 'dark',
      language: data.language === 'en' || data.language === 'hi' ? data.language : 'pl',
    };
  } catch {
    return null;
  }
}

function saveRemoteSettings(theme: Theme, language: Language) {
  const token = window.localStorage.getItem('dashboard_token');
  if (!token) {return;}
  fetch('/api/user-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ theme, language }),
  }).catch(() => {
    // Ignore network errors; localStorage still holds the preference.
  });
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);
  const [hydrated, setHydrated] = useState(false);

  // On mount, try to load preferences from the backend (per logged-in user).
  // Falls back to whatever was already read from localStorage if unauthenticated/offline.
  useEffect(() => {
    let active = true;
    fetchRemoteSettings().then(remote => {
      if (!active || !remote) {return;}
      setThemeState(remote.theme);
      setLanguageState(remote.language);
    }).finally(() => {
      if (active) {setHydrated(true);}
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    saveRemoteSettings(next, language);
  };
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    saveRemoteSettings(theme, next);
    // Also sync i18next runtime
    import('../i18n').then(({ i18n }) => {
      i18n.changeLanguage(next).catch(() => {});
    });
  };
  const t = (key: TranslationKey) => TRANSLATIONS[language][key] ?? key;

  // Avoid a flash of default preferences before the backend value is hydrated.
  void hydrated;

  return (
    <PreferencesContext.Provider value={{ theme, setTheme, language, setLanguage, t }}>
      {children}
    </PreferencesContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components
export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
}
