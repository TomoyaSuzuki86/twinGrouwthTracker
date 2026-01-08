import { calcDiscordance } from "./calc.js";

export function setActiveView(viewId) {
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === viewId);
  });
}

export function renderVisits(tableBody, visits, statsMap) {
  tableBody.innerHTML = "";
  if (!visits.length) {
    return;
  }
  for (const visit of visits) {
    const discord = statsMap?.get(visit.id)?.discordance ?? calcDiscordance(visit?.fetuses?.A?.efwG, visit?.fetuses?.B?.efwG);
    const tr = document.createElement("tr");
    tr.dataset.id = visit.id;
    tr.innerHTML = `
      <td>${escapeHtml(visit.date || "")}</td>
      <td>${escapeHtml(visit.gaText || "")}</td>
      <td>${formatNumber(visit?.fetuses?.A?.efwG)}</td>
      <td>${formatNumber(visit?.fetuses?.B?.efwG)}</td>
      <td>${formatNumber(discord, 1)}%</td>
    `;
    tableBody.appendChild(tr);
  }
}

export function renderDetail(summaryEl, visit, stats) {
  if (!visit) {
    summaryEl.innerHTML = "";
    return;
  }
  const discord = stats?.discordance ?? calcDiscordance(visit?.fetuses?.A?.efwG, visit?.fetuses?.B?.efwG);
  const aPerDay = stats?.aPerDay;
  const bPerDay = stats?.bPerDay;
  const ideal = stats?.idealEfw;
  const aDelta = stats?.aDeltaFromIdeal;
  const bDelta = stats?.bDeltaFromIdeal;

  summaryEl.innerHTML = `
    <div><strong>${escapeHtml(visit.date || "")}</strong> ${escapeHtml(visit.gaText || "")}</div>
    <div>A EFW: ${formatNumber(visit?.fetuses?.A?.efwG)} g / B EFW: ${formatNumber(visit?.fetuses?.B?.efwG)} g</div>
    <div>体重差: ${formatNumber(discord, 1)}%</div>
    <div>理想体重: ${formatNumber(ideal)} g (A ${formatSigned(aDelta)} g, B ${formatSigned(bDelta)} g)</div>
    <div>前回比/日: A ${formatNumber(aPerDay, 1)} g/day, B ${formatNumber(bPerDay, 1)} g/day</div>
    <div>メモ: ${escapeHtml(visit.memo || "")}</div>
  `;
}

export function fillForm(formEl, visit) {
  formEl.reset();
  if (!visit) {
    return;
  }
  formEl.date.value = visit.date || "";
  formEl.gaText.value = visit.gaText || "";
  formEl.cervixCm.value = visit.cervixCm ?? "";
  formEl.memo.value = visit.memo || "";

  formEl.A_bpdMm.value = visit?.fetuses?.A?.bpdMm ?? "";
  formEl.A_acMm.value = visit?.fetuses?.A?.acMm ?? "";
  formEl.A_flMm.value = visit?.fetuses?.A?.flMm ?? "";
  formEl.A_efwG.value = visit?.fetuses?.A?.efwG ?? "";

  formEl.B_bpdMm.value = visit?.fetuses?.B?.bpdMm ?? "";
  formEl.B_acMm.value = visit?.fetuses?.B?.acMm ?? "";
  formEl.B_flMm.value = visit?.fetuses?.B?.flMm ?? "";
  formEl.B_efwG.value = visit?.fetuses?.B?.efwG ?? "";
}

export function getFormData(formEl) {
  return {
    date: formEl.date.value,
    gaText: formEl.gaText.value.trim(),
    cervixCm: toNumber(formEl.cervixCm.value),
    memo: formEl.memo.value.trim(),
    fetuses: {
      A: {
        bpdMm: toNumber(formEl.A_bpdMm.value),
        acMm: toNumber(formEl.A_acMm.value),
        flMm: toNumber(formEl.A_flMm.value),
        efwG: toNumber(formEl.A_efwG.value)
      },
      B: {
        bpdMm: toNumber(formEl.B_bpdMm.value),
        acMm: toNumber(formEl.B_acMm.value),
        flMm: toNumber(formEl.B_flMm.value),
        efwG: toNumber(formEl.B_efwG.value)
      }
    }
  };
}

export function setFamilyLabel(el, familyId) {
  el.textContent = familyId ? `family ${familyId}` : "";
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function formatSigned(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  const num = Number(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(digits)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
