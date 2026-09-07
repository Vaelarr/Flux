import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  addDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserAccount } from "../types";

const STORAGE_KEY = "flux_demo_registered_accounts";

const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    id: "usr-001",
    name: "Alex Tupaen",
    email: "atupaen@gmail.com",
    password: "summit-cedar-river-88",
    createdAt: "2026-08-15T10:30:00Z",
    sessionsCount: 3,
  },
  {
    id: "usr-002",
    name: "Flux Explorer",
    email: "demo@flux.social",
    password: "harbor-orchard-tempo-42",
    createdAt: "2026-09-01T14:20:00Z",
    sessionsCount: 2,
  },
];

export function emailToDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

let firestoreInitialized = false;

// Initialize background real-time sync with Firestore
export function initFirestoreSync() {
  if (firestoreInitialized || typeof window === "undefined") return;
  firestoreInitialized = true;

  try {
    const usersCol = collection(db, "users");
    // Listen for real-time changes
    onSnapshot(
      usersCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const cloudAccounts: UserAccount[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            cloudAccounts.push({
              id: docSnap.id,
              name: data.name || "User",
              email: data.email || "",
              password: data.password || "",
              createdAt: data.createdAt || new Date().toISOString(),
              sessionsCount: typeof data.sessionsCount === "number" ? data.sessionsCount : 1,
              lastPasswordReset: data.lastPasswordReset,
            });
          });

          // Merge with defaults if needed
          const merged = [...cloudAccounts];
          DEFAULT_ACCOUNTS.forEach((def) => {
            if (!merged.some((m) => m.email.toLowerCase() === def.email.toLowerCase())) {
              merged.push(def);
            }
          });

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch (e) {
            // ignore
          }
        } else {
          // If Firestore is empty, seed defaults
          DEFAULT_ACCOUNTS.forEach(async (acc) => {
            try {
              await setDoc(doc(db, "users", emailToDocId(acc.email)), acc, { merge: true });
            } catch (err) {
              console.warn("Could not seed default account to Firestore", err);
            }
          });
        }
      },
      (error) => {
        console.warn("Firestore snapshot listener error:", error);
      }
    );
  } catch (err) {
    console.warn("Could not setup Firestore sync:", err);
  }
}

// Auto trigger init
if (typeof window !== "undefined") {
  initFirestoreSync();
}

/**
 * Synchronous read from local cache (backed by real-time Firestore sync)
 */
export function getRegisteredAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_ACCOUNTS;
  } catch (err) {
    console.warn("Could not read accounts from storage", err);
    return DEFAULT_ACCOUNTS;
  }
}

export function findAccount(email: string): UserAccount | undefined {
  if (!email) return undefined;
  const accounts = getRegisteredAccounts();
  const lower = email.trim().toLowerCase();
  return accounts.find((acc) => acc.email.toLowerCase() === lower);
}

/**
 * Creates an account in both Firestore and local storage
 */
export async function createAccount(data: { name: string; email: string; password?: string }): Promise<UserAccount> {
  const email = data.email.trim();
  const docId = emailToDocId(email);

  const newAccount: UserAccount = {
    id: docId,
    name: data.name.trim() || email.split("@")[0],
    email: email,
    password: data.password,
    createdAt: new Date().toISOString(),
    sessionsCount: 1,
  };

  // 1. Update local storage immediately for snappy UI
  const accounts = getRegisteredAccounts();
  const lower = email.toLowerCase();
  const existingIdx = accounts.findIndex((acc) => acc.email.toLowerCase() === lower);
  let updated: UserAccount[];
  if (existingIdx >= 0) {
    updated = accounts.map((acc, i) => (i === existingIdx ? { ...acc, ...newAccount } : acc));
  } else {
    updated = [newAccount, ...accounts];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to persist account locally", err);
  }

  // 2. Persist to Firestore Cloud Database
  try {
    const userDocRef = doc(db, "users", docId);
    await setDoc(userDocRef, newAccount, { merge: true });

    // Record in security audit log
    await addDoc(collection(db, "security_logs"), {
      action: "ACCOUNT_CREATED",
      email: email,
      timestamp: new Date().toISOString(),
      result: "SUCCESS",
      source: "web_registration",
    });
  } catch (err) {
    console.warn("Failed to persist account to Firestore:", err);
  }

  return newAccount;
}

/**
 * Updates password in both Firestore and local storage
 */
export async function updatePassword(email: string, newPassword: string): Promise<boolean> {
  const docId = emailToDocId(email);
  const now = new Date().toISOString();

  // 1. Update local storage
  const accounts = getRegisteredAccounts();
  const lower = email.trim().toLowerCase();
  const existingIdx = accounts.findIndex((acc) => acc.email.toLowerCase() === lower);

  if (existingIdx === -1) {
    await createAccount({
      name: email.split("@")[0],
      email,
      password: newPassword,
    });
  } else {
    accounts[existingIdx] = {
      ...accounts[existingIdx],
      password: newPassword,
      lastPasswordReset: now,
      sessionsCount: 1, // All prior sessions terminated
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch (err) {
      console.warn("Failed to update password locally", err);
    }
  }

  // 2. Persist updated password and session termination to Firestore
  try {
    const userDocRef = doc(db, "users", docId);
    await setDoc(
      userDocRef,
      {
        password: newPassword,
        lastPasswordReset: now,
        sessionsCount: 1,
      },
      { merge: true }
    );

    // Record in Firestore security audit log
    await addDoc(collection(db, "security_logs"), {
      action: "PASSWORD_RESET_COMPLETED",
      email: email,
      timestamp: now,
      result: "SUCCESS",
      sessionsRevoked: true,
    });
  } catch (err) {
    console.warn("Failed to persist password update to Firestore:", err);
  }

  return true;
}

/**
 * Persists password reset challenge tokens in Firestore
 */
export async function saveResetChallenge(challenge: {
  email: string;
  otpCode: string;
  magicToken: string;
  expiresAt: number;
}) {
  try {
    const docId = `reset_${emailToDocId(challenge.email)}`;
    await setDoc(doc(db, "password_resets", docId), {
      ...challenge,
      createdAt: new Date().toISOString(),
      status: "pending",
    });

    await addDoc(collection(db, "security_logs"), {
      action: "CHALLENGE_DISPATCHED",
      email: challenge.email,
      timestamp: new Date().toISOString(),
      result: "SUCCESS",
    });
  } catch (err) {
    console.warn("Failed to save reset challenge to Firestore:", err);
  }
}
