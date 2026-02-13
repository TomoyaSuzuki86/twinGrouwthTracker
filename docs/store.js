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
  getDoc,
  runTransaction,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { serverTimestamp } from "./firebase.js";

export async function createFamily(db, user, familyCode) {
  const normalizedCode = normalizeFamilyCode(familyCode);
  if (!normalizedCode) {
    throw new Error("invalid-family-code");
  }

  const familyId = generateFamilyId();
  const familyRef = doc(db, "families", familyId);
  const familyCodeRef = doc(db, "familyCodes", normalizedCode);

  await runTransaction(db, async (tx) => {
    const codeSnap = await tx.get(familyCodeRef);
    if (codeSnap.exists()) {
      throw new Error("family-code-already-exists");
    }

    tx.set(familyRef, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByUid: user.uid,
      updatedByUid: user.uid,
      members: [user.uid],
      familyCode: normalizedCode,
      dueDate: null
    });
    tx.set(familyCodeRef, {
      familyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return { familyId, familyCode: normalizedCode };
}

export async function resolveFamilyByCode(db, familyCode) {
  const normalizedCode = normalizeFamilyCode(familyCode);
  if (!normalizedCode) {
    throw new Error("invalid-family-code");
  }

  const familyCodeRef = doc(db, "familyCodes", normalizedCode);
  const codeSnap = await getDoc(familyCodeRef);
  if (codeSnap.exists()) {
    const familyId = codeSnap.data()?.familyId;
    if (!familyId) {
      throw new Error("family-not-found");
    }
    const familySnap = await getDoc(doc(db, "families", familyId));
    if (!familySnap.exists()) {
      throw new Error("family-not-found");
    }
    return {
      familyId,
      family: { id: familySnap.id, ...familySnap.data() }
    };
  }

  // Backward compatibility: if older data used familyId as code, treat it as familyCode.
  const fallbackRef = doc(db, "families", normalizedCode);
  const fallbackSnap = await getDoc(fallbackRef);
  if (!fallbackSnap.exists()) {
    throw new Error("family-not-found");
  }
  return {
    familyId: fallbackSnap.id,
    family: { id: fallbackSnap.id, ...fallbackSnap.data() }
  };
}

export async function listFamilyCodes(db) {
  const ref = collection(db, "familyCodes");
  const snap = await getDocs(ref);
  const codes = snap.docs
    .map((docSnap) => normalizeFamilyCode(docSnap.id || docSnap.data()?.familyCode))
    .filter((code) => !!code);
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b));
}

export async function joinFamilyByInvite(db, user, familyId) {
  const ref = doc(db, "families", familyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("family-not-found");
  }
  await updateDoc(ref, {
    members: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid
  });
}

export async function joinFamilyByCode(db, user, familyCode) {
  const resolved = await resolveFamilyByCode(db, familyCode);
  const familyRef = doc(db, "families", resolved.familyId);
  await updateDoc(familyRef, {
    members: arrayUnion(user.uid),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid
  });

  return resolved;
}

export async function updateFamilyCode(db, familyId, user, nextFamilyCode) {
  const normalizedNextCode = normalizeFamilyCode(nextFamilyCode);
  if (!normalizedNextCode) {
    throw new Error("invalid-family-code");
  }

  const familyRef = doc(db, "families", familyId);
  const nextCodeRef = doc(db, "familyCodes", normalizedNextCode);

  await runTransaction(db, async (tx) => {
    const familySnap = await tx.get(familyRef);
    if (!familySnap.exists()) {
      throw new Error("family-not-found");
    }
    const family = familySnap.data() || {};
    const oldCode = normalizeFamilyCode(family.familyCode || familyId);

    if (oldCode === normalizedNextCode) {
      return;
    }

    const nextCodeSnap = await tx.get(nextCodeRef);
    if (nextCodeSnap.exists() && nextCodeSnap.data()?.familyId !== familyId) {
      throw new Error("family-code-already-exists");
    }

    tx.set(nextCodeRef, {
      familyId,
      createdAt: nextCodeSnap.exists() ? nextCodeSnap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (oldCode) {
      const oldCodeRef = doc(db, "familyCodes", oldCode);
      tx.delete(oldCodeRef);
    }

    tx.update(familyRef, {
      familyCode: normalizedNextCode,
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid
    });
  });
}

export function subscribeFamily(db, familyId, callback, onError) {
  const ref = doc(db, "families", familyId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

export async function updateFamilySettings(db, familyId, user, data) {
  const ref = doc(db, "families", familyId);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid
  }, { merge: true });
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

function normalizeFamilyCode(value) {
  if (!value) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function generateFamilyId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `fam_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
  }
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 20; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `fam_${suffix}`;
}
