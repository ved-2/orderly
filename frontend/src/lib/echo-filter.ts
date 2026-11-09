/**
 * Anti-Echo & Self-Listening Prevention Utility
 *
 * Prevents the microphone / Web Speech Recognition from picking up and transcribing
 * the assistant's own synthesized speech (e.g. from device speakers into the mic).
 */

// Canonical assistant prompt phrases that kirana store retailers never say as orders
const KNOWN_ASSISTANT_PROMPTS = [
  "kitna chahiye",
  "kitne chahiye",
  "kitni chahiye",
  "kitna packet",
  "kitne packet",
  "kitna case",
  "kitne case",
  "uplabdh hai",
  "uplabdh nahi",
  "ye uplabdh hai",
  "wo uplabdh hai",
  "kaunsa variant",
  "kaun sa variant",
  "kaunsi brand",
  "kaun si brand",
  "kya ye chalega",
  "chalega kya",
  "packet me ya case me",
  "packet mein ya case mein",
  "kripya option select",
  "select karein",
  "batayein",
  "batao",
  "bataiye",
  "add kar raha hoon",
  "add kar rahe hain",
  "add kar diya",
  "add kar diya hai",
  "aapke order draft me",
  "aapke cart me",
  "cart me add",
  "order draft mein add",
  "order confirm ho gaya",
  "confirm kiya ja raha hai",
  "namaste main aapka",
  "orderly ai ordering",
  "orderly assistant",
  "total amount",
  "rupaye hai",
  "piece available hai",
  "stock uplabdh hai",
  "sirf uplabdh hai",
  "honi chahiye",
  "kaunsa product chahiye",
];

// Individual assistant prompt tokens that should never constitute an entire user request
const ASSISTANT_PROMPT_TOKENS = new Set([
  "kitna",
  "kitne",
  "kitni",
  "chahiye",
  "uplabdh",
  "hai",
  "hain",
  "ye",
  "yeh",
  "wo",
  "woh",
  "vho",
  "voh",
  "variant",
  "kaunsa",
  "kaunsi",
  "konsa",
  "chalega",
  "kya",
  "select",
  "karein",
  "karo",
  "add",
  "cart",
  "draft",
  "mein",
  "me",
  "ke",
  "ka",
  "ki",
  "raha",
  "rahe",
  "hoon",
  "diya",
  "option",
  "options",
  "available",
  "stock",
  "rate",
  "price",
]);

/**
 * Phonetically normalize common Hindi Speech-to-Text mistranscriptions
 * Specifically fixes "uplabdh" -> "upload", "uplaod", "uplod", etc.
 */
export function normalizeSpokenHindi(text: string): string {
  if (!text) return "";

  let norm = text.toLowerCase().trim();

  // Strip punctuation
  norm = norm.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'।]/g, " ");

  // Normalize common Web Speech STT errors for assistant Hindi words
  // "uplabdh hai" is very often transcribed as "upload hai" or "uplaod hai"
  norm = norm.replace(/\b(?:upload|uplaod|uplod|uplabd|uplabda|uploade|apload|aplod)\b/g, "uplabdh");

  // Normalize demonstratives & fillers
  norm = norm.replace(/\b(?:vho|voh|woh)\b/g, "wo");
  norm = norm.replace(/\b(?:yeh)\b/g, "ye");
  norm = norm.replace(/\b(?:chahie|chaiye|chahye)\b/g, "chahiye");
  norm = norm.replace(/\b(?:kitne|kitni)\b/g, "kitna");
  norm = norm.replace(/\b(?:konsa|kaunse|kaunsi)\b/g, "kaunsa");

  // Collapse multiple spaces
  return norm.replace(/\s+/g, " ").trim();
}

/**
 * Checks if the transcript is an exact match or subset of known assistant prompt templates.
 */
export function isKnownAssistantPrompt(transcript: string): boolean {
  const norm = normalizeSpokenHindi(transcript);
  if (!norm) return true;

  // 1. Direct template match
  for (const phrase of KNOWN_ASSISTANT_PROMPTS) {
    const normPhrase = normalizeSpokenHindi(phrase);
    if (norm === normPhrase || norm.includes(normPhrase) || normPhrase.includes(norm)) {
      return true;
    }
  }

  // 2. Token composition check: if ALL words in the user transcript belong to ASSISTANT_PROMPT_TOKENS
  // e.g. "kitna chahiye", "ye uplabdh hai", "vho upload hai", "ye uplabdh hai kitna chahiye"
  const tokens = norm.split(" ").filter((w) => w.length > 0);
  if (tokens.length > 0) {
    const allPromptTokens = tokens.every((tok) => ASSISTANT_PROMPT_TOKENS.has(tok));
    if (allPromptTokens) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if the transcript strongly overlaps with any recent spoken assistant message.
 */
export function isSimilarToRecentAssistantSpeech(
  transcript: string,
  recentSpokenTexts: string[]
): boolean {
  if (!transcript || recentSpokenTexts.length === 0) return false;

  const normTranscript = normalizeSpokenHindi(transcript);
  if (!normTranscript || normTranscript.length < 3) return true;

  const transcriptTokens = normTranscript.split(" ").filter((w) => w.length > 1);
  if (transcriptTokens.length === 0) return true;

  // Filter out ultra-common fillers when calculating overlap
  const stopWords = new Set(["hai", "hain", "ke", "ka", "ki", "me", "mein", "aur", "bhi", "to", "ho"]);
  const significantTokens = transcriptTokens.filter((t) => !stopWords.has(t));
  if (significantTokens.length === 0) return true;

  for (const spoken of recentSpokenTexts) {
    if (!spoken) continue;
    const normSpoken = normalizeSpokenHindi(spoken);
    if (!normSpoken) continue;

    // Substring checks
    if (normSpoken.includes(normTranscript) || normTranscript.includes(normSpoken)) {
      return true;
    }

    // Significant token overlap
    const spokenTokens = new Set(normSpoken.split(" ").filter((w) => w.length > 1));
    const matchingCount = significantTokens.filter((tok) => spokenTokens.has(tok)).length;
    const overlapRatio = matchingCount / significantTokens.length;

    // If 40% or more of the significant words in the user transcript were just spoken by the AI
    if (overlapRatio >= 0.40) {
      return true;
    }
  }

  return false;
}

/**
 * Master echo detector: Returns true if the transcript should be discarded as speaker echo.
 */
export function isAIEcho(
  transcript: string,
  recentSpokenTexts: string[] = []
): boolean {
  if (!transcript || !transcript.trim()) return true;

  // 1. Check against known assistant prompt phrases & tokens
  if (isKnownAssistantPrompt(transcript)) {
    return true;
  }

  // 2. Check against recent assistant spoken responses
  if (isSimilarToRecentAssistantSpeech(transcript, recentSpokenTexts)) {
    return true;
  }

  return false;
}
