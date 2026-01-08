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
    const gaWeeks = parseGaText(current?.gaText);
    const idealEfw = gaWeeks !== null ? idealWeightForWeeks(gaWeeks) : null;
    const aEfw = toNumber(current?.fetuses?.A?.efwG);
    const bEfw = toNumber(current?.fetuses?.B?.efwG);

    stats.set(current.id, {
      discordance: calcDiscordance(current?.fetuses?.A?.efwG, current?.fetuses?.B?.efwG),
      aPerDay,
      bPerDay,
      daysDiff: days,
      idealEfw,
      aDeltaFromIdeal: idealEfw !== null && aEfw !== null ? aEfw - idealEfw : null,
      bDeltaFromIdeal: idealEfw !== null && bEfw !== null ? bEfw - idealEfw : null
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

const IDEAL_WEIGHTS = new Map([
  [16, 139],
  [17, 147],
  [18, 178],
  [19, 228],
  [20, 294],
  [21, 374],
  [22, 466],
  [23, 568],
  [24, 679],
  [25, 799],
  [26, 925],
  [27, 1058],
  [28, 1196],
  [29, 1340],
  [30, 1487],
  [31, 1640],
  [32, 1795],
  [33, 1955],
  [34, 2117],
  [35, 2282],
  [36, 2449],
  [37, 2620],
  [38, 2792],
  [39, 2966],
  [40, 3142],
  [41, 3320],
  [42, 3499]
]);

export function parseGaText(text) {
  if (!text) {
    return null;
  }
  const match = String(text).trim().match(/(\d+)w(\d+)d/i);
  if (!match) {
    return null;
  }
  const weeks = Number(match[1]);
  const days = Number(match[2]);
  if (!Number.isFinite(weeks) || !Number.isFinite(days)) {
    return null;
  }
  return weeks + days / 7;
}

export function idealWeightForWeeks(weeks) {
  if (!Number.isFinite(weeks)) {
    return null;
  }
  const floorWeek = Math.floor(weeks);
  const ceilWeek = Math.ceil(weeks);
  const floorVal = IDEAL_WEIGHTS.get(floorWeek);
  const ceilVal = IDEAL_WEIGHTS.get(ceilWeek);
  if (floorVal === undefined || ceilVal === undefined) {
    return null;
  }
  if (floorWeek === ceilWeek) {
    return floorVal;
  }
  const ratio = (weeks - floorWeek) / (ceilWeek - floorWeek);
  return floorVal + (ceilVal - floorVal) * ratio;
}
