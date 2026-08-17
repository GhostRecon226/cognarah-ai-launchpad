export interface LanguageOption {
  code: string;
  name: string;
}

// Quick picks shown at the top of the language selector.
export const COMMON_LANGUAGES: LanguageOption[] = [
  { code: "fr", name: "French" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "sw", name: "Swahili" },
  { code: "es", name: "Spanish" },
  { code: "ha", name: "Hausa" },
  { code: "yo", name: "Yoruba" },
];

// Searchable list for anything beyond the quick picks.
export const ALL_LANGUAGES: LanguageOption[] = [
  ...COMMON_LANGUAGES,
  { code: "af", name: "Afrikaans" },
  { code: "am", name: "Amharic" },
  { code: "bn", name: "Bengali" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "fa", name: "Persian" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "id", name: "Indonesian" },
  { code: "ig", name: "Igbo" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ln", name: "Lingala" },
  { code: "ms", name: "Malay" },
  { code: "nl", name: "Dutch" },
  { code: "om", name: "Oromo" },
  { code: "pl", name: "Polish" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "rw", name: "Kinyarwanda" },
  { code: "sn", name: "Shona" },
  { code: "so", name: "Somali" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
  { code: "wo", name: "Wolof" },
  { code: "xh", name: "Xhosa" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "zu", name: "Zulu" },
];

export function languageName(code: string): string {
  const found = ALL_LANGUAGES.find((l) => l.code === code);
  if (found) return found.name;
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

// Right to left scripts we support, used to flip text direction.
const RTL = new Set(["ar", "he", "fa", "ur"]);

export function isRtl(code: string): boolean {
  return RTL.has(code.split("-")[0]);
}
