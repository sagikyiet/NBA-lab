"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Database,
  GitCompareArrows,
  GripVertical,
  Medal,
  Plus,
  Save,
  Shield,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import EnhancedTeamReview from "@/components/team-review";
import EnhancedStandings from "@/components/standings";
import { useGrabReorder } from "@/hooks/use-grab-reorder";
import {
  AppState,
  AWARDS,
  Category,
  Conference,
  createInitialState,
  Grade,
  GRADES,
  LineupRole,
  mergeImportedRoster,
  Player,
  Position,
  POSITIONS,
  sortedConference,
  TEAM_THEMES,
  teamLogoUrl,
  teamOverall,
} from "@/lib/nba-data";

const nav = [
  ["teams", "Teams", Shield],
  ["standings", "Standings", BarChart3],
  ["playoffs", "Playoffs", Trophy],
  ["players", "Players", Users],
  ["compare", "Compare", GitCompareArrows],
  ["awards", "Awards", Medal],
] as const;

const PLAYER_RATING_MIN = 65;
const PLAYER_RATING_MAX = 99;

function clampPlayerRating(rating: number) {
  return Math.max(PLAYER_RATING_MIN, Math.min(PLAYER_RATING_MAX, rating));
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function NbaApp() {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"loading" | "saved" | "saving" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch(`/api/state?season=${encodeURIComponent("2026/27")}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<{ state: AppState | null }>;
      })
      .then((payload) => {
        if (!active) return;
        if (payload.state) {
          const loaded = mergeImportedRoster(payload.state);
          const categoryGroups = loaded.categoryGroups?.length
            ? loaded.categoryGroups
            : Array.from(new Set(loaded.categories.map((category) => category.group)));
          const allLegacyWeights = loaded.categories.length > 0 && loaded.categories.every((category) => category.weight === 1);
          const conferenceOrder = loaded.standingsMode
            ? loaded.conferenceOrder
            : ({
                East: loaded.teams.filter((team) => team.conference === "East").sort((a, b) => b.wins - a.wins || loaded.conferenceOrder.East.indexOf(a.id) - loaded.conferenceOrder.East.indexOf(b.id)).map((team) => team.id),
                West: loaded.teams.filter((team) => team.conference === "West").sort((a, b) => b.wins - a.wins || loaded.conferenceOrder.West.indexOf(a.id) - loaded.conferenceOrder.West.indexOf(b.id)).map((team) => team.id),
              } as AppState["conferenceOrder"]);
          setState({
            ...loaded,
            categoryGroups,
            conferenceOrder,
            standingsMode: "manual",
            players: loaded.players.map((player) => ({ ...player, rating: clampPlayerRating(player.rating) })),
            categories: loaded.categories.map((category) => ({
              ...category,
              weight: allLegacyWeights ? 3 : Math.max(1, Math.min(5, category.weight)),
            })),
          });
        }
        setReady(true);
        setSaveState("saved");
      })
      .catch(() => {
        if (!active) return;
        setReady(true);
        setSaveState("error");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ season: state.season, state }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("save");
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, ready]);

  return (
    <main className="min-h-screen pb-10">
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111b2f]/90 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-500 font-black text-slate-950">26</span>
              <div>
                <h1 className="truncate text-lg font-black tracking-tight text-foreground sm:text-2xl">NBA Lab</h1>
                <p className="text-xs text-slate-400">Season {state.season}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {state.rosterUpdatedAt && <Badge variant="outline" className="hidden gap-1.5 border-white/10 text-slate-600 md:flex"><Database className="size-3.5 text-teal-600" /> {state.players.length} players · {new Date(state.rosterUpdatedAt).toLocaleDateString("en-US")}</Badge>}
            <Save className={`size-4 ${saveState === "saving" ? "animate-pulse text-orange-400" : saveState === "error" ? "text-rose-400" : "text-emerald-400"}`} />
            <span className="hidden text-slate-300 sm:inline">
              {saveState === "loading" ? "Loading…" : saveState === "saving" ? "Saving…" : saveState === "error" ? "Save unavailable" : "Saved"}
            </span>
          </div>
        </header>

        <Tabs defaultValue="teams" dir="ltr">
          <TabsList variant="line" className="scrollbar-none sticky top-2 z-40 mb-5 flex w-full justify-start overflow-x-auto rounded-2xl border border-white/10 bg-[#0c1528]/95 p-2 shadow-xl shadow-black/10 backdrop-blur">
            {nav.map(([value, label, Icon]) => (
              <TabsTrigger key={value} value={value} className="min-w-[104px] py-3 data-[state=active]:text-orange-700 sm:min-w-32">
                <Icon className="size-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="teams"><EnhancedTeamReview state={state} setState={setState} /></TabsContent>
          <TabsContent value="standings"><EnhancedStandings state={state} setState={setState} /></TabsContent>
          <TabsContent value="playoffs"><Playoffs state={state} setState={setState} /></TabsContent>
          <TabsContent value="players"><PlayerRankings state={state} setState={setState} /></TabsContent>
          <TabsContent value="compare"><TeamCompare state={state} /></TabsContent>
          <TabsContent value="awards"><Awards state={state} setState={setState} /></TabsContent>

        </Tabs>
      </div>
    </main>
  );
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-black text-foreground sm:text-3xl">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function TeamReview({ state, setState }: { state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const [selectedId, setSelectedId] = useState("bos");
  const [newCategory, setNewCategory] = useState("");
  const selected = state.teams.find((team) => team.id === selectedId) ?? state.teams[0];
  const overall = teamOverall(selected, state.categories);
  const teamPlayers = state.players.filter((player) => player.teamId === selected.id).sort((a, b) => Number(b.starter) - Number(a.starter) || a.order - b.order);

  const updateTeam = (patch: Partial<typeof selected>) => setState((current) => ({
    ...current,
    teams: current.teams.map((team) => team.id === selected.id ? { ...team, ...patch } : team),
  }));

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    const category: Category = { id: uid("category"), name, group: "כללי", weight: 1 };
    setState((current) => ({
      ...current,
      categories: [...current.categories, category],
      teams: current.teams.map((team) => ({ ...team, grades: { ...team.grades, [category.id]: "B" } })),
    }));
    setNewCategory("");
  };

  const removeCategory = (categoryId: string) => setState((current) => ({
    ...current,
    categories: current.categories.filter((category) => category.id !== categoryId),
  }));

  return (
    <div>
      <SectionTitle title="סקירת קבוצות" detail="ציוני אות גמישים, משקלים והערות לכל אחת מ־30 הקבוצות." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <NativeSelect value={selected.id} onChange={(event) => setSelectedId(event.target.value)} className="w-full min-w-64 bg-[#111b2f] sm:w-auto">
          {state.teams.map((team) => <NativeSelectOption key={team.id} value={team.id}>{team.name}</NativeSelectOption>)}
        </NativeSelect>
        <div className="flex items-center gap-3 rounded-xl border border-orange-400/30 bg-orange-400/10 px-4 py-2">
          <span className="text-sm text-slate-300">ציון עתיד</span>
          <strong className="text-2xl text-orange-400">{overall.grade}</strong>
          <span className="text-sm tabular-nums text-slate-400">{overall.value}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {(["התקפה", "הגנה", "כללי"] as const).map((group) => (
            <Card key={group} className="border-white/10 bg-[#111b2f] text-white">
              <CardHeader className="pb-2"><CardTitle className="text-lg">{group}</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {state.categories.filter((category) => category.group === group).map((category) => (
                  <div key={category.id} className="rounded-xl border border-white/10 bg-[#0b1426] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Input
                        value={category.name}
                        onChange={(event) => setState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item) }))}
                        className="h-8 border-0 bg-transparent px-0 font-semibold"
                        aria-label="שם קטגוריה"
                      />
                      <Button variant="ghost" size="icon-sm" onClick={() => removeCategory(category.id)} aria-label="מחיקת קטגוריה"><Trash2 className="size-4 text-slate-500" /></Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1">
                        <Label className="mb-1 text-xs text-slate-500">ציון</Label>
                        <NativeSelect value={selected.grades[category.id] ?? "B"} onChange={(event) => updateTeam({ grades: { ...selected.grades, [category.id]: event.target.value as Grade } })} className="w-full bg-[#111b2f] font-bold text-orange-300">
                          {GRADES.map((grade) => <NativeSelectOption key={grade} value={grade}>{grade}</NativeSelectOption>)}
                        </NativeSelect>
                      </div>
                      <div className="min-w-24 flex-1">
                        <Label className="mb-1 text-xs text-slate-500">קבוצה</Label>
                        <NativeSelect value={category.group} onChange={(event) => setState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, group: event.target.value as Category["group"] } : item) }))} className="w-full bg-[#111b2f]">
                          <NativeSelectOption value="התקפה">התקפה</NativeSelectOption>
                          <NativeSelectOption value="הגנה">הגנה</NativeSelectOption>
                          <NativeSelectOption value="כללי">כללי</NativeSelectOption>
                        </NativeSelect>
                      </div>
                      <div className="w-20">
                        <Label className="mb-1 text-xs text-slate-500">משקל</Label>
                        <Input type="number" min={0} step={0.25} value={category.weight} onChange={(event) => setState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, weight: Number(event.target.value) } : item) }))} className="tabular-nums" />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2">
            <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCategory()} placeholder="קטגוריה חדשה" className="max-w-sm bg-[#111b2f]" />
            <Button onClick={addCategory} className="bg-orange-500 text-slate-950 hover:bg-orange-400"><Plus className="size-4" /> הוסף</Button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-white/10 bg-[#111b2f] text-white">
            <CardHeader><CardTitle className="flex items-center justify-between"><span>{selected.abbr}</span><Badge variant="outline">{selected.conference}</Badge></CardTitle></CardHeader>
            <CardContent>
              <Label className="mb-2 text-slate-400">הערות וניתוח</Label>
              <Textarea value={selected.notes} onChange={(event) => updateTeam({ notes: event.target.value })} placeholder="מה התקרה של הקבוצה? מה עלול להשתבש?" className="min-h-48 bg-[#0b1426] leading-7" />
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-[#111b2f] text-white">
            <CardHeader><CardTitle className="text-lg">סגל · {teamPlayers.length}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {teamPlayers.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-500">הסגל ריק. הוסף שחקנים במסך שחקנים.</p>}
              {teamPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-lg bg-[#0b1426] px-3 py-2">
                  <span className="font-medium">{player.name}</span>
                  <div className="flex items-center gap-2"><Badge>{player.position}</Badge><span className="tabular-nums text-orange-300">{player.rating}</span></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Standings({ state, setState }: { state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const totalWins = state.teams.reduce((sum, team) => sum + team.wins, 0);
  const difference = 1230 - totalWins;

  const moveTie = (conference: Conference, teamId: string, direction: -1 | 1) => {
    const teams = sortedConference(state, conference);
    const index = teams.findIndex((team) => team.id === teamId);
    const target = teams[index + direction];
    if (!target || target.wins !== teams[index].wins) return;
    setState((current) => {
      const order = [...current.conferenceOrder[conference]];
      const a = order.indexOf(teamId);
      const b = order.indexOf(target.id);
      [order[a], order[b]] = [order[b], order[a]];
      return { ...current, conferenceOrder: { ...current.conferenceOrder, [conference]: order } };
    });
  };

  return (
    <div>
      <SectionTitle title="תחזית העונה הסדירה" detail="הזן ניצחונות. ההפסדים, הדירוג והזריעה לפלייאוף יחושבו עבורך." />
      <div className={`mb-5 rounded-2xl border p-4 ${difference === 0 ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className={difference === 0 ? "text-emerald-300" : "text-amber-300"}>{difference === 0 ? "המאזנים מאוזנים" : `נדרשת התאמה של ${Math.abs(difference)} ניצחונות ${difference > 0 ? "כלפי מעלה" : "כלפי מטה"}`}</strong>
          <span className="tabular-nums text-sm text-slate-300">{totalWins.toLocaleString()} / 1,230 ניצחונות</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, totalWins / 12.3)}%` }} /></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(["East", "West"] as Conference[]).map((conference) => (
          <Card key={conference} className="overflow-hidden border-white/10 bg-[#111b2f] text-white">
            <CardHeader><CardTitle>{conference === "East" ? "מזרח" : "מערב"}</CardTitle></CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="grid grid-cols-[36px_1fr_64px_52px_64px] items-center gap-2 px-2 pb-2 text-xs text-slate-500">
                <span>#</span><span>קבוצה</span><span>ניצ׳</span><span>הפס׳</span><span>שוויון</span>
              </div>
              {sortedConference(state, conference).map((team, index, list) => {
                const tiedAbove = index > 0 && list[index - 1].wins === team.wins;
                const tiedBelow = index < list.length - 1 && list[index + 1].wins === team.wins;
                return (
                  <div key={team.id} className={`grid grid-cols-[36px_1fr_64px_52px_64px] items-center gap-2 rounded-xl px-2 py-2 ${index < 6 ? "bg-emerald-400/5" : index < 10 ? "bg-orange-400/5" : ""}`}>
                    <span className="font-bold text-slate-500">{index + 1}</span>
                    <div className="min-w-0"><strong className="block truncate">{team.name}</strong><span className="text-xs text-slate-500">{team.abbr}</span></div>
                    <Input type="number" min={0} max={82} value={team.wins} onChange={(event) => setState((current) => ({ ...current, teams: current.teams.map((item) => item.id === team.id ? { ...item, wins: Math.max(0, Math.min(82, Number(event.target.value))) } : item) }))} className="h-9 bg-[#0b1426] text-center font-bold tabular-nums" aria-label={`ניצחונות ${team.name}`} />
                    <span className="text-center tabular-nums text-slate-400">{82 - team.wins}</span>
                    <div className="flex">
                      <Button variant="ghost" size="icon-sm" disabled={!tiedAbove} onClick={() => moveTie(conference, team.id, -1)} aria-label="העלה בשוויון"><ArrowUp className="size-3" /></Button>
                      <Button variant="ghost" size="icon-sm" disabled={!tiedBelow} onClick={() => moveTie(conference, team.id, 1)} aria-label="הורד בשוויון"><ArrowDown className="size-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BracketMatch({ value, options, state, setState, pickKey, label, className = "" }: { value: string; options: string[]; state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void; pickKey: string; label: string; className?: string }) {
  const cleanOptions = options.filter(Boolean);
  const pick = (teamId: string) => setState((current) => ({ ...current, playoffPicks: { ...current.playoffPicks, [pickKey]: teamId } }));
  return (
    <div className={`relative rounded-lg border border-white/10 bg-[#0b1426] p-1.5 shadow-sm ${className}`} dir="ltr">
      <span className="mb-1 block px-0.5 text-xs font-bold leading-tight text-slate-500">{label}</span>
      <div className="space-y-1">
        {cleanOptions.length ? cleanOptions.map((id) => {
          const team = state.teams.find((item) => item.id === id);
          const selected = value === id;
          return (
            <button key={id} onClick={() => pick(id)} className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition ${selected ? "border-orange-400/60 bg-orange-100 text-orange-900" : "border-transparent bg-white/55 text-slate-700 hover:bg-white/85"}`}>
              <img src={team ? teamLogoUrl(team.abbr) : ""} alt="" className="size-6 shrink-0 object-contain" />
              <strong className="min-w-0 flex-1 truncate text-xs tracking-wide" title={team?.name}>{team?.abbr ?? id.toUpperCase()}</strong>
              {selected && <span className="size-2 shrink-0 rounded-full bg-orange-400" />}
            </button>
          );
        }) : <div className="grid h-[70px] place-items-center rounded-lg border border-dashed border-white/10 text-xs text-slate-500">Pending previous round</div>}
      </div>
    </div>
  );
}

function ConferenceBracket({ conference, state, setState }: { conference: Conference; state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const seeds = sortedConference(state, conference);
  const key = conference.toLowerCase();
  const playIn78 = seeds.slice(6, 8).map((team) => team.id);
  const playIn910 = seeds.slice(8, 10).map((team) => team.id);
  const seed7 = state.playoffPicks[`${key}-pi78`];
  const winner910 = state.playoffPicks[`${key}-pi910`];
  const loser78 = playIn78.find((id) => id !== seed7) ?? "";
  const seed8 = state.playoffPicks[`${key}-seed8`];
  const r1 = [
    [seeds[0]?.id, seed8],
    [seeds[3]?.id, seeds[4]?.id],
    [seeds[2]?.id, seeds[5]?.id],
    [seeds[1]?.id, seed7],
  ];
  const r1Winners = r1.map((_, index) => state.playoffPicks[`${key}-r1-${index}`]);
  const r2 = [[r1Winners[0], r1Winners[1]], [r1Winners[2], r1Winners[3]]];
  const r2Winners = r2.map((_, index) => state.playoffPicks[`${key}-r2-${index}`]);
  const champion = state.playoffPicks[`${key}-final`];

  return (
    <Card className={`overflow-hidden border-white/10 bg-[#111b2f] text-white ${conference === "East" ? "shadow-cyan-950/30" : "shadow-orange-950/30"}`}>
      <CardHeader className={`border-b border-white/10 ${conference === "East" ? "bg-cyan-500/10" : "bg-orange-500/10"}`}><CardTitle className="flex items-center justify-between"><span>{conference === "East" ? "המזרח" : "המערב"}</span><Badge className={conference === "East" ? "bg-cyan-400/15 text-cyan-200" : "bg-orange-400/15 text-orange-200"}>Conference bracket</Badge></CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-white/10 bg-black/10 p-3 sm:p-4">
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">Play-In</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <BracketMatch label="7–8 · המנצחת מקום 7" value={seed7 ?? ""} options={playIn78} state={state} setState={setState} pickKey={`${key}-pi78`} />
            <BracketMatch label="9–10 · המנצחת ממשיכה" value={winner910 ?? ""} options={playIn910} state={state} setState={setState} pickKey={`${key}-pi910`} />
            <BracketMatch label="הכרעה על מקום 8" value={seed8 ?? ""} options={[loser78, winner910]} state={state} setState={setState} pickKey={`${key}-seed8`} />
          </div>
        </div>

        <div className="scrollbar-thin overflow-x-auto p-4 sm:p-5">
          <div className="grid min-w-[760px] grid-cols-[1.25fr_1fr_.9fr] gap-12" dir="ltr">
            <BracketRound title="סיבוב ראשון" className="space-y-3">
              {r1.map((options, index) => <BracketMatch key={index} label={["1 מול 8", "4 מול 5", "3 מול 6", "2 מול 7"][index]} value={state.playoffPicks[`${key}-r1-${index}`] ?? ""} options={options as string[]} state={state} setState={setState} pickKey={`${key}-r1-${index}`} className="after:absolute after:left-full after:top-1/2 after:h-px after:w-6 after:bg-white/20" />)}
            </BracketRound>
            <BracketRound title="חצי גמר אזורי" className="flex flex-col justify-around gap-24 py-10">
              {r2.map((options, index) => <BracketMatch key={index} label={`חצי גמר ${index + 1}`} value={state.playoffPicks[`${key}-r2-${index}`] ?? ""} options={options as string[]} state={state} setState={setState} pickKey={`${key}-r2-${index}`} className="before:absolute before:-right-6 before:top-1/2 before:h-px before:w-6 before:bg-white/20 after:absolute after:left-full after:top-1/2 after:h-px after:w-6 after:bg-white/20" />)}
            </BracketRound>
            <BracketRound title="גמר אזורי" className="flex items-center">
              <BracketMatch label="אלופת האזור" value={champion ?? ""} options={r2Winners} state={state} setState={setState} pickKey={`${key}-final`} className="w-full before:absolute before:-right-6 before:top-1/2 before:h-px before:w-6 before:bg-white/20" />
            </BracketRound>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BracketRound({ title, children, className }: { title: string; children: ReactNode; className: string }) {
  return <div className="flex min-w-0 flex-col"><p className="mb-3 text-center text-xs font-black uppercase tracking-wider text-orange-700" dir="ltr">{title}</p><div className={`min-h-[460px] ${className}`}>{children}</div></div>;
}

function LegacyPlayoffs({ state, setState }: { state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const east = state.playoffPicks["east-final"];
  const west = state.playoffPicks["west-final"];
  const champion = state.playoffPicks["nba-final"];
  return (
    <div>
      <SectionTitle title="בראקט הפלייאוף" detail="הזריעה מגיעה מהתחזית שלך; כל עולה וכל סדרה מוכרעות ידנית." />
      <div className="space-y-4">
        <ConferenceBracket conference="East" state={state} setState={setState} />
        <ConferenceBracket conference="West" state={state} setState={setState} />
      </div>
      <Card className="mx-auto mt-4 max-w-2xl border-orange-400/30 bg-gradient-to-l from-orange-500/15 to-[#111b2f] text-white">
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="text-orange-400" /> NBA Finals</CardTitle></CardHeader>
        <CardContent><BracketMatch label="בחר אלופה" value={champion ?? ""} options={[east, west]} state={state} setState={setState} pickKey="nba-final" /></CardContent>
      </Card>
    </div>
  );
}

function playoffData(conference: Conference, state: AppState) {
  const seeds = sortedConference(state, conference);
  const key = conference.toLowerCase();
  const playIn78 = seeds.slice(6, 8).map((team) => team.id);
  const playIn910 = seeds.slice(8, 10).map((team) => team.id);
  const seed7 = state.playoffPicks[`${key}-pi78`] ?? "";
  const winner910 = state.playoffPicks[`${key}-pi910`] ?? "";
  const loser78 = playIn78.find((id) => id !== seed7) ?? "";
  const seed8 = state.playoffPicks[`${key}-seed8`] ?? "";
  const r1 = [[seeds[0]?.id, seed8], [seeds[3]?.id, seeds[4]?.id], [seeds[2]?.id, seeds[5]?.id], [seeds[1]?.id, seed7]];
  const r1Winners = r1.map((_, index) => state.playoffPicks[`${key}-r1-${index}`] ?? "");
  const r2 = [[r1Winners[0], r1Winners[1]], [r1Winners[2], r1Winners[3]]];
  const r2Winners = r2.map((_, index) => state.playoffPicks[`${key}-r2-${index}`] ?? "");
  return { key, playIn78, playIn910, seed7, winner910, loser78, seed8, r1, r2, r2Winners, champion: state.playoffPicks[`${key}-final`] ?? "" };
}

function PlayInPanel({ conference, state, setState }: { conference: Conference; state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const data = playoffData(conference, state);
  const east = conference === "East";
  return <Card className={`h-full overflow-hidden border-white/10 bg-[#111b2f] text-foreground ${east ? "shadow-cyan-950/10" : "shadow-orange-950/10"}`}>
    <CardHeader className={`border-b border-white/10 py-3 ${east ? "bg-cyan-500/10" : "bg-orange-500/10"}`}><CardTitle className="flex items-center justify-between text-base"><span>{east ? "Eastern" : "Western"} Play-In</span><Badge className={east ? "bg-cyan-400/15 text-cyan-700" : "bg-orange-400/15 text-orange-700"}>{east ? "EAST" : "WEST"}</Badge></CardTitle></CardHeader>
    <CardContent className="grid gap-2 p-2 xl:grid-cols-3 xl:p-3">
      <BracketMatch label="7 vs. 8 · Winner is #7" value={data.seed7} options={data.playIn78} state={state} setState={setState} pickKey={`${data.key}-pi78`} />
      <BracketMatch label="9 vs. 10 · Winner advances" value={data.winner910} options={data.playIn910} state={state} setState={setState} pickKey={`${data.key}-pi910`} />
      <BracketMatch label="Decider · Winner is #8" value={data.seed8} options={[data.loser78, data.winner910]} state={state} setState={setState} pickKey={`${data.key}-seed8`} />
    </CardContent>
  </Card>;
}

function Playoffs({ state, setState }: { state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const bracketScrollRef = useRef<HTMLDivElement>(null);
  const east = playoffData("East", state);
  const west = playoffData("West", state);
  const champion = state.playoffPicks["nba-final"] ?? "";
  const championTeam = state.teams.find((team) => team.id === champion);
  const firstRoundLabels = ["1 vs. 8", "4 vs. 5", "3 vs. 6", "2 vs. 7"];
  useEffect(() => {
    const viewport = bracketScrollRef.current;
    if (!viewport) return;
    const alignToEast = () => window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    });
    const observer = new ResizeObserver(alignToEast);
    observer.observe(viewport);
    alignToEast();
    return () => observer.disconnect();
  }, []);
  return <div>
    <SectionTitle title="Playoff Bracket" detail="Both play-in tournaments lead into one bracket, with East and West converging on the NBA champion." />
    <div className="mb-4 grid grid-cols-2 items-stretch gap-2 sm:gap-3">
      <PlayInPanel conference="West" state={state} setState={setState} />
      <PlayInPanel conference="East" state={state} setState={setState} />
    </div>
    <Card className="overflow-hidden border-white/10 bg-[#111b2f] text-foreground">
      <CardHeader className="border-b border-white/10 bg-gradient-to-l from-cyan-500/10 via-orange-400/10 to-orange-500/10 py-3"><CardTitle className="flex items-center justify-center gap-2 text-lg"><Trophy className="size-5 text-orange-400" />NBA Playoffs</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div ref={bracketScrollRef} className="scrollbar-thin overflow-x-auto p-3" dir="ltr">
          <div className="grid min-w-[1220px] grid-cols-[180px_155px_140px_180px_140px_155px_180px] gap-4" dir="ltr">
            <BracketRound title="West · First Round" className="space-y-3">{west.r1.map((options, index) => <BracketMatch key={index} label={firstRoundLabels[index]} value={state.playoffPicks[`${west.key}-r1-${index}`] ?? ""} options={options} state={state} setState={setState} pickKey={`${west.key}-r1-${index}`} />)}</BracketRound>
            <BracketRound title="West Semifinals" className="flex flex-col justify-around gap-24 py-10">{west.r2.map((options, index) => <BracketMatch key={index} label={`Semifinal ${index + 1}`} value={state.playoffPicks[`${west.key}-r2-${index}`] ?? ""} options={options} state={state} setState={setState} pickKey={`${west.key}-r2-${index}`} />)}</BracketRound>
            <BracketRound title="West Finals" className="flex items-center"><BracketMatch label="West Champion" value={west.champion} options={west.r2Winners} state={state} setState={setState} pickKey="west-final" className="w-full" /></BracketRound>
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-orange-400/25 bg-gradient-to-b from-orange-400/15 via-[#0b1426] to-orange-400/10 p-3" dir="ltr">
              <Trophy className="mb-3 size-10 text-orange-600" /><p className="mb-3 text-sm font-black uppercase tracking-widest text-orange-700">NBA Finals</p>
              <BracketMatch label="Pick the champion" value={champion} options={[west.champion, east.champion]} state={state} setState={setState} pickKey="nba-final" className="w-full" />
              {championTeam && <div className="mt-5 text-center"><img src={teamLogoUrl(championTeam.abbr)} alt="" className="mx-auto size-20 object-contain drop-shadow-2xl" /><strong className="mt-2 block text-lg">{championTeam.name}</strong><span className="text-xs text-orange-700">Your projected champion</span></div>}
            </div>
            <BracketRound title="East Finals" className="flex items-center"><BracketMatch label="East Champion" value={east.champion} options={east.r2Winners} state={state} setState={setState} pickKey="east-final" className="w-full" /></BracketRound>
            <BracketRound title="East Semifinals" className="flex flex-col justify-around gap-24 py-10">{east.r2.map((options, index) => <BracketMatch key={index} label={`Semifinal ${index + 1}`} value={state.playoffPicks[`${east.key}-r2-${index}`] ?? ""} options={options} state={state} setState={setState} pickKey={`${east.key}-r2-${index}`} />)}</BracketRound>
            <BracketRound title="East · First Round" className="space-y-3">{east.r1.map((options, index) => <BracketMatch key={index} label={firstRoundLabels[index]} value={state.playoffPicks[`${east.key}-r1-${index}`] ?? ""} options={options} state={state} setState={setState} pickKey={`${east.key}-r1-${index}`} />)}</BracketRound>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>;
}

function PlayerRankings({ state, setState }: { state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const [positions, setPositions] = useState<Position[]>(["PG"]);
  const [roles, setRoles] = useState<LineupRole[]>(["starter", "bench", "out"]);
  const [conference, setConference] = useState<Conference | "All">("All");
  const [minimumRating, setMinimumRating] = useState(PLAYER_RATING_MIN);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 43]);
  const [rankingSnapshot, setRankingSnapshot] = useState(() => new Map(state.players.map((player) => [player.id, player.rating])));
  const playersRef = useRef(state.players);
  const filterSignature = `${positions.join(",")}|${roles.join(",")}|${conference}|${minimumRating}|${ageRange.join("-")}`;
  useEffect(() => {
    playersRef.current = state.players;
  }, [state.players]);
  useEffect(() => {
    setRankingSnapshot(new Map(playersRef.current.map((player) => [player.id, player.rating])));
  }, [filterSignature, state.rankingRevision]);
  const teamById = useMemo(() => new Map(state.teams.map((team) => [team.id, team])), [state.teams]);
  const playerRole = (player: Player): LineupRole => player.lineupRole ?? (player.starter ? "starter" : "out");
  const displayedRating = (player: Player) => rankingSnapshot.get(player.id) ?? player.rating;
  const playerAge = (birthDate?: string) => {
    if (!birthDate) return null;
    const born = new Date(birthDate);
    if (Number.isNaN(born.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - born.getFullYear();
    if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) years--;
    return years;
  };
  const players = state.players
    .filter((player) => positions.includes(player.position))
    .filter((player) => roles.includes(playerRole(player)))
    .filter((player) => displayedRating(player) >= minimumRating)
    .filter((player) => {
      const years = playerAge(player.birthDate);
      return years === null ? ageRange[0] === 18 && ageRange[1] === 43 : years >= ageRange[0] && years <= ageRange[1];
    })
    .filter((player) => conference === "All" || teamById.get(player.teamId)?.conference === conference)
    .sort((a, b) => displayedRating(b) - displayedRating(a) || (a.rankingOrder ?? a.order) - (b.rankingOrder ?? b.order) || a.name.localeCompare(b.name));
  const ratingCounts = new Map<number, number>();
  players.forEach((player) => {
    const rating = displayedRating(player);
    ratingCounts.set(rating, (ratingCounts.get(rating) ?? 0) + 1);
  });
  const updatePlayer = (id: string, patch: Partial<Player>) => setState((current) => ({
    ...current,
    players: current.players.map((player) => player.id === id ? { ...player, ...patch } : player),
  }));

  const moveTo = (id: string, targetId: string) => setState((current) => {
    const source = current.players.find((player) => player.id === id);
    const target = current.players.find((player) => player.id === targetId);
    if (!source || !target || displayedRating(source) !== displayedRating(target)) return current;
    const tiedRating = displayedRating(source);
    const ranked = current.players
      .filter((player) => displayedRating(player) === tiedRating)
      .sort((a, b) => (a.rankingOrder ?? a.order) - (b.rankingOrder ?? b.order) || a.name.localeCompare(b.name));
    const from = ranked.findIndex((player) => player.id === id);
    const to = ranked.findIndex((player) => player.id === targetId);
    if (from < 0 || to < 0 || from === to) return current;
    const [moved] = ranked.splice(from, 1);
    const targetIndex = ranked.findIndex((player) => player.id === targetId);
    ranked.splice(from < to ? targetIndex + 1 : targetIndex, 0, moved);
    const orders = new Map(ranked.map((player, index) => [player.id, index]));
    return { ...current, players: current.players.map((player) => orders.has(player.id) ? { ...player, rankingOrder: orders.get(player.id)! } : player) };
  });
  const playerGrab = useGrabReorder(moveTo);
  const togglePosition = (position: Position) => setPositions((current) => current.includes(position) ? (current.length === 1 ? current : current.filter((item) => item !== position)) : [...current, position]);
  const toggleRole = (role: LineupRole) => setRoles((current) => current.includes(role) ? (current.length === 1 ? current : current.filter((item) => item !== role)) : [...current, role]);
  const age = (birthDate?: string) => playerAge(birthDate) ?? "—";
  const pct = (value?: number) => value ? `${(value * 100).toFixed(1)}%` : "—";

  return (
    <div>
      <SectionTitle title="Player Rankings" detail="Ratings update instantly. Ranking refreshes when filters change, this tab reopens, or a roster is organized. Drag tied players to break a tie in any view." />
      <Card className="mb-4 border-white/10 bg-[#111b2f] text-foreground shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-orange-600" /><strong className="text-sm">Filters</strong><Badge variant="outline" className="ml-auto">{players.length} players</Badge></div>
          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr_.8fr_1.1fr_1.1fr]">
            <div><Label className="mb-2 block text-xs font-bold text-slate-600">Position</Label><div className="flex flex-wrap gap-1.5" dir="ltr"><Button size="sm" variant={positions.length === POSITIONS.length ? "default" : "outline"} onClick={() => setPositions([...POSITIONS])} className={positions.length === POSITIONS.length ? "bg-orange-600 text-white" : "bg-white/60"}>All</Button>{POSITIONS.map((item) => <Button key={item} size="sm" variant={positions.includes(item) ? "default" : "outline"} onClick={() => togglePosition(item)} className={positions.includes(item) ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-white/60"}>{item}</Button>)}</div></div>
            <div><Label className="mb-2 block text-xs font-bold text-slate-600">Rotation role</Label><div className="flex flex-wrap gap-1.5"><Button size="sm" variant={roles.length === 3 ? "default" : "outline"} onClick={() => setRoles(["starter", "bench", "out"])} className={roles.length === 3 ? "bg-teal-700 text-white" : "bg-white/60"}>All</Button>{([['starter', 'Starter'], ['bench', 'Bench'], ['out', 'Out']] as Array<[LineupRole, string]>).map(([value, label]) => <Button key={value} size="sm" variant={roles.includes(value) ? "default" : "outline"} onClick={() => toggleRole(value)} className={roles.includes(value) ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-white/60"}>{label}</Button>)}</div></div>
            <div><Label className="mb-2 block text-xs font-bold text-slate-600">Conference</Label><div className="grid grid-cols-3 gap-1.5">{(["All", "East", "West"] as const).map((value) => <Button key={value} size="sm" variant={conference === value ? "default" : "outline"} onClick={() => setConference(value)} className={conference === value ? "bg-sky-700 text-white hover:bg-sky-800" : "bg-white/60"}>{value}</Button>)}</div></div>
            <div><div className="mb-2 flex items-center justify-between"><Label className="text-xs font-bold text-slate-600">Minimum rating</Label><strong className="text-lg tabular-nums text-orange-700">{minimumRating}+</strong></div><Slider min={PLAYER_RATING_MIN} max={PLAYER_RATING_MAX} step={1} value={[minimumRating]} onValueChange={(value) => setMinimumRating(value[0])} aria-label="Minimum player rating" /><div className="mt-1 flex justify-between text-xs text-slate-500"><span>{PLAYER_RATING_MIN}</span><span>{PLAYER_RATING_MAX}</span></div></div>
            <div><div className="mb-2 flex items-center justify-between"><Label className="text-xs font-bold text-slate-600">Age range</Label><strong className="text-lg tabular-nums text-teal-700">{ageRange[0]}–{ageRange[1]}</strong></div><Slider min={18} max={43} step={1} minStepsBetweenThumbs={1} value={ageRange} onValueChange={(value) => setAgeRange([value[0], value[1]])} aria-label="Player age range" /><div className="mt-1 flex justify-between text-xs text-slate-500"><span>18</span><span>43</span></div></div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {players.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 bg-[#111b2f]/60 p-12 text-center text-slate-500">No players match these filters.</div>}
        {players.map((player, index) => {
          const team = state.teams.find((item) => item.id === player.teamId);
          const theme = team ? TEAM_THEMES[team.abbr] : undefined;
          const ratingHue = Math.round((player.rating - PLAYER_RATING_MIN) / (PLAYER_RATING_MAX - PLAYER_RATING_MIN) * 125);
          return (
            <div key={player.id} data-reorder-id={player.id} style={{ backgroundImage: `linear-gradient(120deg, ${theme?.primary ?? "#cf6842"}24, #fffaf4 52%, ${theme?.secondary ?? "#2e8b7f"}20)`, ...playerGrab.itemStyle(player.id) }} className={`rounded-2xl border p-3 shadow-sm transition ${playerGrab.activeId === player.id ? "border-orange-400 opacity-95 shadow-xl ring-2 ring-orange-300/30" : playerGrab.targetId === player.id ? "border-teal-500 ring-2 ring-teal-300/30" : "border-white/10"}`}>
              <div className="grid grid-cols-[36px_48px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[36px_48px_minmax(0,1fr)_auto]">
                <span className="grid size-9 place-items-center rounded-xl bg-white/70 text-base font-black text-orange-600 shadow-sm">{index + 1}</span>
                <div className="grid size-12 place-items-center rounded-xl bg-white/80 p-1 shadow-sm"><img src={team ? teamLogoUrl(team.abbr) : ""} alt="" className="size-full object-contain" /></div>
                <div className="min-w-0"><h3 className="truncate text-lg font-black leading-tight">{player.name}</h3><p className="mt-0.5 truncate text-xs text-slate-600">Age {age(player.birthDate)} · {player.height || "—"} · {player.weight ? `${player.weight} lb` : "—"}</p></div>
                <div className="col-span-3 mt-1 flex items-center justify-end gap-1.5 sm:col-span-1 sm:mt-0"><NativeSelect value={player.teamId} onChange={(event) => updatePlayer(player.id, { teamId: event.target.value })} className="h-9 w-24 bg-white/70">{state.teams.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.abbr}</NativeSelectOption>)}</NativeSelect><NativeSelect value={player.position} onChange={(event) => updatePlayer(player.id, { position: event.target.value as Position, order: state.players.filter((item) => item.position === event.target.value).length })} className="h-9 w-20 bg-white/70">{POSITIONS.map((item) => <NativeSelectOption key={item} value={item}>{item}</NativeSelectOption>)}</NativeSelect>{(ratingCounts.get(displayedRating(player)) ?? 0) > 1 && <button {...playerGrab.bind(player.id)} className="grid size-9 cursor-grab place-items-center rounded-lg bg-white/70 text-slate-500 shadow-sm active:cursor-grabbing" aria-label={`Reorder ${player.name} among players rated ${displayedRating(player)}`} title="Reorder tied players"><GripVertical className="size-4" /></button>}</div>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_320px]">
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                  {player.games !== undefined ? <><PlayerStat label="GP" value={player.games} /><PlayerStat label="MPG" value={player.minutes ?? "—"} /><PlayerStat label="PTS" value={player.points ?? "—"} featured /><PlayerStat label="REB" value={player.rebounds ?? "—"} /><PlayerStat label="AST" value={player.assists ?? "—"} /><PlayerStat label="FG%" value={pct(player.fgPct)} /><PlayerStat label="3P%" value={pct(player.threePct)} /><PlayerStat label="FT%" value={pct(player.ftPct)} /></> : <div className="col-span-full rounded-xl border border-dashed border-white/20 bg-white/40 p-3 text-sm text-slate-500">No 2025/26 NBA stats — rookie or no NBA appearances.</div>}
                </div>
                <div className="rounded-xl border border-white/20 bg-white/65 p-2">
                  <div className="mb-1 flex items-center justify-between"><span className="text-sm font-bold text-slate-600">My Rating</span><strong className="text-2xl font-black tabular-nums" style={{ color: `hsl(${ratingHue} 65% 38%)` }}>{player.rating}</strong></div>
                  <Slider min={PLAYER_RATING_MIN} max={PLAYER_RATING_MAX} step={1} value={[player.rating]} onValueChange={(value) => updatePlayer(player.id, { rating: value[0] })} aria-label={`${player.name} rating`} />
                  <div className="mt-1.5 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{PLAYER_RATING_MIN}</span><NativeSelect value={player.lineupRole ?? (player.starter ? "starter" : "out")} onChange={(event) => { const lineupRole = event.target.value as LineupRole; updatePlayer(player.id, { lineupRole, starter: lineupRole === "starter" }); }} className="h-9 w-36 min-w-36 bg-white/70 py-1 leading-normal"><NativeSelectOption value="starter">Starter</NativeSelectOption><NativeSelectOption value="bench">Bench</NativeSelectOption><NativeSelectOption value="out">Out</NativeSelectOption></NativeSelect><span className="text-xs text-slate-500">{PLAYER_RATING_MAX}</span></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerStat({ label, value, featured = false }: { label: string; value: string | number; featured?: boolean }) {
  return <div className={`rounded-lg border p-1.5 text-center ${featured ? "border-orange-300 bg-orange-100/70" : "border-white/20 bg-white/55"}`}><strong className="block text-sm font-black leading-tight tabular-nums">{value}</strong><span className="text-xs font-bold leading-tight text-slate-500">{label}</span></div>;
}

function TeamCompare({ state }: { state: AppState }) {
  const [leftId, setLeftId] = useState("bos");
  const [rightId, setRightId] = useState("okc");
  const metrics = (teamId: string) => {
    const players = state.players.filter((player) => player.teamId === teamId);
    const positionOrder: Position[] = ["PG", "SG", "SF", "PF", "C"];
    const starters = players
      .filter((player) => (player.lineupRole ?? (player.starter ? "starter" : "out")) === "starter")
      .sort((a, b) => positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position) || b.rating - a.rating);
    const bench = players
      .filter((player) => (player.lineupRole ?? (player.starter ? "starter" : "out")) === "bench")
      .sort((a, b) => b.rating - a.rating || positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position) || a.name.localeCompare(b.name));
    const average = (items: Player[]) => items.length ? Math.round(items.reduce((sum, player) => sum + player.rating, 0) / items.length * 10) / 10 : 0;
    return { players, starters, bench, starterAvg: average(starters), benchAvg: average(bench) };
  };
  const sides = [[leftId, setLeftId], [rightId, setRightId]] as const;
  return (
    <div>
      <SectionTitle title="Team Comparison" detail="Compare starting lineups, bench depth and the average rating of each unit." />
      <div className="grid gap-4 lg:grid-cols-2">
        {sides.map(([id, setter], sideIndex) => {
          const team = state.teams.find((item) => item.id === id)!;
          const data = metrics(id);
          const overall = teamOverall(team, state.categories);
          const theme = TEAM_THEMES[team.abbr] ?? { primary: "#f97316", secondary: "#22d3ee" };
          return (
            <Card key={sideIndex} className="overflow-hidden border text-foreground" style={{ borderColor: `${theme.primary}66`, backgroundImage: `linear-gradient(135deg, ${theme.primary}2e, #111b2f 42%, ${theme.secondary}24)` }}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/90 p-2 shadow-lg"><img src={teamLogoUrl(team.abbr)} alt={`${team.name} logo`} className="size-full object-contain" /></div>
                <NativeSelect value={id} onChange={(event) => setter(event.target.value)} className="min-w-0 flex-1 bg-[#0b1426]/85">{state.teams.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="Future Grade" value={overall.grade} />
                  <Metric label="Starter Average" value={data.starterAvg || "—"} />
                  <Metric label="Bench Average" value={data.benchAvg || "—"} />
                </div>
                <Lineup title={`Starters · ${data.starters.length}/5`} players={data.starters} />
                <Lineup title={`Bench · ${data.bench.length}`} players={data.bench} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-[#0b1426] p-3"><strong className="block text-xl text-orange-700">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>;
}

function Lineup({ title, players }: { title: string; players: Player[] }) {
  return <div><h3 className="mb-2 font-bold">{title}</h3><div className="space-y-2">{players.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">No players in this unit</p> : players.map((player) => <div key={player.id} className="flex items-center justify-between rounded-xl bg-[#0b1426]/90 px-3 py-2"><div><strong>{player.name}</strong><Badge className="ml-2">{player.position}</Badge></div><span className="font-black tabular-nums text-orange-700">{player.rating}</span></div>)}</div></div>;
}

type PlayerOption = { value: string; label: string; detail: string };

function PlayerPicker({ players, value, onChange, placeholder = "Search players…" }: { players: Player[]; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const options = useMemo<PlayerOption[]>(() => players.map((player) => ({ value: player.id, label: player.name, detail: `${player.position} · ${player.teamId.toUpperCase()}` })), [players]);
  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || normalized === selected?.label.toLowerCase()) return options.slice(0, 30);
    return options.filter((option) => `${option.label} ${option.detail}`.toLowerCase().includes(normalized)).slice(0, 30);
  }, [options, query, selected?.label]);

  return (
    <Combobox
      items={options}
      filteredItems={filtered}
      value={selected}
      onValueChange={(option) => onChange(option?.value ?? "")}
      onInputValueChange={setQuery}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, current) => option.value === current.value}
    >
      <ComboboxInput showClear className="w-full bg-[#0b1426]" placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty>No matching player</ComboboxEmpty>
        <ComboboxList>
          {filtered.map((option, index) => (
            <ComboboxItem key={option.value} value={option} index={index}>
              <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{option.detail}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const podiumStyles = [
  { label: "Gold", row: "border-amber-300 bg-gradient-to-r from-amber-100/90 to-white/50", medal: "bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 shadow-amber-300/40" },
  { label: "Silver", row: "border-slate-300 bg-gradient-to-r from-slate-100/90 to-white/50", medal: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-slate-300/40" },
  { label: "Bronze", row: "border-orange-300 bg-gradient-to-r from-orange-100/80 to-white/50", medal: "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950 shadow-orange-300/40" },
] as const;

function Awards({ state, setState }: { state: AppState; setState: (next: AppState | ((value: AppState) => AppState)) => void }) {
  const sortedPlayers = useMemo(() => [...state.players].sort((a, b) => b.rating - a.rating), [state.players]);
  return (
    <div>
      <SectionTitle title="Awards & All-League Teams" detail="Rank three candidates for every award and build your All-NBA, All-Defense and All-Rookie teams." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AWARDS.map((award) => (
          <Card key={award} className="border-white/10 bg-[#111b2f] text-foreground">
            <CardHeader><CardTitle className="text-lg text-orange-700">{award}</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              {[0, 1, 2].map((index) => {
                const podium = podiumStyles[index];
                const updateSelection = (selection: string) => setState((current) => ({ ...current, awards: { ...current.awards, [award]: current.awards[award].map((value, itemIndex) => itemIndex === index ? selection : value) } }));
                return <div key={index} className={`flex items-center gap-2 rounded-xl border p-2 ${podium.row}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full shadow-lg ${podium.medal}`} title={`${podium.label} medal`}><span className="text-sm font-black">{index + 1}</span></span>
                  <div className="min-w-0 flex-1">{award === "Coach of the Year" ? <Input value={state.awards[award]?.[index] ?? ""} onChange={(event) => updateSelection(event.target.value)} placeholder="Coach name" className="bg-white/70" /> : <PlayerPicker players={sortedPlayers} value={state.awards[award]?.[index] ?? ""} onChange={updateSelection} />}</div>
                </div>;
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Object.entries(state.honors).map(([honor, selections]) => (
          <Card key={honor} className="border-white/10 bg-[#111b2f] text-foreground">
            <CardHeader><CardTitle className="text-base">{honor}</CardTitle></CardHeader>
            <CardContent className="space-y-2" dir="ltr">
              {selections.map((selection, index) => (
                <div key={index} className="flex items-center gap-2"><Badge variant="outline" className="w-9 justify-center">{index + 1}</Badge><div className="min-w-0 flex-1"><PlayerPicker players={sortedPlayers} value={selection} onChange={(nextSelection) => setState((current) => ({ ...current, honors: { ...current.honors, [honor]: current.honors[honor].map((value, itemIndex) => itemIndex === index ? nextSelection : value) } }))} /></div></div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
