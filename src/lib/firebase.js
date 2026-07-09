/* =========================================
   FIREBASE INITIALIZATION (ported from config.js)
   Uses the compat SDK so every Firestore call
   (transactions, FieldValue.serverTimestamp, etc.)
   works exactly as in the original code.
   ========================================= */
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCTNuIyage6u0TxZureIZt1E18deqZ10UE",
  authDomain: "upsc-mcq-app.firebaseapp.com",
  projectId: "upsc-mcq-app",
  storageBucket: "upsc-mcq-app.firebasestorage.app",
  messagingSenderId: "998675793958",
  appId: "1:998675793958:web:d4eeaae3edbaec8b30bee7",
};

// AI Configuration
// WARNING: This key is exposed to the client. Restrict it by HTTP Referrer in Google Cloud Console.
export const GEMINI_API_KEY = null;

// Initialize Firebase (Compat Version)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);

  // Initialize Firestore with long-polling BEFORE the compat wrapper
  // touches it — this prevents the streaming WebChannel transport from
  // being selected, which avoids ERR_INTERNET_DISCONNECTED on networks
  // that kill long-lived connections.
  initializeFirestore(firebase.app(), {
    experimentalForceLongPolling: true,
  });

  const firestore = firebase.firestore();

  firestore.enablePersistence()
    .catch(async (err) => {
      if (err.code === "failed-precondition") {
        try {
          await firestore.clearPersistence();
          await firestore.enablePersistence();
        } catch (retryErr) {
          console.warn("Firestore persistence could not be enabled. Using memory cache.");
        }
      } else if (err.code === "unimplemented") {
        console.warn("Firestore persistence not supported by this browser.");
      }
    });
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
export const getDb = () => firebase.firestore();
export default firebase;
