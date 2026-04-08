import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = window.FRESHFACES_FIREBASE_CONFIG;

if (!firebaseConfig) {
  throw new Error(
    "Firebase config is missing. Copy config.example.js to config.js and fill in your Firebase values.",
  );
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  provider,
  query,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  signOut,
  updateDoc,
};
