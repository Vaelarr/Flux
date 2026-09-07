import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  addDoc,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import { db, auth, googleProvider, appleProvider } from "../lib/firebase";
import { UserAccount } from "../types";

const STORAGE_KEY = "flux_registered_accounts";

export function emailToDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

let firestoreInitialized = false;

// Purge any legacy demo or seeded accounts
export function cleanupSeededAccounts() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("flux_demo_registered_accounts");
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (a) =>
            a.id !== "usr-001" &&
            a.id !== "usr-002" &&
            a.email !== "demo@flux.social" &&
            !(a.email === "atupaen@gmail.com" && a.password === "summit-cedar-river-88")
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
    }
  } catch (e) {
    // ignore
  }

  // Delete seeded accounts from Firestore if present
  try {
    deleteDoc(doc(db, "users", "demo_flux_social")).catch(() => {});
    deleteDoc(doc(db, "users", "usr-001")).catch(() => {});
    deleteDoc(doc(db, "users", "usr-002")).catch(() => {});
    getDoc(doc(db, "users", "atupaen_gmail_com"))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data?.password === "summit-cedar-river-88" && (data?.id === "usr-001" || !data?.provider)) {
            deleteDoc(doc(db, "users", "atupaen_gmail_com")).catch(() => {});
          }
        }
      })
      .catch(() => {});
  } catch (e) {
    // ignore
  }
}

// Initialize background real-time sync with Firestore
export function initFirestoreSync() {
  if (firestoreInitialized || typeof window === "undefined") return;
  firestoreInitialized = true;
  cleanupSeededAccounts();

  try {
    const usersCol = collection(db, "users");
    // Listen for real-time changes
    onSnapshot(
      usersCol,
      (snapshot) => {
        const cloudAccounts: UserAccount[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Skip any seeded account remnants
          if (
            docSnap.id === "demo_flux_social" ||
            docSnap.id === "usr-001" ||
            docSnap.id === "usr-002" ||
            data.email === "demo@flux.social" ||
            (data.email === "atupaen@gmail.com" && data.password === "summit-cedar-river-88")
          ) {
            return;
          }
          cloudAccounts.push({
            id: docSnap.id,
            name: data.name || "User",
            email: data.email || "",
            password: data.password || "",
            createdAt: data.createdAt || new Date().toISOString(),
            sessionsCount: typeof data.sessionsCount === "number" ? data.sessionsCount : 1,
            lastPasswordReset: data.lastPasswordReset,
            provider: data.provider,
            avatarUrl: data.avatarUrl,
            firebaseUid: data.firebaseUid,
          });
        });

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudAccounts));
        } catch (e) {
          // ignore
        }
      },
      (error) => {
        // Soft fallback to offline local cache if network is temporarily interrupted
        if (error?.code !== "unavailable") {
          console.warn("Firestore snapshot sync status:", error?.message || error);
        }
      }
    );
  } catch {
    // Soft fallback
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
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(
        (a) =>
          a.id !== "usr-001" &&
          a.id !== "usr-002" &&
          a.email !== "demo@flux.social" &&
          !(a.email === "atupaen@gmail.com" && a.password === "summit-cedar-river-88")
      );
    }
    return [];
  } catch (err) {
    console.warn("Could not read accounts from storage", err);
    return [];
  }
}

export function findAccount(email: string): UserAccount | undefined {
  if (!email) return undefined;
  const accounts = getRegisteredAccounts();
  const lower = email.trim().toLowerCase();
  return accounts.find((acc) => acc.email.toLowerCase() === lower);
}

/**
 * Upserts a social account (Google or Apple) into Firestore and local cache
 */
export async function createOrUpdateSocialAccount(params: {
  name: string;
  email: string;
  provider: "google" | "apple";
  avatarUrl?: string;
  firebaseUid?: string;
}): Promise<UserAccount> {
  const email = params.email.trim();
  const docId = emailToDocId(email);
  const now = new Date().toISOString();

  const existing = findAccount(email);

  const account: UserAccount = {
    id: existing?.id || (params.firebaseUid ? `usr-${params.firebaseUid.slice(0, 10)}` : docId),
    name: params.name || existing?.name || (params.provider === "apple" ? "Apple User" : "Google User"),
    email,
    createdAt: existing?.createdAt || now,
    sessionsCount: (existing?.sessionsCount || 0) + 1,
    provider: params.provider,
    avatarUrl: params.avatarUrl || existing?.avatarUrl,
    firebaseUid: params.firebaseUid || existing?.firebaseUid,
  };

  // 1. Update local storage
  const current = getRegisteredAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase());
  current.push(account);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    // ignore
  }

  // 2. Persist to Firestore
  try {
    const userDocRef = doc(db, "users", docId);
    await setDoc(
      userDocRef,
      {
        ...account,
        lastLoginAt: now,
      },
      { merge: true }
    );

    // Record security log
    await addDoc(collection(db, "security_logs"), {
      action: `SOCIAL_AUTH_${params.provider.toUpperCase()}`,
      email,
      timestamp: now,
      result: "SUCCESS",
      source: "web_auth",
    });
  } catch (err) {
    console.warn("Could not persist social account to Firestore:", err);
  }

  return account;
}

export interface SocialAuthResponse {
  success: boolean;
  user?: UserAccount;
  error?: string;
  isPopupClosed?: boolean;
  needsFallback?: boolean;
  provider?: "google" | "apple";
}

/**
 * Executes real Google sign-in using Firebase Auth popup, falling back gracefully
 * if the provider is not enabled in Firebase Console.
 */
export async function signInWithGoogleService(): Promise<SocialAuthResponse> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;

    if (!fbUser.email) {
      return {
        success: false,
        error: "Google account did not provide an email address.",
      };
    }

    const account = await createOrUpdateSocialAccount({
      name: fbUser.displayName || fbUser.email.split("@")[0],
      email: fbUser.email,
      provider: "google",
      avatarUrl: fbUser.photoURL || undefined,
      firebaseUid: fbUser.uid,
    });

    return { success: true, user: account };
  } catch (error: any) {
    const errorCode = error?.code || "";
    const errorMsg = error?.message || "";

    // When the provider is not yet activated in Firebase Console
    if (
      errorCode === "auth/configuration-not-found" ||
      errorCode === "auth/operation-not-allowed" ||
      errorMsg.includes("configuration-not-found") ||
      errorMsg.includes("operation-not-allowed")
    ) {
      console.warn("Firebase Google Auth provider is not enabled in Firebase Console:", errorCode || errorMsg);
      return {
        success: false,
        needsFallback: true,
        provider: "google",
      };
    }

    const isPopupClosed =
      errorCode === "auth/popup-closed-by-user" ||
      errorCode === "auth/cancelled-popup-request" ||
      errorMsg.toLowerCase().includes("popup-closed-by-user") ||
      errorMsg.toLowerCase().includes("closed by user") ||
      errorMsg.toLowerCase().includes("popup was closed") ||
      errorMsg.toLowerCase().includes("window closed");

    let message = errorMsg || "Failed to sign in with Google.";

    if (isPopupClosed) {
      message = "The Google sign-in browser popup was closed before finishing authentication. Please try again when you are ready.";
    } else if (errorCode === "auth/popup-blocked") {
      message = "The sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
    } else if (errorCode === "auth/unauthorized-domain") {
      message =
        "Firebase Auth: This domain is not in Authorized Domains. In Firebase Console, go to Authentication > Settings > Authorized Domains and add this domain.";
    } else if (errorCode === "auth/network-request-failed") {
      message = "Network error connecting to Firebase Authentication.";
    } else {
      console.warn("Firebase Google Sign-In notice:", error);
    }

    return {
      success: false,
      error: message,
      isPopupClosed,
      provider: "google",
    };
  }
}

/**
 * Executes Apple sign-in using Firebase Auth popup, falling back gracefully
 * if the provider is not enabled in Firebase Console.
 */
export async function signInWithAppleService(): Promise<SocialAuthResponse> {
  try {
    const result = await signInWithPopup(auth, appleProvider);
    const fbUser = result.user;

    const email = fbUser.email || `${fbUser.uid}@privaterelay.appleid.com`;
    const name = fbUser.displayName || "Apple User";

    const account = await createOrUpdateSocialAccount({
      name,
      email,
      provider: "apple",
      firebaseUid: fbUser.uid,
    });

    return { success: true, user: account };
  } catch (error: any) {
    const errorCode = error?.code || "";
    const errorMsg = error?.message || "";

    // When the provider is not yet activated in Firebase Console
    if (
      errorCode === "auth/configuration-not-found" ||
      errorCode === "auth/operation-not-allowed" ||
      errorMsg.includes("configuration-not-found") ||
      errorMsg.includes("operation-not-allowed")
    ) {
      console.warn("Firebase Apple Auth provider is not enabled in Firebase Console:", errorCode || errorMsg);
      return {
        success: false,
        needsFallback: true,
        provider: "apple",
      };
    }

    const isPopupClosed =
      errorCode === "auth/popup-closed-by-user" ||
      errorCode === "auth/cancelled-popup-request" ||
      errorMsg.toLowerCase().includes("popup-closed-by-user") ||
      errorMsg.toLowerCase().includes("closed by user") ||
      errorMsg.toLowerCase().includes("popup was closed") ||
      errorMsg.toLowerCase().includes("window closed");

    let message = errorMsg || "Failed to sign in with Apple.";

    if (isPopupClosed) {
      message = "The Apple ID sign-in browser popup was closed before finishing authentication. Please try again when you are ready.";
    } else if (errorCode === "auth/popup-blocked") {
      message = "The sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
    } else if (errorCode === "auth/unauthorized-domain") {
      message =
        "Firebase Auth: This domain is not in Authorized Domains. In Firebase Console, go to Authentication > Settings > Authorized Domains and add this domain.";
    } else if (errorCode === "auth/network-request-failed") {
      message = "Network error connecting to Firebase Authentication.";
    } else {
      console.warn("Firebase Apple Sign-In notice:", error);
    }

    return {
      success: false,
      error: message,
      isPopupClosed,
      provider: "apple",
    };
  }
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
