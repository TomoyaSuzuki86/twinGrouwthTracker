let chartInstance;
let cervixChartInstance;

export function renderGrowthChart(canvas, visits, statsMap) {
  if (!canvas || typeof Chart === "undefined") {
    return;
  }
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ordered = [...visits].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const labels = ordered.map((visit) => visit.date || "");
  const aData = ordered.map((visit) => (visit?.fetuses?.A?.efwG ? Number(visit.fetuses.A.efwG) : null));
  const bData = ordered.map((visit) => (visit?.fetuses?.B?.efwG ? Number(visit.fetuses.B.efwG) : null));
  const dData = ordered.map((visit) => {
    const stats = statsMap.get(visit.id);
    return stats && stats.discordance !== null ? Number(stats.discordance.toFixed(1)) : null;
  });
  const idealData = ordered.map((visit) => {
    const stats = statsMap.get(visit.id);
    return stats?.idealEfw ?? null;
  });

  chartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
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
      scales: {
        y: {
          title: { display: true, text: "EFW (g)" }
        },
        y2: {
          position: "right",
          title: { display: true, text: "Discordance (%)" },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

export function renderCervixChart(canvas, records) {
  if (!canvas || typeof Chart === "undefined") {
    return;
  }
  if (cervixChartInstance) {
    cervixChartInstance.destroy();
    cervixChartInstance = null;
  }

  const filtered = Array.isArray(records)
    ? records.filter((item) => Number.isFinite(item?.cervixMm) && item.cervixMm > 0)
    : [];
  if (!filtered.length) {
    return;
  }

  const labels = filtered.map((item) => item.date || "");
  const values = filtered.map((item) => Number(item.cervixMm));

  cervixChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
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
      scales: {
        y: {
          title: { display: true, text: "mm" }
        }
      }
    }
  });
}
