import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  Firestore,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, OAuthProvider, Auth } from "firebase/auth";
import firebaseConfigJson from "../../firebase-applet-config.json";

// Silence verbose internal Firestore networking retries and proxy warnings
try {
  setLogLevel("silent");
} catch {
  // ignore
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const databaseId =
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  firebaseConfigJson.firestoreDatabaseId ||
  "(default)";

let db: Firestore;
try {
  const firestoreSettings = {
    experimentalForceLongPolling: true,
  };
  db =
    databaseId && databaseId !== "(default)"
      ? initializeFirestore(app, firestoreSettings, databaseId)
      : initializeFirestore(app, firestoreSettings);
} catch {
  try {
    db =
      databaseId && databaseId !== "(default)"
        ? getFirestore(app, databaseId)
        : getFirestore(app);
  } catch {
    db = getFirestore(app);
  }
}

let auth: Auth;
try {
  auth = getAuth(app);
} catch {
  auth = getAuth();
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

export { app, db, auth, googleProvider, appleProvider };

