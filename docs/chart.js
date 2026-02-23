import { gaWeeksFromDates, parseGaText } from "./calc.js";

export function renderGrowthChart(canvas, visits, statsMap, dueDate, options = {}) {
  if (!canvas || typeof Chart === "undefined") {
    return;
  }
  destroyChartOnCanvas(canvas);

  const ordered = [...visits].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const aData = ordered
    .map((visit) => toPositivePoint(visit, dueDate, visit?.fetuses?.A?.efwG))
    .filter(Boolean);
  const bData = ordered
    .map((visit) => toPositivePoint(visit, dueDate, visit?.fetuses?.B?.efwG))
    .filter(Boolean);
  const dData = ordered
    .map((visit) => {
    const stats = statsMap.get(visit.id);
    return toPositivePoint(visit, dueDate, stats && stats.discordance !== null ? Number(stats.discordance.toFixed(1)) : null);
    })
    .filter(Boolean);
  const idealData = ordered
    .map((visit) => {
    const stats = statsMap.get(visit.id);
    return toPositivePoint(visit, dueDate, stats?.idealEfw ?? null);
    })
    .filter(Boolean);
  const timeAxis = buildTimeAxisConfig(ordered, dueDate);
  const useTimeAxis = !!timeAxis;

  new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "A 推定体重 (g)",
          data: aData,
          borderColor: "#c6492f",
          backgroundColor: "rgba(198, 73, 47, 0.2)",
          tension: 0.2,
          spanGaps: true
        },
        {
          label: "B 推定体重 (g)",
          data: bData,
          borderColor: "#1b4d6b",
          backgroundColor: "rgba(27, 77, 107, 0.2)",
          tension: 0.2,
          spanGaps: true
        },
        {
          label: "体重差 (%)",
          data: dData,
          borderColor: "#3c1f22",
          backgroundColor: "rgba(60, 31, 34, 0.2)",
          borderDash: [6, 4],
          yAxisID: "y2",
          tension: 0.2,
          spanGaps: true
        },
        {
          label: "理想体重（平均）",
          data: idealData,
          borderColor: "#7a6a60",
          backgroundColor: "rgba(122, 106, 96, 0.15)",
          borderDash: [4, 6],
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: options.maintainAspectRatio ?? true,
      parsing: false,
      plugins: {
        legend: {
          labels: {
            color: "#1b3158"
          }
        },
        tooltip: {
          callbacks: {
            title: (items) => formatTooltipTitle(items)
          }
        }
      },
      scales: {
        x: useTimeAxis ? timeAxis : {
          ticks: { color: "#1b3158" },
          grid: { color: "rgba(27, 49, 88, 0.1)" }
        },
        y: {
          ticks: { color: "#1b3158" },
          grid: { color: "rgba(27, 49, 88, 0.18)" },
          title: { display: true, text: "EFW (g)", color: "#1b3158" }
        },
        y2: {
          position: "right",
          ticks: { color: "#1b3158" },
          title: { display: true, text: "Discordance (%)", color: "#1b3158" },
          grid: { drawOnChartArea: false, color: "rgba(27, 49, 88, 0.18)" }
        }
      }
    }
  });
}

export function renderCervixChart(canvas, records, dueDate) {
  if (!canvas || typeof Chart === "undefined") {
    return;
  }
  destroyChartOnCanvas(canvas);

  const filtered = Array.isArray(records)
    ? records.filter((item) => Number.isFinite(item?.cervixMm) && item.cervixMm > 0)
    : [];
  if (!filtered.length) {
    return;
  }

  const values = filtered.map((item) => toPoint(item, dueDate, item.cervixMm)).filter(Boolean);
  const timeAxis = buildTimeAxisConfig(filtered, dueDate);

  new Chart(canvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "子宮頚管 (mm)",
          data: values,
          borderColor: "#2f6b6f",
          backgroundColor: "rgba(47, 107, 111, 0.2)",
          tension: 0.2,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      parsing: false,
      plugins: {
        legend: {
          labels: {
            color: "#1b3158"
          }
        },
        tooltip: {
          callbacks: {
            title: (items) => formatTooltipTitle(items)
          }
        }
      },
      scales: {
        x: timeAxis || {
          ticks: { color: "#1b3158" },
          grid: { color: "rgba(27, 49, 88, 0.1)" }
        },
        y: {
          ticks: { color: "#1b3158" },
          grid: { color: "rgba(27, 49, 88, 0.18)" },
          title: { display: true, text: "mm", color: "#1b3158" }
        }
      }
    }
  });
}

function toPoint(item, dueDate, y) {
  const yNum = Number(y);
  const x = getGaDays(item, dueDate);
  if (!Number.isFinite(yNum) || !Number.isFinite(x)) {
    return null;
  }
  return { x, y: yNum };
}

function toPositivePoint(item, dueDate, y) {
  const yNum = Number(y);
  if (!Number.isFinite(yNum) || yNum <= 0) {
    return null;
  }
  return toPoint(item, dueDate, yNum);
}

function getGaDays(item, dueDate) {
  const byDateWeeks = dueDate ? gaWeeksFromDates(item?.date, dueDate) : null;
  if (Number.isFinite(byDateWeeks)) {
    return Math.round(byDateWeeks * 7);
  }
  const parsedWeeks = parseGaText(item?.gaText);
  if (Number.isFinite(parsedWeeks)) {
    return Math.round(parsedWeeks * 7);
  }
  return null;
}

function buildTimeAxisConfig(items, dueDate) {
  const xValues = items
    .map((item) => getGaDays(item, dueDate))
    .filter((value) => Number.isFinite(value));
  if (!xValues.length) {
    return null;
  }

  let min = Math.min(...xValues);
  let max = Math.max(...xValues);
  min = Math.floor(min / 7) * 7;
  max = Math.ceil(max / 7) * 7;
  if (min === max) {
    min -= 7;
    max += 7;
  }

  return {
    type: "linear",
    min,
    max,
    ticks: {
      color: "#1b3158",
      stepSize: 7,
      callback: (value) => formatGaDays(value)
    },
    grid: { color: "rgba(27, 49, 88, 0.1)" },
    title: { display: true, text: "週数", color: "#1b3158" }
  };
}

function formatTooltipTitle(items) {
  if (!items?.length) {
    return "";
  }
  const firstWithParsed = items.find((item) => item && item.parsed && Number.isFinite(item.parsed.x));
  const x = firstWithParsed?.parsed?.x;
  if (!Number.isFinite(x)) {
    return items[0]?.label || "";
  }
  return formatGaDays(x);
}

function formatGaDays(value) {
  const daysTotal = Math.round(Number(value));
  if (!Number.isFinite(daysTotal)) {
    return "";
  }
  const weeks = Math.floor(daysTotal / 7);
  const days = ((daysTotal % 7) + 7) % 7;
  return `${weeks}w${days}d`;
}

function destroyChartOnCanvas(canvas) {
  if (!canvas || typeof Chart === "undefined" || typeof Chart.getChart !== "function") {
    return;
  }
  const existing = Chart.getChart(canvas);
  if (existing) {
    existing.destroy();
  }
}
