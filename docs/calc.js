export function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function calcDiscordance(aEfw, bEfw) {
  const a = toNumber(aEfw) || 0;
  const b = toNumber(bEfw) || 0;
  const bigger = Math.max(a, b);
  const smaller = Math.min(a, b);
  if (bigger <= 0) {
    return 0;
  }
  return ((bigger - smaller) / bigger) * 100;
}

export function calcPerDay(current, previous, days) {
  if (!previous || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  const curr = toNumber(current);
  const prev = toNumber(previous);
  if (curr === null || prev === null) {
    return null;
  }
  return (curr - prev) / days;
}

export function buildVisitStats(visits) {
  const stats = new Map();
  const byDate = [...visits].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  for (let i = 0; i < byDate.length; i += 1) {
    const current = byDate[i];
    const prev = byDate[i - 1];
    const days = prev ? dayDiff(prev.date, current.date) : null;
    const aPerDay = prev ? calcPerDay(current?.fetuses?.A?.efwG, prev?.fetuses?.A?.efwG, days) : null;
    const bPerDay = prev ? calcPerDay(current?.fetuses?.B?.efwG, prev?.fetuses?.B?.efwG, days) : null;

    stats.set(current.id, {
      discordance: calcDiscordance(current?.fetuses?.A?.efwG, current?.fetuses?.B?.efwG),
      aPerDay,
      bPerDay,
      daysDiff: days
    });
  }

  return stats;
}

function dayDiff(dateA, dateB) {
  if (!dateA || !dateB) {
    return null;
  }
  const a = new Date(dateA);
  const b = new Date(dateB);
  const diffMs = b.getTime() - a.getTime();
  if (!Number.isFinite(diffMs)) {
    return null;
  }
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
