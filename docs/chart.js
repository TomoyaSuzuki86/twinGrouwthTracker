let chartInstance;

export function renderGrowthChart(canvas, visits, statsMap) {
  if (!canvas || typeof Chart === "undefined") {
    return;
  }
  if (chartInstance) {
    chartInstance.destroy();
  }

  const ordered = [...visits].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const labels = ordered.map((visit) => visit.date || "");
  const aData = ordered.map((visit) => Number(visit?.fetuses?.A?.efwG) || null);
  const bData = ordered.map((visit) => Number(visit?.fetuses?.B?.efwG) || null);
  const dData = ordered.map((visit) => {
    const stats = statsMap.get(visit.id);
    return stats ? Number(stats.discordance.toFixed(1)) : null;
  });

  chartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "A EFW (g)",
          data: aData,
          borderColor: "#c6492f",
          backgroundColor: "rgba(198, 73, 47, 0.2)",
          tension: 0.2
        },
        {
          label: "B EFW (g)",
          data: bData,
          borderColor: "#1b4d6b",
          backgroundColor: "rgba(27, 77, 107, 0.2)",
          tension: 0.2
        },
        {
          label: "Discordance (%)",
          data: dData,
          borderColor: "#3c1f22",
          backgroundColor: "rgba(60, 31, 34, 0.2)",
          borderDash: [6, 4],
          yAxisID: "y2",
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
