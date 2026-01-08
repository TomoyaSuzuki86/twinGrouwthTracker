import { initFirebase, getDb } from "./firebase.js";
import {
  createFamily,
  joinFamily,
  subscribeVisits,
  addVisit,
  updateVisit,
  deleteVisit,
  exportVisits,
  importVisits
} from "./store.js";
import { setActiveView, renderVisits, renderDetail, fillForm, getFormData, setFamilyLabel } from "./ui.js";
import { buildVisitStats } from "./calc.js";
import { renderGrowthChart } from "./chart.js";

const LS_FAMILY = "ttt_family_id";
const LS_LOCK_ENABLED = "ttt_lock_enabled";
const LS_LOCK_CODE = "ttt_lock_code";

const state = {
  user: null,
  familyId: null,
  visits: [],
  stats: new Map(),
  selectedId: null,
  unsubscribe: null
};

const el = {
  btnAdd: document.getElementById("btn-add"),
  btnSettings: document.getElementById("btn-settings"),
  btnCreateFamily: document.getElementById("btn-create-family"),
  btnJoinFamily: document.getElementById("btn-join-family"),
  inputFamilyId: document.getElementById("input-family-id"),
  tableBody: document.getElementById("visits-table"),
  empty: document.getElementById("empty-state"),
  labelFamily: document.getElementById("label-family-id"),
  btnCopyLink: document.getElementById("btn-copy-link"),
  form: document.getElementById("visit-form"),
  btnCancelForm: document.getElementById("btn-cancel-form"),
  btnDelete: document.getElementById("btn-delete"),
  formTitle: document.getElementById("form-title"),
  detailSummary: document.getElementById("detail-summary"),
  btnEdit: document.getElementById("btn-edit"),
  btnBack: document.getElementById("btn-back"),
  chart: document.getElementById("growth-chart"),
  btnCloseSettings: document.getElementById("btn-close-settings"),
  btnExport: document.getElementById("btn-export"),
  inputImport: document.getElementById("input-import"),
  toggleLock: document.getElementById("toggle-lock"),
  inputLockCode: document.getElementById("input-lock-code"),
  btnLeaveFamily: document.getElementById("btn-leave-family")
};

initFirebase(async (user) => {
  state.user = user;
  const familyFromUrl = new URLSearchParams(window.location.search).get("family");
  const stored = localStorage.getItem(LS_FAMILY);
  const familyId = familyFromUrl || stored;
  if (familyId) {
    await setFamilyId(familyId);
  } else {
    showSetup();
  }
  setupSettings();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

el.btnAdd.addEventListener("click", () => openForm());
el.btnSettings.addEventListener("click", () => showSettings());
el.btnCreateFamily.addEventListener("click", () => createAndJoin());
el.btnJoinFamily.addEventListener("click", () => joinByInput());
el.btnCopyLink.addEventListener("click", () => copyInviteLink());
el.btnCancelForm.addEventListener("click", () => showList());
el.btnEdit.addEventListener("click", () => editSelected());
el.btnBack.addEventListener("click", () => showList());
el.btnCloseSettings.addEventListener("click", () => showList());
el.btnExport.addEventListener("click", () => handleExport());
el.btnLeaveFamily.addEventListener("click", () => leaveFamily());
el.inputImport.addEventListener("change", (event) => handleImport(event));
el.toggleLock.addEventListener("change", () => saveLockSettings());
el.inputLockCode.addEventListener("change", () => saveLockSettings());

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = getFormData(el.form);
  if (!data.date) {
    alert("日付を入力してください");
    return;
  }
  const db = getDb();
  if (state.selectedId) {
    await updateVisit(db, state.familyId, state.user, state.selectedId, data);
  } else {
    await addVisit(db, state.familyId, state.user, data);
  }
  showList();
});

el.btnDelete.addEventListener("click", async () => {
  if (!state.selectedId) {
    return;
  }
  if (!confirmLock()) {
    return;
  }
  const ok = confirm("削除しますか？");
  if (!ok) {
    return;
  }
  const db = getDb();
  await deleteVisit(db, state.familyId, state.selectedId);
  state.selectedId = null;
  showList();
});

el.tableBody.addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) {
    return;
  }
  state.selectedId = row.dataset.id;
  showDetail();
});

async function createAndJoin() {
  const familyId = generateFamilyId();
  const db = getDb();
  await createFamily(db, state.user, familyId);
  await setFamilyId(familyId);
}

async function joinByInput() {
  const familyId = el.inputFamilyId.value.trim();
  if (!familyId) {
    alert("家族IDを入力してください");
    return;
  }
  await setFamilyId(familyId);
}

async function setFamilyId(familyId) {
  state.familyId = familyId;
  localStorage.setItem(LS_FAMILY, familyId);
  setFamilyLabel(el.labelFamily, familyId);
  await joinFamily(getDb(), state.user, familyId);
  subscribe();
  showList();
}

function subscribe() {
  if (state.unsubscribe) {
    state.unsubscribe();
  }
  state.unsubscribe = subscribeVisits(getDb(), state.familyId, (visits) => {
    state.visits = visits;
    state.stats = buildVisitStats(visits);
    updateList();
    if (state.selectedId) {
      showDetail();
    }
  });
}

function updateList() {
  renderVisits(el.tableBody, state.visits, state.stats);
  el.empty.style.display = state.visits.length ? "none" : "block";
}

function showSetup() {
  setActiveView("view-setup");
}

function showList() {
  if (!state.familyId) {
    showSetup();
    return;
  }
  setActiveView("view-list");
  state.selectedId = null;
}

function openForm() {
  if (!state.familyId) {
    alert("家族IDを設定してください");
    showSetup();
    return;
  }
  state.selectedId = null;
  el.formTitle.textContent = "健診を追加";
  fillForm(el.form, null);
  el.btnDelete.style.display = "none";
  setActiveView("view-form");
}

function editSelected() {
  const visit = state.visits.find((item) => item.id === state.selectedId);
  if (!visit) {
    return;
  }
  el.formTitle.textContent = "健診を編集";
  fillForm(el.form, visit);
  el.btnDelete.style.display = "inline-flex";
  setActiveView("view-form");
}

function showDetail() {
  const visit = state.visits.find((item) => item.id === state.selectedId);
  const stats = state.stats.get(state.selectedId);
  renderDetail(el.detailSummary, visit, stats);
  renderGrowthChart(el.chart, state.visits, state.stats);
  setActiveView("view-detail");
}

function showSettings() {
  setActiveView("view-settings");
}

async function handleExport() {
  const visits = await exportVisits(getDb(), state.familyId);
  const payload = {
    familyId: state.familyId,
    exportedAt: new Date().toISOString(),
    visits
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `twin-visits-${state.familyId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const visits = Array.isArray(data?.visits) ? data.visits : Array.isArray(data) ? data : [];
    if (!visits.length) {
      alert("有効なJSONが見つかりません");
      return;
    }
    await importVisits(getDb(), state.familyId, state.user, visits);
    alert("インポートしました");
    event.target.value = "";
  } catch (err) {
    console.error(err);
    alert("読み込みに失敗しました");
  }
}

function copyInviteLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("family", state.familyId);
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert("招待リンクをコピーしました");
  }).catch(() => {
    prompt("このリンクを共有してください", url.toString());
  });
}

function setupSettings() {
  const enabled = localStorage.getItem(LS_LOCK_ENABLED) === "true";
  const code = localStorage.getItem(LS_LOCK_CODE) || "0817";
  el.toggleLock.checked = enabled;
  el.inputLockCode.value = code;
}

function saveLockSettings() {
  localStorage.setItem(LS_LOCK_ENABLED, String(el.toggleLock.checked));
  localStorage.setItem(LS_LOCK_CODE, el.inputLockCode.value || "0817");
}

function confirmLock() {
  const enabled = localStorage.getItem(LS_LOCK_ENABLED) === "true";
  if (!enabled) {
    return true;
  }
  const code = localStorage.getItem(LS_LOCK_CODE) || "0817";
  const input = prompt("ロックコードを入力してください");
  return input === code;
}

function leaveFamily() {
  const ok = confirm("家族IDを削除して最初の画面に戻りますか？");
  if (!ok) {
    return;
  }
  localStorage.removeItem(LS_FAMILY);
  state.familyId = null;
  state.visits = [];
  state.selectedId = null;
  if (state.unsubscribe) {
    state.unsubscribe();
    state.unsubscribe = null;
  }
  showSetup();
}

function generateFamilyId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
