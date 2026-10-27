import importedRoster from "@/lib/imported-roster.json";
import importedTeamStats from "@/lib/imported-team-stats.json";
import importedPlayerStats from "@/lib/imported-player-stats.json";

export type Conference = "East" | "West";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F";
export type LineupRole = "starter" | "bench" | "out";

export type TeamSnapshot = {
  abbr: string;
  season: string;
  wins: number;
  losses: number;
  conferenceRank: number;
  offensiveRating: number;
  offensiveRank: number;
  defensiveRating: number;
  defensiveRank: number;
  netRating: number;
  pace: number;
  playoffResult: string;
};

export type Team = {
  id: string;
  name: string;
  abbr: string;
  conference: Conference;
  wins: number;
  notes: string;
  grades: Record<string, Grade>;
};

export type Player = {
  id: string;
  externalId?: string;
  name: string;
  teamId: string;
  position: Position;
  sourcePosition?: string;
  height?: string;
  weight?: string;
  birthDate?: string;
  experience?: string;
  college?: string;
  games?: number;
  gamesStarted?: number;
  minutes?: number;
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  fgPct?: number;
  threePct?: number;
  ftPct?: number;
  rating: number;
  starter: boolean;
  lineupRole?: LineupRole;
  lineupOrder?: number;
  rankingOrder?: number;
  order: number;
};

export type Category = {
  id: string;
  name: string;
  group: string;
  weight: number;
};

export type AppState = {
  season: string;
  teams: Team[];
  players: Player[];
  categories: Category[];
  categoryGroups?: string[];
  conferenceOrder: Record<Conference, string[]>;
  standingsMode?: "manual";
  playoffPicks: Record<string, string>;
  awards: Record<string, string[]>;
  honors: Record<string, string[]>;
  rosterVersion?: string;
  rosterUpdatedAt?: string;
  rosterSource?: string;
  rankingRevision?: number;
};

type ImportedRosterRow = {
  externalId: string;
  name: string;
  team: string;
  sourcePosition: string;
  height: string;
  weight: string;
  birthDate: string;
  experience: string;
  college: string;
};

export const ROSTER_VERSION = "basketball-reference-2026-09-09-stats";
export const ROSTER_UPDATED_AT = "2026-09-09";
export const TEAM_STATS_UPDATED_AT = "2026-09-09";
const playoffResultLabels: Record<string, string> = { "אלופה": "Champion", "הפסידה בגמר": "NBA Finals", "גמר המזרח": "Eastern Conference Finals", "גמר המערב": "Western Conference Finals", "חצי גמר המזרח": "Eastern Conference Semifinals", "חצי גמר המערב": "Western Conference Semifinals", "סיבוב ראשון": "First Round", "לא העפילה לפלייאוף": "Missed Playoffs" };
export const TEAM_STATS = Object.fromEntries((importedTeamStats as TeamSnapshot[]).map((team) => [team.abbr, { ...team, playoffResult: playoffResultLabels[team.playoffResult] ?? team.playoffResult }])) as Record<string, TeamSnapshot>;

type ImportedPlayerStat = Pick<Player, "games" | "gamesStarted" | "minutes" | "points" | "rebounds" | "assists" | "steals" | "blocks" | "fgPct" | "threePct" | "ftPct"> & { externalId: string };
const PLAYER_STATS = new Map((importedPlayerStats as ImportedPlayerStat[]).map((line) => [line.externalId, line]));

const sourceTeamIds: Record<string, string> = {
  BRK: "bkn",
  CHO: "cha",
  PHO: "phx",
};

function positionFromSource(position: string): Position {
  if (position === "PG") return "PG";
  if (position === "SG") return "SG";
  if (position === "SF") return "SF";
  if (position === "PF") return "PF";
  if (position === "C" || position === "C-F") return "C";
  if (position === "F-C") return "PF";
  if (position === "F" || position === "F-G") return "SF";
  if (position === "G-F") return "SG";
  return "PG";
}

function normalizedName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function createImportedPlayers(): Player[] {
  const positionOrder = new Map<Position, number>();
  return (importedRoster as ImportedRosterRow[]).map((player) => {
    const position = positionFromSource(player.sourcePosition);
    const order = positionOrder.get(position) ?? 0;
    positionOrder.set(position, order + 1);
    return {
      id: `bbr-${player.externalId}`,
      externalId: player.externalId,
      name: player.name,
      teamId: sourceTeamIds[player.team] ?? player.team.toLowerCase(),
      position,
      sourcePosition: player.sourcePosition,
      height: player.height,
      weight: player.weight,
      birthDate: player.birthDate,
      experience: player.experience,
      college: player.college,
      ...PLAYER_STATS.get(player.externalId),
      rating: 70,
      starter: false,
      lineupRole: "out",
      order,
    };
  });
}

export function mergeImportedRoster(state: AppState): AppState {
  if (state.rosterVersion === ROSTER_VERSION) return state;
  const imported = createImportedPlayers();
  const existingByExternalId = new Map(state.players.filter((player) => player.externalId).map((player) => [player.externalId!, player]));
  const existingByName = new Map(state.players.map((player) => [normalizedName(player.name), player]));
  const matchedIds = new Set<string>();
  const merged = imported.map((player) => {
    const existing = existingByExternalId.get(player.externalId!) ?? existingByName.get(normalizedName(player.name));
    if (!existing) return player;
    matchedIds.add(existing.id);
    const sameTeam = existing.teamId === player.teamId;
    const lineupRole = sameTeam ? (existing.lineupRole ?? (existing.starter ? "starter" : "bench")) : "out";
    return {
      ...player,
      id: existing.id,
      position: existing.position,
      rating: existing.rating,
      order: existing.order,
      lineupOrder: existing.lineupOrder,
      lineupRole,
      starter: lineupRole === "starter",
    };
  });
  const manualPlayers = state.players.filter((player) => !matchedIds.has(player.id) && !player.externalId);
  return {
    ...state,
    categoryGroups: (state.categoryGroups ?? []).map((group) => ({ "התקפה": "Offense", "הגנה": "Defense", "כללי": "General" })[group] ?? group),
    categories: state.categories.map((category) => ({ ...category, group: ({ "התקפה": "Offense", "הגנה": "Defense", "כללי": "General" })[category.group] ?? category.group })),
    players: [...merged, ...manualPlayers],
    rosterVersion: ROSTER_VERSION,
    rosterUpdatedAt: ROSTER_UPDATED_AT,
    rosterSource: "Basketball Reference",
  };
}

const teamSeed: Array<[string, string, Conference]> = [
  ["Atlanta Hawks", "ATL", "East"],
  ["Boston Celtics", "BOS", "East"],
  ["Brooklyn Nets", "BKN", "East"],
  ["Charlotte Hornets", "CHA", "East"],
  ["Chicago Bulls", "CHI", "East"],
  ["Cleveland Cavaliers", "CLE", "East"],
  ["Detroit Pistons", "DET", "East"],
  ["Indiana Pacers", "IND", "East"],
  ["Miami Heat", "MIA", "East"],
  ["Milwaukee Bucks", "MIL", "East"],
  ["New York Knicks", "NYK", "East"],
  ["Orlando Magic", "ORL", "East"],
  ["Philadelphia 76ers", "PHI", "East"],
  ["Toronto Raptors", "TOR", "East"],
  ["Washington Wizards", "WAS", "East"],
  ["Dallas Mavericks", "DAL", "West"],
  ["Denver Nuggets", "DEN", "West"],
  ["Golden State Warriors", "GSW", "West"],
  ["Houston Rockets", "HOU", "West"],
  ["LA Clippers", "LAC", "West"],
  ["Los Angeles Lakers", "LAL", "West"],
  ["Memphis Grizzlies", "MEM", "West"],
  ["Minnesota Timberwolves", "MIN", "West"],
  ["New Orleans Pelicans", "NOP", "West"],
  ["Oklahoma City Thunder", "OKC", "West"],
  ["Phoenix Suns", "PHX", "West"],
  ["Portland Trail Blazers", "POR", "West"],
  ["Sacramento Kings", "SAC", "West"],
  ["San Antonio Spurs", "SAS", "West"],
  ["Utah Jazz", "UTA", "West"],
];

const categorySeed: Array<[string, Category["group"]]> = [
  ["Scoring", "Offense"],
  ["Shooting", "Offense"],
  ["Shot creation", "Offense"],
  ["Passing", "Offense"],
  ["Size", "Defense"],
  ["Rebounding", "Defense"],
  ["Shot blocking", "Defense"],
  ["Interior defense", "Defense"],
  ["POA defense", "Defense"],
  ["Health", "General"],
  ["Chemistry", "General"],
  ["Depth", "General"],
  ["Contracts", "General"],
  ["Young assets", "General"],
];

export const GRADES: Grade[] = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];
export const AWARDS = ["MVP", "DPOY", "ROY", "Sixth Man", "MIP", "Coach of the Year"];

export function createInitialState(): AppState {
  const categories: Category[] = categorySeed.map(([name, group], index) => ({
    id: `category-${index + 1}`,
    name,
    group,
    weight: 3,
  }));
  const teams: Team[] = teamSeed.map(([name, abbr, conference]) => ({
    id: abbr.toLowerCase(),
    name,
    abbr,
    conference,
    wins: 41,
    notes: "",
    grades: Object.fromEntries(categories.map((category) => [category.id, "B"])) as Record<string, Grade>,
  }));
  return {
    season: "2026/27",
    teams,
    players: createImportedPlayers(),
    categories,
    categoryGroups: ["Offense", "Defense", "General"],
    conferenceOrder: {
      East: teams.filter((team) => team.conference === "East").map((team) => team.id),
      West: teams.filter((team) => team.conference === "West").map((team) => team.id),
    },
    standingsMode: "manual",
    playoffPicks: {},
    awards: Object.fromEntries(AWARDS.map((award) => [award, ["", "", ""]])),
    honors: {
      "All-NBA First": Array(5).fill(""),
      "All-NBA Second": Array(5).fill(""),
      "All-NBA Third": Array(5).fill(""),
      "All-Defense First": Array(5).fill(""),
      "All-Defense Second": Array(5).fill(""),
      "All-Rookie First": Array(5).fill(""),
      "All-Rookie Second": Array(5).fill(""),
    },
    rosterVersion: ROSTER_VERSION,
    rosterUpdatedAt: ROSTER_UPDATED_AT,
    rosterSource: "Basketball Reference",
  };
}

export const gradeValue: Record<Grade, number> = {
  "A+": 100, A: 96, "A-": 92,
  "B+": 88, B: 84, "B-": 80,
  "C+": 76, C: 72, "C-": 68,
  "D+": 64, D: 60, "D-": 56, F: 45,
};

export type TeamTheme = { primary: string; secondary: string; logoId: string };

export const TEAM_THEMES: Record<string, TeamTheme> = {
  ATL: { primary: "#E03A3E", secondary: "#C1D32F", logoId: "1610612737" },
  BOS: { primary: "#007A33", secondary: "#BA9653", logoId: "1610612738" },
  BKN: { primary: "#151515", secondary: "#707070", logoId: "1610612751" },
  CHA: { primary: "#1D1160", secondary: "#00788C", logoId: "1610612766" },
  CHI: { primary: "#CE1141", secondary: "#111111", logoId: "1610612741" },
  CLE: { primary: "#860038", secondary: "#FDBB30", logoId: "1610612739" },
  DET: { primary: "#C8102E", secondary: "#1D42BA", logoId: "1610612765" },
  IND: { primary: "#002D62", secondary: "#FDBB30", logoId: "1610612754" },
  MIA: { primary: "#98002E", secondary: "#F9A01B", logoId: "1610612748" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6", logoId: "1610612749" },
  NYK: { primary: "#006BB6", secondary: "#F58426", logoId: "1610612752" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4", logoId: "1610612753" },
  PHI: { primary: "#006BB6", secondary: "#ED174C", logoId: "1610612755" },
  TOR: { primary: "#CE1141", secondary: "#111111", logoId: "1610612761" },
  WAS: { primary: "#002B5C", secondary: "#E31837", logoId: "1610612764" },
  DAL: { primary: "#00538C", secondary: "#B8C4CA", logoId: "1610612742" },
  DEN: { primary: "#0E2240", secondary: "#FEC524", logoId: "1610612743" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C", logoId: "1610612744" },
  HOU: { primary: "#CE1141", secondary: "#111111", logoId: "1610612745" },
  LAC: { primary: "#1D428A", secondary: "#C8102E", logoId: "1610612746" },
  LAL: { primary: "#552583", secondary: "#FDB927", logoId: "1610612747" },
  MEM: { primary: "#5D76A9", secondary: "#12173F", logoId: "1610612763" },
  MIN: { primary: "#0C2340", secondary: "#78BE20", logoId: "1610612750" },
  NOP: { primary: "#0C2340", secondary: "#C8102E", logoId: "1610612740" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24", logoId: "1610612760" },
  PHX: { primary: "#1D1160", secondary: "#E56020", logoId: "1610612756" },
  POR: { primary: "#E03A3E", secondary: "#111111", logoId: "1610612757" },
  SAC: { primary: "#5A2D81", secondary: "#63727A", logoId: "1610612758" },
  SAS: { primary: "#111111", secondary: "#C4CED4", logoId: "1610612759" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B", logoId: "1610612762" },
};

export function teamLogoUrl(abbr: string) {
  const logoId = TEAM_THEMES[abbr]?.logoId;
  return logoId ? `https://cdn.nba.com/logos/nba/${logoId}/global/L/logo.svg` : "";
}

export function numericToGrade(value: number): Grade {
  if (value >= 98) return "A+";
  if (value >= 94) return "A";
  if (value >= 90) return "A-";
  if (value >= 87) return "B+";
  if (value >= 83) return "B";
  if (value >= 80) return "B-";
  if (value >= 77) return "C+";
  if (value >= 73) return "C";
  if (value >= 70) return "C-";
  if (value >= 67) return "D+";
  if (value >= 63) return "D";
  if (value >= 60) return "D-";
  return "F";
}

export function teamOverall(team: Team, categories: Category[]) {
  const totalWeight = categories.reduce((sum, category) => sum + Math.max(0, category.weight), 0) || 1;
  const value = categories.reduce(
    (sum, category) => sum + gradeValue[team.grades[category.id] ?? "B"] * Math.max(0, category.weight),
    0,
  ) / totalWeight;
  return { value: Math.round(value * 10) / 10, grade: numericToGrade(value) };
}

export function sortedConference(state: AppState, conference: Conference) {
  const order = state.conferenceOrder[conference];
  return state.teams
    .filter((team) => team.conference === conference)
    .sort((a, b) => b.wins - a.wins || order.indexOf(a.id) - order.indexOf(b.id));
}
