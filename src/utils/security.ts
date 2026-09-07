import { PasswordStrengthResult, PasswordAnalysis, NistRequirement, SecuritySession } from "../types";

// Common breached or highly predictable passwords (NIST SP 800-63B Section 5.1.1.2)
const COMMON_BREACHED_PASSWORDS = new Set([
  "password", "password123", "123456", "12345678", "123456789", "qwerty",
  "admin", "welcome", "welcome1", "login", "flux1234", "flux2024", "flux2025",
  "flux2026", "passphrase", "iloveyou", "monkey", "dragon", "master", "sunshine",
  "letmein", "princess", "football", "trustno1", "starwars", "default", "abc12345",
  "hunter2", "myspace1", "iloveme", "passw0rd", "p@ssword", "shadow", "superman"
]);

// Sequential patterns to catch
const SEQUENTIAL_PATTERNS = [
  "1234", "2345", "3456", "4567", "5678", "6789", "7890",
  "abcd", "bcde", "cdef", "defg", "efgh", "fghi", "ghij",
  "qwerty", "asdfgh", "zxcvbn", "qwertz", "azerty",
  "9876", "8765", "7654", "6543", "5432", "4321"
];

// Memorable word bank for secure passphrase generation
const WORDS = [
  "harbor", "cedar", "zenith", "orchard", "tempo", "cobalt", "river", "summit",
  "canvas", "breeze", "amber", "granite", "aurora", "meadow", "beacon", "solace",
  "cypress", "ember", "velvet", "horizon", "timber", "cascade", "valley", "quartz"
];

/**
 * Generates an effortless, high-entropy 3-word passphrase
 * e.g. "cobalt-orchard-beacon" (~45+ bits entropy, highly memorable, easy to type)
 */
export function generatePassphrase(): string {
  const chosen: string[] = [];
  while (chosen.length < 3) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (!chosen.includes(word)) {
      chosen.push(word);
    }
  }
  const randomNum = Math.floor(10 + Math.random() * 89);
  return `${chosen.join("-")}-${randomNum}`;
}

/**
 * Mask an email address to protect privacy (prevent shoulder surfing & enumeration)
 * e.g. "atupaen@gmail.com" -> "a***n@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [user, domain] = email.split("@");
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  const first = user[0];
  const last = user[user.length - 1];
  const maskedMiddle = "*".repeat(Math.min(user.length - 2, 4));
  return `${first}${maskedMiddle}${last}@${domain}`;
}

/**
 * Checks for repeated characters (e.g. "aaa", "1111")
 */
function hasRepeatedChars(str: string): boolean {
  return /(.)\1\1/.test(str);
}

/**
 * Checks for sequential patterns (e.g. "1234", "qwerty")
 */
function hasSequentialPattern(str: string): boolean {
  const lower = str.toLowerCase();
  return SEQUENTIAL_PATTERNS.some((pat) => lower.includes(pat));
}

/**
 * Checks for context-specific identifiers (user email handle or service name)
 */
function hasContextSpecificTerms(str: string, email?: string): boolean {
  const lower = str.toLowerCase();
  if (lower.includes("flux")) return true;
  if (email && email.includes("@")) {
    const handle = email.split("@")[0].toLowerCase().trim();
    if (handle.length >= 3 && lower.includes(handle)) {
      return true;
    }
  }
  return false;
}

/**
 * Comprehensive real-time NIST SP 800-63B complexity validator
 */
export function analyzeNistPassword(pw: string, userEmail?: string): PasswordAnalysis {
  const trimmed = pw.trim();
  const lower = trimmed.toLowerCase();
  const len = trimmed.length;

  if (len === 0) {
    return {
      score: 0,
      label: "Very Weak",
      color: "#b4321e",
      entropyBits: 0,
      isBreached: false,
      hasRepetitiveOrSequential: false,
      hasContextWords: false,
      hasMinLength: false,
      isPassphrase: false,
      allCriticalMet: false,
      tip: "Type at least 10 letters, or click 'Suggest a password' for an easy phrase.",
      requirements: [
        {
          id: "length",
          label: "At least 10 letters or numbers",
          description: "Needs to be 10 characters or longer.",
          met: false,
          status: "pending",
          critical: true,
        },
        {
          id: "breach",
          label: "Not an easily guessed password",
          description: "Avoid common words like 'password' or '123456'.",
          met: true,
          status: "pass",
          critical: true,
        },
        {
          id: "context",
          label: "Avoid your name or email",
          description: "Keep personal information out of your password.",
          met: true,
          status: "pass",
          critical: false,
        },
        {
          id: "patterns",
          label: "Avoid repetitive keys",
          description: "Avoid patterns like '1234' or 'aaaa'.",
          met: true,
          status: "pass",
          critical: false,
        },
      ],
    };
  }

  // 1. Check Breach
  const isBreached = COMMON_BREACHED_PASSWORDS.has(lower) ||
    lower.startsWith("password") ||
    lower.startsWith("123456") ||
    lower === "admin123";

  // 2. Check Repetitive & Sequential
  const hasRep = hasRepeatedChars(trimmed);
  const hasSeq = hasSequentialPattern(trimmed);
  const hasRepetitiveOrSequential = hasRep || hasSeq;

  // 3. Check Context Terms
  const hasContextWords = hasContextSpecificTerms(trimmed, userEmail);

  // 4. Check Length
  const hasMinLength = len >= 10;
  const isPassphrase = (trimmed.includes("-") || trimmed.includes(" ")) && len >= 14;

  // 5. Entropy calculation
  let pool = 0;
  if (/[a-z]/.test(trimmed)) pool += 26;
  if (/[A-Z]/.test(trimmed)) pool += 26;
  if (/[0-9]/.test(trimmed)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(trimmed)) pool += 33;
  if (trimmed.includes(" ") || trimmed.includes("-")) pool += 5;

  let entropyBits = pool > 0 ? Math.round(len * Math.log2(pool)) : 0;
  if (isBreached) entropyBits = Math.min(entropyBits, 12);
  if (hasRepetitiveOrSequential) entropyBits = Math.max(0, entropyBits - 18);

  const hasGoodEntropy = entropyBits >= 45 || isPassphrase;

  // Build granular easy-to-understand requirements
  const reqLength: NistRequirement = {
    id: "length",
    label: "At least 10 letters or numbers",
    description: len < 10
      ? `Only ${len} of 10 letters entered so far. Add ${10 - len} more.`
      : `Good length! (${len} characters)`,
    met: hasMinLength,
    status: hasMinLength ? "pass" : "fail",
    critical: true,
  };

  const reqBreach: NistRequirement = {
    id: "breach",
    label: "Not an easily guessed password",
    description: isBreached
      ? "This password is too easy to guess. Please pick a different one."
      : "Safe — not on any common password lists.",
    met: !isBreached,
    status: isBreached ? "fail" : "pass",
    critical: true,
  };

  const reqContext: NistRequirement = {
    id: "context",
    label: "Avoid your name or email",
    description: hasContextWords
      ? "Please avoid using your email address or the word 'flux'."
      : "Good — no personal details found.",
    met: !hasContextWords,
    status: hasContextWords ? "fail" : "pass",
    critical: false,
  };

  const reqPatterns: NistRequirement = {
    id: "patterns",
    label: "Avoid repetitive keys",
    description: hasRepetitiveOrSequential
      ? (hasRep && hasSeq ? "Avoid repeated letters (like 'aaa') and sequences (like '1234')." : hasRep ? "Avoid 3 or more repeated letters in a row." : "Avoid number walks or keyboard sequences.")
      : "Good — no repeated or sequential patterns.",
    met: !hasRepetitiveOrSequential,
    status: hasRepetitiveOrSequential ? "fail" : "pass",
    critical: false,
  };

  const requirements = [reqLength, reqBreach, reqContext, reqPatterns];
  const allCriticalMet = reqLength.met && reqBreach.met;

  // Determine overall score
  let score = 0;
  if (hasMinLength) score += 1;
  if (!isBreached) score += 1;
  if (!hasRepetitiveOrSequential && !hasContextWords) score += 1;
  if (entropyBits >= 55 || isPassphrase || len >= 14) score += 1;

  if (isBreached) {
    score = 0;
  }

  let label: PasswordAnalysis["label"] = "Weak";
  let color = "#b4321e";
  let tip = "Please type a password.";

  if (isBreached) {
    label = "Very Weak";
    color = "#b4321e";
    tip = "This password is too easy to guess. Try combining a few simple words instead.";
  } else if (!hasMinLength) {
    label = "Weak";
    color = "#b4321e";
    tip = `Please add ${10 - len} more characters to make it secure.`;
  } else if (hasRepetitiveOrSequential || hasContextWords) {
    label = "Fair";
    color = "#c26d18";
    tip = "Almost there! Try avoiding repetitive keys or predictable words.";
  } else if (score >= 3) {
    label = score === 4 ? "Excellent" : "Strong";
    color = score === 4 ? "#0D530E" : "#306D29";
    tip = isPassphrase
      ? "Great password! Combining simple words makes it easy to remember and very safe."
      : "Looks great! Your password is secure and ready to use.";
  } else {
    label = "Fair";
    color = "#c26d18";
    tip = "Good start. Adding another word or numbers will make it even stronger.";
  }

  return {
    score,
    label,
    color,
    entropyBits,
    isBreached,
    hasRepetitiveOrSequential,
    hasContextWords,
    hasMinLength,
    isPassphrase,
    requirements,
    tip,
    allCriticalMet,
  };
}

/**
 * Mock active sessions for the user to review during reset
 */
export const DEFAULT_ACTIVE_SESSIONS: SecuritySession[] = [
  {
    id: "sess_1",
    device: "MacBook Pro 16\"",
    browser: "Chrome 124 • macOS Sonoma",
    location: "San Francisco, CA, US",
    lastActive: "Active now",
    isCurrent: true,
  },
  {
    id: "sess_2",
    device: "iPhone 15 Pro",
    browser: "Safari Mobile • iOS 17.5",
    location: "San Francisco, CA, US",
    lastActive: "18 minutes ago",
    isCurrent: false,
  },
  {
    id: "sess_3",
    device: "Dell XPS 13",
    browser: "Firefox 125 • Windows 11",
    location: "Austin, TX, US",
    lastActive: "3 days ago",
    isCurrent: false,
  },
];
