import { initFirebase, getDb } from "./firebase.js";
import {
  createFamily,
  listFamilyCodes,
  joinFamilyByInvite,
  joinFamilyByCode,
  updateFamilyCode,
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
import { renderGrowthChart, renderCervixChart } from "./chart.js";

const LS_FAMILY = "ttt_family_id";
const LS_LOCK_ENABLED = "ttt_lock_enabled";
const LS_LOCK_CODE = "ttt_lock_code";
const LS_DUE_DATE = "ttt_due_date";

const state = {
  user: null,
  familyId: null,
  familyCode: null,
  family: null,
  visits: [],
  stats: new Map(),
  selectedId: null,
  unsubscribeVisits: null,
  unsubscribeFamily: null,
  allFamilyCodes: [],
  dueDate: null,
  editingVisit: null
};

const el = {
  btnAddFab: document.getElementById("btn-add-fab"),
  btnSettings: document.getElementById("btn-settings"),
  btnCreateFamily: document.getElementById("btn-create-family"),
  btnJoinFamily: document.getElementById("btn-join-family"),
  inputCreateFamilyCode: document.getElementById("input-create-family-id"),
  selectFamilyCode: document.getElementById("select-family-id"),
  inputFamilyCode: document.getElementById("input-family-id"),
  btnCopyFamilyLink: document.getElementById("btn-copy-family-link"),
  cervixModal: document.getElementById("cervix-modal"),
  btnCloseCervixModal: document.getElementById("btn-close-cervix-modal"),
  cervixChart: document.getElementById("cervix-chart"),
  cervixTableWrap: document.getElementById("cervix-table-wrap"),
  cervixTableBody: document.getElementById("cervix-table-body"),
  cervixEmpty: document.getElementById("cervix-empty"),
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
  inputFamilyCodeEdit: document.getElementById("input-family-code-edit"),
  btnSaveFamilyCode: document.getElementById("btn-save-family-code"),
  derivedGa: document.getElementById("derived-ga")
};

initFirebase(async (user) => {
  state.user = user;
  setupSettings();
  await loadFamilyCodes();

  const url = new URL(window.location.href);
  const familyFromUrl = normalizeFamilyId(url.searchParams.get("family"));
  const storedFamilyId = normalizeFamilyId(localStorage.getItem(LS_FAMILY));

  if (familyFromUrl) {
    const joined = await trySetFamilyById(familyFromUrl, { mode: "invite" });
    if (joined) {
      url.searchParams.delete("family");
      history.replaceState({}, "", url);
      return;
    }
  }

  if (storedFamilyId) {
    const resumed = await trySetFamilyById(storedFamilyId, { mode: "stored" });
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
el.btnJoinFamily.addEventListener("click", () => joinByCode());
el.btnCopyLink.addEventListener("click", () => copyInviteLink());
el.btnCopyFamilyLink.addEventListener("click", () => copyInviteLink());
el.btnSaveFamilyCode.addEventListener("click", () => saveFamilyCode());
el.btnCloseCervixModal.addEventListener("click", () => closeCervixModal());
el.cervixModal.addEventListener("click", (event) => {
  if (event.target === el.cervixModal) {
    closeCervixModal();
  }
});
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
el.selectFamilyCode.addEventListener("change", () => {
  const value = normalizeFamilyCode(el.selectFamilyCode.value);
  if (value) {
    el.inputFamilyCode.value = value;
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

el.detailSummary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='open-cervix-chart']");
  if (!button) {
    return;
  }
  openCervixModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isCervixModalOpen()) {
    closeCervixModal();
  }
});

async function createAndJoin() {
  const familyCode = normalizeFamilyCode(el.inputCreateFamilyCode.value);

  if (!isValidFamilyCode(familyCode)) {
    alert("家族コードは英数字3〜32文字で入力してください");
    return;
  }

  try {
    const db = getDb();
    const created = await createFamily(db, state.user, familyCode);
    await loadFamilyCodes();
    await setFamily(created.familyId, created.familyCode);
  } catch (err) {
    console.error(err);
    if (err?.message === "family-code-already-exists") {
      alert("その家族コードは既に使われています。別のコードを入力してください。");
      return;
    }
    alert("家族作成に失敗しました");
  }
}

async function joinByCode() {
  const selectedCode = normalizeFamilyCode(el.selectFamilyCode.value);
  const inputCode = normalizeFamilyCode(el.inputFamilyCode.value);
  const familyCode = inputCode || selectedCode;

  if (!isValidFamilyCode(familyCode)) {
    alert("家族コードは英数字3〜32文字で入力してください");
    return;
  }

  try {
    const joined = await joinFamilyByCode(getDb(), state.user, familyCode);
    await setFamily(joined.familyId, joined.family?.familyCode || familyCode);
  } catch (err) {
    console.error(err);
    handleJoinError(err, "manual");
  }
}

async function trySetFamilyById(familyId, options) {
  try {
    await joinFamilyByInvite(getDb(), state.user, familyId);
    await setFamily(familyId, null);
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
    alert("家族が見つかりません。招待リンクまたは家族コードを確認してください。");
    return;
  }
  if (mode === "stored") {
    alert("保存済みの家族に接続できませんでした。再参加してください。");
    return;
  }
  alert("家族への参加に失敗しました");
}

async function setFamily(familyId, familyCode) {
  state.familyId = normalizeFamilyId(familyId);
  state.familyCode = normalizeFamilyCode(familyCode) || null;
  localStorage.setItem(LS_FAMILY, state.familyId);
  setFamilyLabel(el.labelFamily, state.familyCode || state.familyId);
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
      const incomingCode = normalizeFamilyCode(family?.familyCode || state.familyId);
      state.familyCode = incomingCode;
      setFamilyLabel(el.labelFamily, incomingCode || state.familyId);
      el.inputFamilyCodeEdit.value = incomingCode || "";

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
  closeCervixModal();
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
      familyCode: state.familyCode,
      exportedAt: new Date().toISOString(),
      visits
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twin-visits-${state.familyCode || state.familyId}.json`;
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
  el.inputFamilyCodeEdit.value = "";
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

async function saveFamilyCode() {
  if (!state.familyId) {
    return;
  }
  const nextCode = normalizeFamilyCode(el.inputFamilyCodeEdit.value);
  if (!isValidFamilyCode(nextCode)) {
    alert("家族コードは英数字3〜32文字で入力してください");
    return;
  }
  try {
    await updateFamilyCode(getDb(), state.familyId, state.user, nextCode);
    state.familyCode = nextCode;
    setFamilyLabel(el.labelFamily, nextCode);
    await loadFamilyCodes();
    alert("家族コードを更新しました");
  } catch (err) {
    console.error(err);
    if (err?.code === "permission-denied") {
      alert("権限エラーです。Firestore ルールをデプロイしてください（firebase deploy --only firestore:rules）。");
      return;
    }
    if (err?.message === "family-code-already-exists") {
      alert("その家族コードは既に使われています");
      return;
    }
    alert("家族コードの更新に失敗しました");
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
  const input = prompt("パスワードを入力してください");
  return input === code;
}

function leaveFamily() {
  const ok = confirm("家族コードを削除して最初の画面に戻りますか？");
  if (!ok) {
    return;
  }
  localStorage.removeItem(LS_FAMILY);
  state.familyId = null;
  state.familyCode = null;
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
  closeCervixModal();
  showSetup();
}

function openCervixModal() {
  const rows = getCervixRows();
  renderCervixTable(rows);
  renderCervixChart(el.cervixChart, rows);
  const hasRows = rows.length > 0;
  el.cervixEmpty.style.display = hasRows ? "none" : "block";
  el.cervixChart.style.display = hasRows ? "block" : "none";
  el.cervixTableWrap.style.display = hasRows ? "block" : "none";
  el.cervixModal.classList.add("open");
  el.cervixModal.setAttribute("aria-hidden", "false");
}

function closeCervixModal() {
  el.cervixModal.classList.remove("open");
  el.cervixModal.setAttribute("aria-hidden", "true");
}

function isCervixModalOpen() {
  return el.cervixModal.classList.contains("open");
}

function getCervixRows() {
  return [...state.visits]
    .map((visit) => {
      const value = Number(visit?.cervixMm);
      if (!Number.isFinite(value) || value <= 0) {
        return null;
      }
      const gaText = gaTextFromDates(visit?.date, state.dueDate) || visit?.gaText || "";
      return {
        date: visit?.date || "",
        gaText,
        cervixMm: value
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function renderCervixTable(rows) {
  el.cervixTableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.gaText)}</td>
      <td>${Number(row.cervixMm).toFixed(1)}</td>
    `;
    el.cervixTableBody.appendChild(tr);
  }
}

async function loadFamilyCodes() {
  try {
    state.allFamilyCodes = await listFamilyCodes(getDb());
    renderFamilyCodeOptions();
  } catch (err) {
    console.error(err);
  }
}

function renderFamilyCodeOptions() {
  const items = state.allFamilyCodes;
  const current = normalizeFamilyCode(el.selectFamilyCode.value);
  el.selectFamilyCode.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "選択してください";
  el.selectFamilyCode.appendChild(defaultOption);

  for (const familyCode of items) {
    const option = document.createElement("option");
    option.value = familyCode;
    option.textContent = familyCode;
    el.selectFamilyCode.appendChild(option);
  }

  if (current && items.includes(current)) {
    el.selectFamilyCode.value = current;
  }
}

function normalizeFamilyId(value) {
  if (!value) {
    return "";
  }
  return String(value).trim();
}

function normalizeFamilyCode(value) {
  if (!value) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function isValidFamilyCode(value) {
  if (!value) {
    return false;
  }
  return /^[a-z0-9]{3,32}$/.test(value);
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
