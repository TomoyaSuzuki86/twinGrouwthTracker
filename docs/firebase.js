import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth as firebaseGetAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

let app;
let auth;
let db;

export async function initFirebase(onAuthReady) {
  app = initializeApp(firebaseConfig);
  auth = firebaseGetAuth(app);
  db = getFirestore(app);

  try {
    await enableIndexedDbPersistence(db);
  } catch (err) {
    console.warn("IndexedDB persistence not enabled", err);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      await signInAnonymously(auth);
      return;
    }
    onAuthReady(user);
  });
}

export function getDb() {
  return db;
}

export { serverTimestamp };
