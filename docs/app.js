import { initFirebase, getDb } from "./firebase.js";
import {
  createFamily,
  joinFamilyByInvite,
  joinFamilyWithPassword,
  subscribeFamily,
  subscribeVisits,
  updateFamilySettings,
  addVisit,
  updateVisit,
  deleteVisit,
  exportVisits,
  importVisits
} from "./store.js";
import { setActiveView, renderVisits, renderDetail, fillForm, getFormData, setFamilyLabel } from "./ui.js";
import { buildVisitStats, gaTextFromDates } from "./calc.js";
import { renderGrowthChart } from "./chart.js";

const LS_FAMILY = "ttt_family_id";
const LS_RECENT_FAMILIES = "ttt_recent_families";
const LS_LOCK_ENABLED = "ttt_lock_enabled";
const LS_LOCK_CODE = "ttt_lock_code";
const LS_DUE_DATE = "ttt_due_date";

const state = {
  user: null,
  familyId: null,
  family: null,
  visits: [],
  stats: new Map(),
  selectedId: null,
  unsubscribeVisits: null,
  unsubscribeFamily: null,
  dueDate: null,
  editingVisit: null
};

const el = {
  btnAddFab: document.getElementById("btn-add-fab"),
  btnSettings: document.getElementById("btn-settings"),
  btnCreateFamily: document.getElementById("btn-create-family"),
  btnJoinFamily: document.getElementById("btn-join-family"),
  inputCreateFamilyId: document.getElementById("input-create-family-id"),
  inputCreateFamilyPass: document.getElementById("input-create-family-pass"),
  selectFamilyId: document.getElementById("select-family-id"),
  inputFamilyId: document.getElementById("input-family-id"),
  inputFamilyPass: document.getElementById("input-family-pass"),
  btnFamilyChip: document.getElementById("btn-family-chip"),
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
  btnLeaveFamily: document.getElementById("btn-leave-family"),
  inputDueDate: document.getElementById("input-due-date"),
  derivedGa: document.getElementById("derived-ga")
};

initFirebase(async (user) => {
  state.user = user;
  setupSettings();
  renderRecentFamilies();

  const url = new URL(window.location.href);
  const familyFromUrl = normalizeFamilyId(url.searchParams.get("family"));
  const stored = normalizeFamilyId(localStorage.getItem(LS_FAMILY));

  if (familyFromUrl) {
    const joined = await trySetFamily(familyFromUrl, { mode: "invite" });
    if (joined) {
      url.searchParams.delete("family");
      history.replaceState({}, "", url);
      return;
    }
  }

  if (stored) {
    const resumed = await trySetFamily(stored, { mode: "stored" });
    if (resumed) {
      return;
    }
  }

  showSetup();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

el.btnAddFab.addEventListener("click", () => openForm());
el.btnSettings.addEventListener("click", () => showSettings());
el.btnCreateFamily.addEventListener("click", () => createAndJoin());
el.btnJoinFamily.addEventListener("click", () => joinByInput());
el.btnCopyLink.addEventListener("click", () => copyInviteLink());
el.btnFamilyChip.addEventListener("click", () => copyInviteLink());
el.btnCancelForm.addEventListener("click", () => showList());
el.btnEdit.addEventListener("click", () => editSelected());
el.btnBack.addEventListener("click", () => showList());
el.btnCloseSettings.addEventListener("click", () => showList());
el.btnExport.addEventListener("click", () => handleExport());
el.btnLeaveFamily.addEventListener("click", () => leaveFamily());
el.inputImport.addEventListener("change", (event) => handleImport(event));
el.toggleLock.addEventListener("change", () => saveLockSettings());
el.inputLockCode.addEventListener("change", () => saveLockSettings());
el.inputDueDate.addEventListener("change", () => saveDueDate());
el.form.date.addEventListener("change", () => updateDerivedGa());
el.selectFamilyId.addEventListener("change", () => {
  const value = normalizeFamilyId(el.selectFamilyId.value);
  if (value) {
    el.inputFamilyId.value = value;
  }
});

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = getFormData(el.form);
  if (!data.date) {
    alert("日付を入力してください");
    return;
  }
  const derivedGa = gaTextFromDates(data.date, state.dueDate);
  if (derivedGa) {
    data.gaText = derivedGa;
  } else if (state.editingVisit?.gaText) {
    data.gaText = state.editingVisit.gaText;
  }

  try {
    const db = getDb();
    if (state.selectedId) {
      await updateVisit(db, state.familyId, state.user, state.selectedId, data);
    } else {
      await addVisit(db, state.familyId, state.user, data);
    }
    showList();
  } catch (err) {
    console.error(err);
    alert("保存に失敗しました。通信状態を確認して再度お試しください。");
  }
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

  try {
    const db = getDb();
    await deleteVisit(db, state.familyId, state.selectedId);
    state.selectedId = null;
    showList();
  } catch (err) {
    console.error(err);
    alert("削除に失敗しました");
  }
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
  const familyId = normalizeFamilyId(el.inputCreateFamilyId.value);
  const password = String(el.inputCreateFamilyPass.value || "").trim();

  if (!familyId || !isValidFamilyId(familyId)) {
    alert("家族名は英数字3〜32文字で入力してください");
    return;
  }
  if (!password) {
    alert("家族パスワードを入力してください");
    return;
  }

  try {
    const db = getDb();
    await createFamily(db, state.user, familyId, password);
    await setFamily(familyId);
    el.inputCreateFamilyPass.value = "";
  } catch (err) {
    console.error(err);
    if (err?.message === "family-already-exists") {
      alert("その家族名は既に使われています。別の名前を入力してください。");
      return;
    }
    alert("家族作成に失敗しました");
  }
}

async function joinByInput() {
  const selectedFamily = normalizeFamilyId(el.selectFamilyId.value);
  const inputFamily = normalizeFamilyId(el.inputFamilyId.value);
  const familyId = inputFamily || selectedFamily;
  const password = String(el.inputFamilyPass.value || "").trim();

  if (!familyId || !isValidFamilyId(familyId)) {
    alert("家族名は英数字3〜32文字で入力してください");
    return;
  }
  if (!password) {
    alert("家族パスワードを入力してください");
    return;
  }

  const joined = await trySetFamily(familyId, { mode: "manual", password });
  if (joined) {
    el.inputFamilyPass.value = "";
  }
}

async function trySetFamily(familyId, options) {
  try {
    if (options?.mode === "invite") {
      await joinFamilyByInvite(getDb(), state.user, familyId);
    } else if (options?.mode === "manual") {
      await joinFamilyWithPassword(getDb(), state.user, familyId, options.password);
    }
    await setFamily(familyId);
    return true;
  } catch (err) {
    console.error(err);
    handleJoinError(err, options?.mode);
    return false;
  }
}

function handleJoinError(err, mode) {
  const code = err?.message || "";
  if (code === "family-not-found") {
    alert("家族名が見つかりません。招待リンクから参加するか、家族名を確認してください。");
    return;
  }
  if (code === "invalid-password") {
    alert("家族パスワードが正しくありません。");
    return;
  }
  if (mode === "stored") {
    alert("保存済みの家族に接続できませんでした。再参加してください。");
    return;
  }
  alert("家族への参加に失敗しました");
}

async function setFamily(familyId) {
  state.familyId = familyId;
  localStorage.setItem(LS_FAMILY, familyId);
  setFamilyLabel(el.labelFamily, familyId);
  addRecentFamily(familyId);
  renderRecentFamilies();
  subscribe();
  showList();
}

function subscribe() {
  if (state.unsubscribeVisits) {
    state.unsubscribeVisits();
  }
  if (state.unsubscribeFamily) {
    state.unsubscribeFamily();
  }

  state.unsubscribeFamily = subscribeFamily(
    getDb(),
    state.familyId,
    (family) => {
      state.family = family;
      const incomingDueDate = family?.dueDate || null;
      if (state.dueDate !== incomingDueDate) {
        state.dueDate = incomingDueDate;
        el.inputDueDate.value = incomingDueDate || "";
        localStorage.setItem(LS_DUE_DATE, incomingDueDate || "");
        refreshStats();
      }
    },
    (err) => {
      console.error(err);
      alert("家族データの読み込みに失敗しました");
    }
  );

  state.unsubscribeVisits = subscribeVisits(getDb(), state.familyId, (visits) => {
    state.visits = visits;
    state.stats = buildVisitStats(visits, state.dueDate);
    updateList();
    if (state.selectedId) {
      showDetail();
    }
  });
}

function updateList() {
  renderVisits(el.tableBody, state.visits, state.stats, state.dueDate);
  el.empty.style.display = state.visits.length ? "none" : "block";
}

function showSetup() {
  setActiveView("view-setup");
  el.btnAddFab.style.display = "none";
}

function showList() {
  if (!state.familyId) {
    showSetup();
    return;
  }
  setActiveView("view-list");
  el.btnAddFab.style.display = "flex";
  state.selectedId = null;
}

function openForm() {
  if (!state.familyId) {
    alert("家族を設定してください");
    showSetup();
    return;
  }
  state.selectedId = null;
  state.editingVisit = null;
  el.formTitle.textContent = "健診を追加";
  fillForm(el.form, null);
  el.form.date.value = todayDateString();
  el.btnDelete.style.display = "none";
  updateDerivedGa();
  setActiveView("view-form");
  el.btnAddFab.style.display = "none";
}

function editSelected() {
  const visit = state.visits.find((item) => item.id === state.selectedId);
  if (!visit) {
    return;
  }
  state.editingVisit = visit;
  el.formTitle.textContent = "健診を編集";
  fillForm(el.form, visit);
  el.btnDelete.style.display = "inline-flex";
  updateDerivedGa();
  setActiveView("view-form");
  el.btnAddFab.style.display = "none";
}

function showDetail() {
  const visit = state.visits.find((item) => item.id === state.selectedId);
  const stats = state.stats.get(state.selectedId);
  renderDetail(el.detailSummary, visit, stats, state.dueDate);
  renderGrowthChart(el.chart, state.visits, state.stats);
  setActiveView("view-detail");
  el.btnAddFab.style.display = "flex";
}

function showSettings() {
  setActiveView("view-settings");
  el.btnAddFab.style.display = "none";
}

async function handleExport() {
  try {
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
  } catch (err) {
    console.error(err);
    alert("エクスポートに失敗しました");
  }
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
  if (!state.familyId) {
    return;
  }
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
  const dueDate = localStorage.getItem(LS_DUE_DATE) || "";
  el.toggleLock.checked = enabled;
  el.inputLockCode.value = code;
  el.inputDueDate.value = dueDate;
  state.dueDate = dueDate || null;
  refreshStats();
  updateDerivedGa();
}

function saveLockSettings() {
  localStorage.setItem(LS_LOCK_ENABLED, String(el.toggleLock.checked));
  localStorage.setItem(LS_LOCK_CODE, el.inputLockCode.value || "0817");
}

async function saveDueDate() {
  const value = el.inputDueDate.value || null;
  state.dueDate = value;
  localStorage.setItem(LS_DUE_DATE, value || "");
  refreshStats();
  updateDerivedGa();

  if (!state.familyId) {
    return;
  }
  try {
    await updateFamilySettings(getDb(), state.familyId, state.user, { dueDate: value });
  } catch (err) {
    console.error(err);
    alert("出産予定日の保存に失敗しました");
  }
}

function refreshStats() {
  if (!state.visits.length) {
    return;
  }
  state.stats = buildVisitStats(state.visits, state.dueDate);
  updateList();
  if (state.selectedId) {
    showDetail();
  }
}

function updateDerivedGa() {
  if (!el.derivedGa) {
    return;
  }
  const visitDate = el.form?.date?.value;
  const text = gaTextFromDates(visitDate, state.dueDate);
  if (text) {
    el.derivedGa.textContent = text;
  } else if (state.dueDate) {
    el.derivedGa.textContent = "-";
  } else {
    el.derivedGa.textContent = "出産予定日を設定してください";
  }
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
  const ok = confirm("家族名を削除して最初の画面に戻りますか？");
  if (!ok) {
    return;
  }
  localStorage.removeItem(LS_FAMILY);
  state.familyId = null;
  state.family = null;
  state.visits = [];
  state.selectedId = null;
  if (state.unsubscribeVisits) {
    state.unsubscribeVisits();
    state.unsubscribeVisits = null;
  }
  if (state.unsubscribeFamily) {
    state.unsubscribeFamily();
    state.unsubscribeFamily = null;
  }
  showSetup();
}

function renderRecentFamilies() {
  const ids = getRecentFamilies();
  const current = normalizeFamilyId(el.selectFamilyId.value);
  el.selectFamilyId.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "選択してください";
  el.selectFamilyId.appendChild(defaultOption);

  for (const id of ids) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    el.selectFamilyId.appendChild(option);
  }

  if (current && ids.includes(current)) {
    el.selectFamilyId.value = current;
  }
}

function addRecentFamily(familyId) {
  const id = normalizeFamilyId(familyId);
  if (!id) {
    return;
  }
  const current = getRecentFamilies();
  const next = [id, ...current.filter((item) => item !== id)].slice(0, 8);
  localStorage.setItem(LS_RECENT_FAMILIES, JSON.stringify(next));
}

function getRecentFamilies() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_RECENT_FAMILIES) || "[]");
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((item) => normalizeFamilyId(item))
      .filter((item) => isValidFamilyId(item));
  } catch {
    return [];
  }
}

function normalizeFamilyId(value) {
  if (!value) {
    return "";
  }
  return String(value).trim();
}

function isValidFamilyId(value) {
  if (!value) {
    return false;
  }
  return /^[A-Za-z0-9]{3,32}$/.test(value);
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
