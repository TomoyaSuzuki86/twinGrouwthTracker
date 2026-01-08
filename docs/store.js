import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { serverTimestamp } from "./firebase.js";

export async function createFamily(db, user, familyId) {
  const ref = doc(db, "families", familyId);
  await setDoc(ref, {
    createdAt: serverTimestamp(),
    createdByUid: user.uid,
    members: [user.uid],
    lockCode: "0817"
  }, { merge: true });
}

export async function joinFamily(db, user, familyId) {
  const ref = doc(db, "families", familyId);
  await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  await updateDoc(ref, { members: arrayUnion(user.uid) });
}

export function subscribeVisits(db, familyId, callback) {
  const ref = collection(db, "families", familyId, "visits");
  const q = query(ref, orderBy("date", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(items);
  });
}

export async function addVisit(db, familyId, user, data) {
  const ref = collection(db, "families", familyId, "visits");
  return addDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdByUid: user.uid,
    updatedByUid: user.uid
  });
}

export async function updateVisit(db, familyId, user, visitId, data) {
  const ref = doc(db, "families", familyId, "visits", visitId);
  return updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid
  });
}

export async function deleteVisit(db, familyId, visitId) {
  const ref = doc(db, "families", familyId, "visits", visitId);
  return deleteDoc(ref);
}

export async function exportVisits(db, familyId) {
  const ref = collection(db, "families", familyId, "visits");
  const q = query(ref, orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

export async function importVisits(db, familyId, user, visits) {
  for (const visit of visits) {
    if (!visit || !visit.id) {
      continue;
    }
    const { id, ...data } = visit;
    const ref = doc(db, "families", familyId, "visits", id);
    await setDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid
    }, { merge: true });
  }
}
