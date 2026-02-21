export interface LeaderboardEntry {
  score: number;
  date: string;
}

const LEADERBOARD_STORAGE_KEY = "duck-jam-balance-leaderboard";
const LEADERBOARD_MAX_ENTRIES = 5;

export const readLeaderboard = (): LeaderboardEntry[] => {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry) => {
        const hasScore = typeof entry?.score === "number";
        const hasDate = typeof entry?.date === "string";
        return hasScore && hasDate;
      })
      .map((entry) => ({
        score: Math.max(0, Math.floor(entry.score)),
        date: entry.date,
      }));
  } catch {
    return [];
  }
};

const writeLeaderboard = (entries: LeaderboardEntry[]): void => {
  try {
    localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors; gameplay should continue.
  }
};

export const addLeaderboardScore = (score: number): void => {
  if (score <= 0) {
    return;
  }

  const entries = readLeaderboard();
  entries.push({
    score,
    date: new Date().toLocaleDateString(),
  });
  entries.sort((a, b) => b.score - a.score);
  writeLeaderboard(entries.slice(0, LEADERBOARD_MAX_ENTRIES));
};
