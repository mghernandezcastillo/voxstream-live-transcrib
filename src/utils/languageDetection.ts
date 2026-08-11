export type OptimizedLanguage = "english" | "spanish";

const SPANISH_WORDS = new Set([
  "a", "al", "algo", "como", "con", "cuando", "de", "del", "donde", "el",
  "ella", "en", "es", "esta", "este", "hay", "la", "las", "le", "lo", "los",
  "más", "me", "muy", "no", "nos", "o", "para", "pero", "por", "porque", "que",
  "se", "sin", "sobre", "son", "su", "sus", "también", "todo", "un", "una", "y", "ya",
]);

const ENGLISH_WORDS = new Set([
  "a", "all", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do",
  "for", "from", "have", "he", "her", "his", "i", "in", "is", "it", "my", "not",
  "of", "on", "one", "or", "say", "she", "that", "the", "their", "there", "they",
  "this", "to", "was", "we", "will", "with", "would", "you", "your",
]);

export interface LanguageDetectionResult {
  language: OptimizedLanguage;
  confidence: number;
  englishScore: number;
  spanishScore: number;
}

/**
 * Chooses between English and Spanish after Whisper's one-time probe.
 * This is intentionally limited to the two optimized Moonshine models.
 */
export function detectEnglishOrSpanish(
  text: string,
  fallback: OptimizedLanguage = "spanish",
): LanguageDetectionResult {
  const lower = text.toLocaleLowerCase();
  const words = lower.match(/[\p{L}']+/gu) ?? [];
  let spanishScore = /[áéíóúñü¿¡]/u.test(lower) ? 4 : 0;
  let englishScore = 0;

  for (const word of words) {
    if (SPANISH_WORDS.has(word)) spanishScore += 1;
    if (ENGLISH_WORDS.has(word)) englishScore += 1;
  }

  // These suffixes are useful when a short probe contains few stop words.
  spanishScore += words.filter((word) => /(ción|ciones|mente|ado|ada|idos|idas)$/u.test(word)).length * 0.5;
  englishScore += words.filter((word) => /(ing|tion|ed|ly)$/u.test(word)).length * 0.5;

  const total = englishScore + spanishScore;
  const language = englishScore === spanishScore
    ? fallback
    : englishScore > spanishScore
      ? "english"
      : "spanish";
  const winningScore = Math.max(englishScore, spanishScore);

  return {
    language,
    confidence: total > 0 ? winningScore / total : 0,
    englishScore,
    spanishScore,
  };
}
