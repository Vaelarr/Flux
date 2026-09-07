export type ResetStep = "email" | "verification" | "newpass" | "success";

export type VerificationMethod = "magic_link" | "otp_code";

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  color: string;
  feedback: string[];
  isBreached: boolean;
  entropyBits: number;
  hasMinLength: boolean;
  hasPassphraseQuality: boolean;
}

export interface NistRequirement {
  id: string;
  label: string;
  description: string;
  met: boolean;
  status: "pass" | "fail" | "pending";
  critical: boolean;
}

export interface PasswordAnalysis {
  score: number; // 0 to 4
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Excellent";
  color: string;
  entropyBits: number;
  isBreached: boolean;
  breachMatch?: string;
  hasRepetitiveOrSequential: boolean;
  hasContextWords: boolean;
  hasMinLength: boolean;
  isPassphrase: boolean;
  requirements: NistRequirement[];
  tip: string;
  allCriticalMet: boolean;
}

export interface SecuritySession {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  tokenHash: string;
  result: "success" | "revoked" | "blocked";
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  createdAt: string;
  sessionsCount: number;
  lastPasswordReset?: string;
}
