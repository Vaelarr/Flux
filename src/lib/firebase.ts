import { initializeApp, getApps, getApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
} from "firebase/auth"
import firebaseConfigJson from "../../firebase-applet-config.json"

const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey:
        import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
      authDomain:
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
        firebaseConfigJson.authDomain,
      projectId:
        import.meta.env.VITE_FIREBASE_PROJECT_ID ||
        firebaseConfigJson.projectId,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
    })
const auth = getAuth(app)
// Firebase proves the Google identity; Flux's HttpOnly cookie owns the app session.
const authReady = setPersistence(auth, inMemoryPersistence)
authReady.catch(() => {})
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

export { auth, authReady, googleProvider }
