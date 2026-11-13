export type LanguageOption = {
  code: string;
  name: string;
  enabled: boolean;
  direction: "ltr" | "rtl";
};

export const languages: readonly LanguageOption[] = [
  { code: "hi", name: "Hindi", enabled: true, direction: "ltr" },
  { code: "bn", name: "Bengali", enabled: false, direction: "ltr" },
  { code: "mr", name: "Marathi", enabled: false, direction: "ltr" },
  { code: "te", name: "Telugu", enabled: false, direction: "ltr" },
  { code: "ta", name: "Tamil", enabled: false, direction: "ltr" },
  { code: "gu", name: "Gujarati", enabled: false, direction: "ltr" },
  { code: "ur", name: "Urdu", enabled: false, direction: "rtl" },
  { code: "kn", name: "Kannada", enabled: false, direction: "ltr" },
  { code: "or", name: "Odia", enabled: false, direction: "ltr" },
  { code: "ml", name: "Malayalam", enabled: false, direction: "ltr" },
  { code: "pa", name: "Punjabi", enabled: false, direction: "ltr" },
  { code: "as", name: "Assamese", enabled: false, direction: "ltr" },
  { code: "mai", name: "Maithili", enabled: false, direction: "ltr" },
  { code: "bhb", name: "Bhili/Bhilodi", enabled: false, direction: "ltr" },
  { code: "sat", name: "Santali", enabled: false, direction: "ltr" },
  { code: "ks", name: "Kashmiri", enabled: false, direction: "rtl" },
  { code: "gon", name: "Gondi", enabled: false, direction: "ltr" },
  { code: "ne", name: "Nepali", enabled: false, direction: "ltr" },
  { code: "sd", name: "Sindhi", enabled: false, direction: "rtl" },
  { code: "doi", name: "Dogri", enabled: false, direction: "ltr" },
  { code: "kok", name: "Konkani", enabled: false, direction: "ltr" },
  { code: "kru", name: "Kurukh", enabled: false, direction: "ltr" },
  { code: "kfy", name: "Khandeshi", enabled: false, direction: "ltr" },
  { code: "tcy", name: "Tulu", enabled: false, direction: "ltr" },
  { code: "mni", name: "Meitei (Manipuri)", enabled: false, direction: "ltr" },
  { code: "brx", name: "Bodo", enabled: false, direction: "ltr" },
  { code: "kha", name: "Khasi", enabled: false, direction: "ltr" },
  { code: "hoc", name: "Ho", enabled: false, direction: "ltr" },
  { code: "grt", name: "Garo", enabled: false, direction: "ltr" },
  { code: "unr", name: "Mundari", enabled: false, direction: "ltr" },
  { code: "trp", name: "Tripuri (Kokborok)", enabled: false, direction: "ltr" },
  { code: "kxu", name: "Kui", enabled: false, direction: "ltr" },
  { code: "en", name: "English", enabled: true, direction: "ltr" }
] as const;

export const enabledLocales = languages.filter((language) => language.enabled).map((language) => language.code);
export const isSupportedLocale = (locale: string): locale is "en" | "hi" => locale === "en" || locale === "hi";
export const localeDirection = (locale: string): "ltr" | "rtl" =>
  languages.find((language) => language.code === locale)?.direction ?? "ltr";
