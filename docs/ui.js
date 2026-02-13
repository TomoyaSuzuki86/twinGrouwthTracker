import { calcDiscordance, gaTextFromDates } from "./calc.js";

export function setActiveView(viewId) {
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.id === viewId);
  });
}

export function renderVisits(tableBody, visits, statsMap, dueDate) {
  tableBody.innerHTML = "";
  if (!visits.length) {
    return;
  }
  for (const visit of visits) {
    const discord = statsMap?.get(visit.id)?.discordance ?? calcDiscordance(visit?.fetuses?.A?.efwG, visit?.fetuses?.B?.efwG);
    const gaText = gaTextFromDates(visit?.date, dueDate) || visit?.gaText || "";
    const tr = document.createElement("tr");
    tr.dataset.id = visit.id;
    tr.innerHTML = `
      <td>${escapeHtml(visit.date || "")}</td>
      <td>${escapeHtml(gaText)}</td>
      <td>A ${formatNumber(visit?.fetuses?.A?.efwG)} / B ${formatNumber(visit?.fetuses?.B?.efwG)}</td>
      <td>${formatNumber(discord, 1)}%</td>
    `;
    tableBody.appendChild(tr);
  }
}

export function renderDetail(summaryEl, visit, stats, dueDate) {
  if (!visit) {
    summaryEl.innerHTML = "";
    return;
  }
  const discord = stats?.discordance ?? calcDiscordance(visit?.fetuses?.A?.efwG, visit?.fetuses?.B?.efwG);
  const gaText = gaTextFromDates(visit?.date, dueDate) || visit?.gaText || "";
  const aPerDay = stats?.aPerDay;
  const bPerDay = stats?.bPerDay;
  const ideal = stats?.idealEfw;
  const aDelta = stats?.aDeltaFromIdeal;
  const bDelta = stats?.bDeltaFromIdeal;

  const fetusCard = (fetus, key) => {
    const title = key === "A" ? "Fetus A" : "Fetus B";
    const perDay = key === "A" ? aPerDay : bPerDay;
    const delta = key === "A" ? aDelta : bDelta;
    return `
      <div class="summary-card">
        <div class="summary-card-title fetus-${key.toLowerCase()}">${title}</div>
        <div class="summary-item">
          <span class="summary-item-label">推定体重(EFW)</span>
          <span class="summary-item-value">${formatNumber(fetus?.efwG)} g</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">理想との差</span>
          <span class="summary-item-value">${formatSigned(delta)} g</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">前回比/日</span>
          <span class="summary-item-value">${formatNumber(perDay, 1)} g/day</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">頭の横幅(BPD)</span>
          <span class="summary-item-value">${formatNumber(fetus?.bpdMm, 1)} mm</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">頭の前後(OFD)</span>
          <span class="summary-item-value">${formatNumber(fetus?.ofdMm, 1)} mm</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">頭囲(HC)</span>
          <span class="summary-item-value">${formatNumber(fetus?.hcMm, 1)} mm</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">腹囲(AC)</span>
          <span class="summary-item-value">${formatNumber(fetus?.acMm, 1)} mm</span>
        </div>
        <div class="summary-item">
          <span class="summary-item-label">大腿骨長(FL)</span>
          <span class="summary-item-value">${formatNumber(fetus?.flMm, 1)} mm</span>
        </div>
      </div>
    `;
  };

  summaryEl.innerHTML = `
    <div><strong>${escapeHtml(visit.date || "")}</strong> ${escapeHtml(gaText)}</div>
    <div class="summary-grid">
      ${fetusCard(visit?.fetuses?.A, "A")}
      ${fetusCard(visit?.fetuses?.B, "B")}
    </div>
    <div>
      <div class="summary-item">
        <span class="summary-item-label">体重差</span>
        <span class="summary-item-value">${formatNumber(discord, 1)}%</span>
      </div>
      <div class="summary-item">
        <span class="summary-item-label">理想体重（平均）</span>
        <span class="summary-item-value">${formatNumber(ideal)} g</span>
      </div>
      <div class="summary-item">
        <span class="summary-item-label summary-label-with-icon">
          子宮頸管
          <button class="inline-icon-btn" type="button" data-action="open-cervix-chart" title="子宮頚管グラフを表示" aria-label="子宮頚管グラフを表示">
            <span class="material-icons">show_chart</span>
          </button>
        </span>
        <span class="summary-item-value">${formatNumber(visit.cervixMm, 1)} mm</span>
      </div>
      <div class="summary-item">
        <span class="summary-item-label">メモ</span>
        <span class="summary-item-value">${escapeHtml(visit.memo || "")}</span>
      </div>
    </div>
  `;
}

export function fillForm(formEl, visit) {
  formEl.reset();
  if (!visit) {
    return;
  }
  formEl.date.value = visit.date || "";
  const cervixMm = visit.cervixMm ?? (Number.isFinite(visit.cervixCm) ? visit.cervixCm * 10 : null);
  formEl.cervixMm.value = cervixMm ?? "";
  formEl.memo.value = visit.memo || "";

  formEl.A_bpdMm.value = visit?.fetuses?.A?.bpdMm ?? "";
  formEl.A_ofdMm.value = visit?.fetuses?.A?.ofdMm ?? "";
  formEl.A_hcMm.value = visit?.fetuses?.A?.hcMm ?? "";
  formEl.A_acMm.value = visit?.fetuses?.A?.acMm ?? "";
  formEl.A_flMm.value = visit?.fetuses?.A?.flMm ?? "";
  formEl.A_efwG.value = visit?.fetuses?.A?.efwG ?? "";

  formEl.B_bpdMm.value = visit?.fetuses?.B?.bpdMm ?? "";
  formEl.B_ofdMm.value = visit?.fetuses?.B?.ofdMm ?? "";
  formEl.B_hcMm.value = visit?.fetuses?.B?.hcMm ?? "";
  formEl.B_acMm.value = visit?.fetuses?.B?.acMm ?? "";
  formEl.B_flMm.value = visit?.fetuses?.B?.flMm ?? "";
  formEl.B_efwG.value = visit?.fetuses?.B?.efwG ?? "";
}

export function getFormData(formEl) {
  return {
    date: formEl.date.value,
    cervixMm: toNumber(formEl.cervixMm.value),
    memo: formEl.memo.value.trim(),
    fetuses: {
      A: {
        bpdMm: toNumber(formEl.A_bpdMm.value),
        ofdMm: toNumber(formEl.A_ofdMm.value),
        hcMm: toNumber(formEl.A_hcMm.value),
        acMm: toNumber(formEl.A_acMm.value),
        flMm: toNumber(formEl.A_flMm.value),
        efwG: toNumber(formEl.A_efwG.value)
      },
      B: {
        bpdMm: toNumber(formEl.B_bpdMm.value),
        ofdMm: toNumber(formEl.B_ofdMm.value),
        hcMm: toNumber(formEl.B_hcMm.value),
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
