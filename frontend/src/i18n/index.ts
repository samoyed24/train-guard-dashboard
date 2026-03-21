import { createI18n } from "vue-i18n";
import { messages } from "./messages";

export const supportedLocales = ["zh-CN", "en-US"] as const;
export type AppLocale = (typeof supportedLocales)[number];

const LOCALE_STORAGE_KEY = "app_locale";
const DEFAULT_LOCALE: AppLocale = "zh-CN";

const normalizeLocale = (rawLocale: string | null | undefined): AppLocale => {
  if (!rawLocale) return DEFAULT_LOCALE;
  const normalized = rawLocale.toLowerCase();
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("en")) return "en-US";
  return DEFAULT_LOCALE;
};

const getInitialLocale = (): AppLocale => {
  const persisted = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (persisted) return normalizeLocale(persisted);

  const envLocale = import.meta.env.VITE_DEFAULT_LOCALE as string | undefined;
  if (envLocale) return normalizeLocale(envLocale);

  return normalizeLocale(navigator.language);
};

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: "en-US",
  messages,
});

const applyDocumentLocale = (locale: AppLocale) => {
  document.documentElement.lang = locale;
};

export const setLocale = (locale: string) => {
  const nextLocale = normalizeLocale(locale);
  i18n.global.locale.value = nextLocale;
  localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  applyDocumentLocale(nextLocale);
};

applyDocumentLocale(i18n.global.locale.value as AppLocale);
