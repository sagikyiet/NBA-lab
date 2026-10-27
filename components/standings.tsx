"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { GripVertical, Minus, Plus, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useGrabReorder } from "@/hooks/use-grab-reorder";
import { AppState, Conference, Grade, teamLogoUrl, teamOverall } from "@/lib/nba-data";

type Props = {
  state: AppState;
  setState: (next: AppState | ((value: AppState) => AppState)) => void;
};

type View = Conference | "League";

function recordColor(wins: number) {
  const hue = Math.round(Math.max(0, Math.min(82, wins)) / 82 * 125);
  return `hsl(${hue} 78% 52%)`;
}

function orderedConference(state: AppState, conference: Conference) {
  const teams = state.teams.filter((team) => team.conference === conference);
  const byId = new Map(teams.map((team) => [team.id, team]));
  const ordered = state.conferenceOrder[conference].map((id) => byId.get(id)).filter(Boolean) as typeof teams;
  const missing = teams.filter((team) => !state.conferenceOrder[conference].includes(team.id));
  return [...ordered, ...missing];
}

function statusFor(index: number) {
  if (index < 6) return { label: "Playoffs", color: "#34d399", row: "border-emerald-400/25 bg-emerald-400/[0.07]", badge: "border-emerald-400/40 bg-emerald-400/15 text-emerald-700" };
  if (index < 10) return { label: "Play-In", color: "#fb923c", row: "border-orange-400/30 bg-orange-400/[0.08]", badge: "border-orange-400/40 bg-orange-100 text-orange-800" };
  return { label: "Lottery", color: "#64748b", row: "border-slate-300 bg-slate-100/50 opacity-80", badge: "border-slate-300 bg-slate-200/60 text-slate-600" };
}

function futureGradeStyle(grade: Grade) {
  if (grade.startsWith("A")) return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (grade.startsWith("B")) return "border-sky-300 bg-sky-100 text-sky-800";
  if (grade.startsWith("C")) return "border-amber-300 bg-amber-100 text-amber-900";
  if (grade.startsWith("D")) return "border-orange-300 bg-orange-100 text-orange-900";
  return "border-rose-300 bg-rose-100 text-rose-800";
}

export default function EnhancedStandings({ state, setState }: Props) {
  const [view, setView] = useState<View>("East");
  const east = useMemo(() => orderedConference(state, "East"), [state]);
  const west = useMemo(() => orderedConference(state, "West"), [state]);
  const totalWins = state.teams.reduce((sum, team) => sum + team.wins, 0);
  const difference = 1230 - totalWins;
  const eastWins = east.reduce((sum, team) => sum + team.wins, 0);
  const westWins = west.reduce((sum, team) => sum + team.wins, 0);
  // Each conference has 390 wins locked into intraconference games; the remainder is East-vs-West.
  const eastCross = eastWins - 390;
  const westCross = westWins - 390;
  const crossTotal = eastCross + westCross;
  const eastShare = crossTotal > 0 ? Math.max(0, Math.min(100, eastCross / crossTotal * 100)) : 50;

  const setWins = (conference: Conference, teamId: string, requested: number) => {
    const ordered = orderedConference(state, conference);
    const index = ordered.findIndex((team) => team.id === teamId);
    const max = index === 0 ? 82 : ordered[index - 1].wins;
    const min = index === ordered.length - 1 ? 0 : ordered[index + 1].wins;
    const wins = Math.max(min, Math.min(max, Math.round(requested)));
    setState((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, wins } : team),
    }));
  };

  const moveTeamTo = (conference: Conference, teamId: string, targetId: string) => {
    setState((current) => {
      const order = [...current.conferenceOrder[conference]];
      const from = order.indexOf(teamId);
      const to = order.indexOf(targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const moving = current.teams.find((team) => team.id === teamId);
      if (!moving) return current;
      const [moved] = order.splice(from, 1);
      const targetIndex = order.indexOf(targetId);
      const insertion = from < to ? targetIndex + 1 : targetIndex;
      order.splice(insertion, 0, moved);
      const newIndex = order.indexOf(teamId);
      const previous = newIndex > 0 ? current.teams.find((team) => team.id === order[newIndex - 1]) : null;
      const next = newIndex < order.length - 1 ? current.teams.find((team) => team.id === order[newIndex + 1]) : null;
      const adjustedWins = Math.max(next?.wins ?? 0, Math.min(previous?.wins ?? 82, moving.wins));
      return {
        ...current,
        conferenceOrder: { ...current.conferenceOrder, [conference]: order },
        teams: current.teams.map((team) => team.id === teamId ? { ...team, wins: adjustedWins } : team),
      };
    });
  };

  const teamGrab = useGrabReorder((sourceId, targetId) => {
    const source = state.teams.find((team) => team.id === sourceId);
    const target = state.teams.find((team) => team.id === targetId);
    if (source && target && source.conference === target.conference) moveTeamTo(source.conference, sourceId, targetId);
  }, { autoScroll: true });

  const conferences: Conference[] = view === "League" ? ["East", "West"] : [view];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-foreground sm:text-3xl">Regular Season Prediction</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Set the order, then tune each win total within the valid range.</p>
        </div>
        <ToggleGroup type="single" value={view} onValueChange={(value) => value && setView(value as View)} variant="outline" className="grid w-full grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-[#111b2f] sm:w-auto">
          <ToggleGroupItem value="East" className="h-11 border-0 data-[state=on]:bg-cyan-500 data-[state=on]:text-slate-950">East</ToggleGroupItem>
          <ToggleGroupItem value="West" className="h-11 border-0 data-[state=on]:bg-orange-500 data-[state=on]:text-slate-950">West</ToggleGroupItem>
          <ToggleGroupItem value="League" className="h-11 border-0 data-[state=on]:bg-white data-[state=on]:text-slate-950">League</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Card className="h-full border-stone-200/80 bg-[#f3ece4]/70 text-foreground shadow-none">
          <CardContent className="flex h-16 flex-col justify-center px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-stone-600">League wins</span>
              <strong className={`shrink-0 text-xs ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>{difference === 0 ? "Balanced" : `${difference > 0 ? "+" : "−"}${Math.abs(difference)}`}</strong>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Progress value={Math.min(100, totalWins / 12.3)} className="h-1 flex-1 opacity-70" />
              <span className="shrink-0 tabular-nums text-[11px] text-stone-500">{totalWins.toLocaleString()}/1,230</span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-stone-200/80 bg-[#f3ece4]/70 text-foreground shadow-none">
          <CardContent className="flex h-16 flex-col justify-center px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5"><Swords className="hidden size-3.5 shrink-0 text-stone-500 sm:block" /><span className="truncate text-xs font-semibold text-stone-600">East vs. West</span></div>
              <span className="shrink-0 text-[11px] text-stone-500">{crossTotal}/450</span>
            </div>
            <div className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <strong className="text-xs tabular-nums text-cyan-700">{eastCross} E</strong>
              <div className="flex h-1 overflow-hidden rounded-full bg-orange-400/70"><div className="h-full bg-cyan-500/70 transition-all" style={{ width: `${eastShare}%` }} /></div>
              <strong className="text-xs tabular-nums text-orange-700">W {westCross}</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`grid gap-4 ${view === "League" ? "xl:grid-cols-2" : "mx-auto max-w-4xl"}`}>
        {conferences.map((conference) => (
          <ConferenceTable key={conference} conference={conference} teams={conference === "East" ? east : west} categories={state.categories} setWins={setWins} grab={teamGrab} />
        ))}
      </div>
    </div>
  );
}

function ConferenceTable({ conference, teams, categories, setWins, grab }: {
  conference: Conference;
  teams: AppState["teams"];
  categories: AppState["categories"];
  setWins: (conference: Conference, teamId: string, wins: number) => void;
  grab: ReturnType<typeof useGrabReorder>;
}) {
  return (
    <Card className="overflow-visible border-white/10 bg-[#111b2f] text-foreground">
      <CardHeader className={`rounded-t-xl border-b border-white/10 ${conference === "East" ? "bg-gradient-to-l from-cyan-500/20 to-transparent" : "bg-gradient-to-l from-orange-500/20 to-transparent"}`}>
        <CardTitle className="flex items-center gap-3"><ConferenceMark conference={conference} /><div><span className="block">{conference}</span><span className="mt-0.5 block text-xs font-medium tracking-widest text-slate-400">{conference.toUpperCase()} CONFERENCE</span></div></CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-2 pt-2 sm:px-4">
        <div className="mb-2 flex flex-wrap gap-2 px-2 text-xs">
          <Badge className="border-emerald-400/40 bg-emerald-400/15 text-emerald-700">1–6 · Playoffs</Badge>
          <Badge className="border-orange-400/40 bg-orange-100 text-orange-800">7–10 · Play-In</Badge>
          <Badge className="border-slate-300 bg-slate-200/60 text-slate-600">11–15 · Lottery</Badge>
        </div>
        {teams.map((team, index) => {
          const previousWins = index === 0 ? 82 : teams[index - 1].wins;
          const nextWins = index === teams.length - 1 ? 0 : teams[index + 1].wins;
          const status = statusFor(index);
          const winColor = recordColor(team.wins);
          const futureGrade = teamOverall(team, categories).grade;
          return (
            <div key={team.id} data-reorder-id={team.id} className={`rounded-xl border px-2 py-1.5 transition ${status.row} ${index === 6 || index === 10 ? "mt-3" : ""} ${grab.activeId === team.id ? "border-white/60 opacity-95 shadow-2xl ring-2 ring-white/20" : grab.targetId === team.id ? "border-cyan-300/70 ring-2 ring-cyan-300/25" : ""}`} style={{ "--primary": winColor, ...grab.itemStyle(team.id) } as CSSProperties}>
              <div className="grid grid-cols-[26px_38px_minmax(0,1fr)_38px] items-center gap-1.5">
                <span className="grid size-6 place-items-center rounded-md bg-black/20 text-sm font-black text-slate-600">{index + 1}</span>
                <div className="grid size-9 place-items-center"><img src={teamLogoUrl(team.abbr)} alt="" className="size-full object-contain drop-shadow-lg" /></div>
                <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><strong className="min-w-0 truncate">{team.name}</strong><Badge className={`shrink-0 border px-1.5 py-0 text-xs font-black ${futureGradeStyle(futureGrade)}`} title="Future grade">{futureGrade}</Badge></div><Badge className={`mt-1 border text-[11px] ${status.badge}`}>{status.label}</Badge></div>
                <button {...grab.bind(team.id)} className="grid size-9 cursor-grab place-items-center rounded-lg border border-white/15 bg-black/10 text-slate-500 shadow-inner hover:bg-white/40 active:cursor-grabbing" aria-label={`Drag ${team.name}`}><GripVertical className="size-5" /></button>
              </div>
              <div className="mt-1 grid grid-cols-[32px_1fr_32px] items-center gap-1.5" dir="ltr">
                <Button variant="ghost" size="icon-sm" disabled={team.wins <= nextWins} onClick={() => setWins(conference, team.id, team.wins - 1)} aria-label="Remove one win"><Minus className="size-4" /></Button>
                <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2">
                  <div className="text-center"><strong className="block text-xl font-black leading-none tabular-nums" style={{ color: winColor }}>{team.wins}</strong><span className="text-[11px] leading-none text-slate-500">W</span></div>
                  <Slider min={nextWins} max={previousWins} step={1} value={[team.wins]} onValueChange={(value) => setWins(conference, team.id, value[0])} aria-label={`${team.name} wins`} />
                  <div className="text-center"><strong className="block text-base font-bold leading-none tabular-nums text-slate-500">{82 - team.wins}</strong><span className="text-[11px] leading-none text-slate-600">L</span></div>
                </div>
                <Button variant="ghost" size="icon-sm" disabled={team.wins >= previousWins} onClick={() => setWins(conference, team.id, team.wins + 1)} aria-label="Add one win"><Plus className="size-4" /></Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ConferenceMark({ conference }: { conference: Conference }) {
  const east = conference === "East";
  return (
    <div className={`relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 shadow-xl ${east ? "border-cyan-300/70 bg-gradient-to-br from-cyan-300 via-blue-600 to-slate-950 shadow-cyan-500/20" : "border-orange-300/70 bg-gradient-to-br from-amber-300 via-orange-600 to-rose-950 shadow-orange-500/20"}`} aria-hidden="true">
      <span className="absolute inset-1 rounded-full border border-white/25" />
      <span className="text-3xl font-black italic leading-none text-white drop-shadow-lg">{east ? "E" : "W"}</span>
      <span className="absolute bottom-1 text-xs font-black tracking-wider text-white/80">NBA</span>
    </div>
  );
}
