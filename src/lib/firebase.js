/* =========================================
   FIREBASE INITIALIZATION (ported from config.js)
   Uses the compat SDK so every Firestore call
   (transactions, FieldValue.serverTimestamp, etc.)
   works exactly as in the original code.
   ========================================= */
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

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

  // OPTIMIZATION: Enable offline persistence with multi-tab support
  // This reduces reads and allows multi-tab synchronization
  firebase.firestore().enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("Firestore persistence unavailable: multiple tabs open.");
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
