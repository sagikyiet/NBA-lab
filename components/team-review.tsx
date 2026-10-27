"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Check, CheckCircle2, Gauge, GripVertical, MoreVertical, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { useGrabReorder } from "@/hooks/use-grab-reorder";
import {
  AppState,
  Category,
  Grade,
  GRADES,
  LineupRole,
  Position,
  POSITIONS,
  TEAM_STATS,
  TEAM_THEMES,
  teamLogoUrl,
  teamOverall,
} from "@/lib/nba-data";

type Props = {
  state: AppState;
  setState: (next: AppState | ((value: AppState) => AppState)) => void;
};

const importanceLabels = ["", "Low", "Normal", "High", "Very high", "Critical"];
const PLAYER_RATING_MIN = 65;
const PLAYER_RATING_MAX = 99;

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function gradeStyle(grade: Grade) {
  if (grade.startsWith("A")) return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (grade.startsWith("B")) return "border-sky-300 bg-sky-100 text-sky-800";
  if (grade.startsWith("C")) return "border-amber-300 bg-amber-100 text-amber-900";
  if (grade.startsWith("D")) return "border-orange-300 bg-orange-100 text-orange-900";
  return "border-rose-300 bg-rose-100 text-rose-800";
}

function gradeColor(grade: Grade) {
  const score = GRADES.length - 1 - GRADES.indexOf(grade);
  return `hsl(${Math.round(score / (GRADES.length - 1) * 125)} 78% 52%)`;
}

export default function EnhancedTeamReview({ state, setState }: Props) {
  const [selectedId, setSelectedId] = useState("bos");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [activeGroup, setActiveGroup] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rosterOrganized, setRosterOrganized] = useState(false);
  const selected = state.teams.find((team) => team.id === selectedId) ?? state.teams[0];
  const theme = TEAM_THEMES[selected.abbr] ?? { primary: "#f97316", secondary: "#22d3ee", logoId: "" };
  const overall = teamOverall(selected, state.categories);
  const snapshot = TEAM_STATS[selected.abbr];
  const predictedRank = state.conferenceOrder[selected.conference].indexOf(selected.id) + 1;
  const groups = state.categoryGroups?.length
    ? state.categoryGroups
    : Array.from(new Set(state.categories.map((category) => category.group)));
  const selectedGroup = groups.includes(activeGroup) ? activeGroup : (groups[0] ?? "");
  const teamPlayers = useMemo(
    () => state.players.filter((player) => player.teamId === selected.id).sort((a, b) => (a.lineupOrder ?? a.order) - (b.lineupOrder ?? b.order)),
    [state.players, selected.id],
  );
  const starterCount = teamPlayers.filter((player) => (player.lineupRole ?? (player.starter ? "starter" : "out")) === "starter").length;
  const benchCount = teamPlayers.filter((player) => player.lineupRole === "bench").length;

  const updateTeam = (patch: Partial<typeof selected>) => setState((current) => ({
    ...current,
    teams: current.teams.map((team) => team.id === selected.id ? { ...team, ...patch } : team),
  }));

  const addCategory = (group: string) => {
    const name = (drafts[group] ?? "").trim();
    if (!name) return;
    const category: Category = { id: uid("category"), name, group, weight: 3 };
    setState((current) => ({
      ...current,
      categories: [...current.categories, category],
      teams: current.teams.map((team) => ({ ...team, grades: { ...team.grades, [category.id]: "B" } })),
    }));
    setDrafts((current) => ({ ...current, [group]: "" }));
  };

  const addGroup = () => {
    const name = newGroup.trim();
    if (!name || groups.includes(name)) return;
    setState((current) => ({ ...current, categoryGroups: [...groups, name] }));
    setActiveGroup(name);
    setNewGroup("");
    setShowNewGroup(false);
  };

  const moveCategoryTo = (categoryId: string, targetId: string) => {
    setState((current) => {
      const category = current.categories.find((item) => item.id === categoryId);
      const target = current.categories.find((item) => item.id === targetId);
      if (!category || !target || category.group !== target.group) return current;
      const categories = [...current.categories];
      const from = categories.findIndex((item) => item.id === categoryId);
      const to = categories.findIndex((item) => item.id === target.id);
      const [moved] = categories.splice(from, 1);
      const insertion = categories.findIndex((item) => item.id === target.id);
      categories.splice(from < to ? insertion + 1 : insertion, 0, moved);
      return { ...current, categories };
    });
  };

  const categoryGrab = useGrabReorder(moveCategoryTo);

  const removeCategory = (categoryId: string) => setState((current) => ({
    ...current,
    categories: current.categories.filter((category) => category.id !== categoryId),
  }));

  const setLineupRole = (playerId: string, lineupRole: LineupRole) => {
    setRosterOrganized(false);
    setState((current) => {
    const currentStarters = current.players.filter((player) => player.teamId === selected.id && (player.lineupRole ?? (player.starter ? "starter" : "out")) === "starter");
    const player = current.players.find((item) => item.id === playerId);
    if (lineupRole === "starter" && player?.lineupRole !== "starter" && !player?.starter && currentStarters.length >= 5) return current;
    return {
      ...current,
      players: current.players.map((item) => item.id === playerId ? { ...item, lineupRole, starter: lineupRole === "starter" } : item),
    };
    });
  };

  const setPlayerPosition = (playerId: string, position: Position) => {
    setRosterOrganized(false);
    setState((current) => ({
      ...current,
      players: current.players.map((player) => player.id === playerId
        ? { ...player, position, order: current.players.filter((item) => item.position === position).length }
        : player),
    }));
  };

  const setPlayerRating = (playerId: string, rating: number) => {
    setRosterOrganized(false);
    setState((current) => ({
      ...current,
      players: current.players.map((player) => player.id === playerId ? { ...player, rating } : player),
    }));
  };

  const organizeRoster = () => {
    const roleOrder: Record<LineupRole, number> = { starter: 0, bench: 1, out: 2 };
    const positionOrder = ["PG", "SG", "SF", "PF", "C"];
    const organized = [...teamPlayers].sort((a, b) => {
      const aRole = a.lineupRole ?? (a.starter ? "starter" : "out");
      const bRole = b.lineupRole ?? (b.starter ? "starter" : "out");
      const roleDifference = roleOrder[aRole] - roleOrder[bRole];
      if (roleDifference) return roleDifference;
      if (aRole === "bench") return b.rating - a.rating || positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position) || a.name.localeCompare(b.name);
      return positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position) || a.order - b.order || a.name.localeCompare(b.name);
    });
    const orderById = new Map(organized.map((player, index) => [player.id, index]));
    setState((current) => ({
      ...current,
      rankingRevision: (current.rankingRevision ?? 0) + 1,
      players: current.players.map((player) => orderById.has(player.id) ? { ...player, lineupOrder: orderById.get(player.id) } : player),
    }));
    setRosterOrganized(true);
  };

  return (
    <div
      className="min-w-0 max-w-full overflow-x-hidden rounded-3xl border p-3 transition-colors sm:p-5"
      style={{
        borderColor: `${theme.primary}55`,
        backgroundImage: `radial-gradient(circle at 90% 0%, ${theme.primary}28, transparent 32rem), radial-gradient(circle at 5% 15%, ${theme.secondary}18, transparent 28rem)`,
      }}
    >
      <div
        data-inverse
        className="relative mb-5 overflow-hidden rounded-3xl border border-white/15 p-4 shadow-2xl sm:p-6"
        style={{ background: `linear-gradient(125deg, ${theme.primary}E8 0%, #101a2e 55%, ${theme.secondary}A8 145%)` }}
      >
        <div className="absolute -left-10 -top-12 size-52 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="grid size-20 shrink-0 place-items-center rounded-3xl border border-white/25 bg-white/95 p-3 shadow-xl sm:size-28">
              <img src={teamLogoUrl(selected.abbr)} alt={`${selected.name} logo`} className="size-full object-contain" />
            </div>
            <div className="w-full min-w-0 text-center sm:text-left">
              <p className="mb-1 text-sm font-bold uppercase tracking-wider text-white/65">Team Review · {selected.conference}</p>
              <h2 className="break-words text-2xl font-black leading-tight text-white sm:text-4xl">{selected.name}</h2>
              <NativeSelect value={selected.id} onChange={(event) => setSelectedId(event.target.value)} className="mt-3 w-full min-w-0 max-w-full border-white/25 bg-black/25 text-white backdrop-blur">
                {state.teams.map((team) => <NativeSelectOption key={team.id} value={team.id}>{team.name}</NativeSelectOption>)}
              </NativeSelect>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3 lg:min-w-[520px]">
            {snapshot && <div>
              <p className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/65">{snapshot.season} · Last season</p>
              <div className="grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-white/20 bg-black/20 p-2 backdrop-blur sm:grid-cols-4">
              <HeroMetric label="Record" value={`${snapshot.wins}–${snapshot.losses}`} detail={`${selected.conference} #${snapshot.conferenceRank}`} />
              <HeroMetric label="Offensive Rating" value={snapshot.offensiveRating} detail={`NBA #${snapshot.offensiveRank}`} />
              <HeroMetric label="Defensive Rating" value={snapshot.defensiveRating} detail={`NBA #${snapshot.defensiveRank}`} />
              <HeroMetric label="Playoff finish" value={snapshot.playoffResult} detail="Basketball Reference" compact />
              </div>
            </div>}
            <div>
            <p className="mb-1.5 text-xs font-black uppercase tracking-[0.16em] text-white/65">{state.season} · Your forecast</p>
            <div className="grid grid-cols-3 gap-2">
            <div className={`flex items-center justify-center rounded-2xl border px-3 py-3 text-center backdrop-blur ${gradeStyle(overall.grade)}`}>
              <div><span className="block text-xs font-bold opacity-70">Future Grade</span><strong className="text-4xl font-black">{overall.grade}</strong></div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-black/25 px-3 py-3 text-center backdrop-blur"><span className="block text-xs font-bold text-white/60">Projected Record</span><strong className="mt-1 block text-xl font-black tabular-nums text-white">{selected.wins}–{82 - selected.wins}</strong></div>
            <div className="rounded-2xl border border-white/20 bg-black/25 px-3 py-3 text-center backdrop-blur"><span className="block text-xs font-bold text-white/60">Projected Seed</span><strong className="mt-1 block text-xl font-black text-white">#{predictedRank || "—"} {selected.conference}</strong></div>
            </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <div role="tablist" aria-label="Category groups" className="scrollbar-none flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b1426]/85 p-2">
            {groups.map((group) => (
              <button
                key={group}
                role="tab"
                aria-selected={selectedGroup === group}
                onClick={() => setActiveGroup(group)}
                className={`min-w-max rounded-xl border px-5 py-3 text-sm font-bold transition ${selectedGroup === group ? "border-white/25 text-white shadow-lg" : "border-transparent bg-white/40 text-slate-600 hover:bg-white/70 hover:text-foreground"}`}
                style={selectedGroup === group ? { background: `linear-gradient(135deg, ${theme.primary}BB, ${theme.secondary}88)` } : undefined}
              >
                {group}
                <Badge className="mr-2 border-white/10 bg-black/20 text-white/75">{state.categories.filter((category) => category.group === group).length}</Badge>
              </button>
            ))}
          </div>

          {groups.filter((group) => group === selectedGroup).map((group) => {
            const groupCategories = state.categories.filter((category) => category.group === group);
            return (
              <Card
                key={group}
                className="text-foreground shadow-xl"
                style={{
                  borderColor: `${theme.primary}99`,
                  backgroundColor: `${theme.primary}22`,
                  backgroundImage: `linear-gradient(135deg, ${theme.primary}30 0%, #fffaf4 48%, ${theme.secondary}26 115%)`,
                  boxShadow: `inset 0 1px 0 ${theme.secondary}22, 0 18px 44px ${theme.primary}18`,
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-lg">
                    <span className="flex items-center gap-2"><Sparkles className="size-4" style={{ color: theme.secondary }} />{group}</span>
                    <DropdownMenu dir="ltr">
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Category group options"><MoreVertical className="size-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 border-white/10 bg-[#111b2f] text-foreground">
                        <DropdownMenuItem onSelect={() => setShowNewGroup(true)} className="cursor-pointer focus:bg-orange-50 focus:text-foreground"><Plus /> New category group</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardTitle>
                  {showNewGroup && <div className="mt-3 flex gap-2 rounded-xl border border-dashed border-white/15 bg-black/10 p-2"><Input autoFocus value={newGroup} onChange={(event) => setNewGroup(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addGroup(); if (event.key === "Escape") setShowNewGroup(false); }} placeholder="New group name" className="h-9 bg-[#0b1426]" /><Button onClick={addGroup} size="sm" className="shrink-0 bg-orange-600 text-white hover:bg-orange-700">Add</Button></div>}
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {groupCategories.map((category) => {
                      const grade = selected.grades[category.id] ?? "B";
                      const importance = Math.max(1, Math.min(5, category.weight));
                      const gradeScore = GRADES.length - 1 - GRADES.indexOf(grade);
                      return (
                        <div
                          key={category.id}
                          data-reorder-id={category.id}
                          className={`rounded-2xl border bg-[#0b1426]/95 p-3 shadow-inner transition ${categoryGrab.activeId === category.id ? "border-white/60 opacity-95 shadow-2xl ring-2 ring-white/20" : categoryGrab.targetId === category.id ? "border-cyan-300/70 ring-2 ring-cyan-300/25" : "border-white/10"}`}
                          style={{ "--primary": gradeColor(grade), ...categoryGrab.itemStyle(category.id) } as CSSProperties}
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <button {...categoryGrab.bind(category.id)} className="grid size-9 shrink-0 cursor-grab place-items-center rounded-lg text-slate-500 hover:bg-white/30 active:cursor-grabbing" aria-label={`Drag ${category.name}`}><GripVertical className="size-5" /></button>
                            {editingId === category.id ? (
                              <Input
                                autoFocus
                                value={category.name}
                                onChange={(event) => setState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item) }))}
                                onBlur={() => setEditingId(null)}
                                onKeyDown={(event) => event.key === "Enter" && setEditingId(null)}
                                className="h-9 min-w-0 flex-1 bg-[#111b2f]"
                              />
                            ) : <strong className="min-w-0 flex-1 truncate text-base">{category.name}</strong>}
                            <DropdownMenu dir="ltr">
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`${category.name} options`}><MoreVertical className="size-5" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 border-white/10 bg-[#111b2f] text-foreground">
                                <DropdownMenuItem onSelect={() => setEditingId(category.id)} className="cursor-pointer focus:bg-white/20"><Pencil /> Rename</DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="cursor-pointer focus:bg-white/20"><Gauge /> Importance · {importanceLabels[importance]}</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="border-white/10 bg-[#111b2f] text-foreground">
                                    <DropdownMenuRadioGroup value={String(importance)} onValueChange={(value) => setState((current) => ({ ...current, categories: current.categories.map((item) => item.id === category.id ? { ...item, weight: Number(value) } : item) }))}>
                                      {importanceLabels.slice(1).map((label, index) => <DropdownMenuRadioItem key={label} value={String(index + 1)} className="cursor-pointer focus:bg-orange-50 focus:text-foreground">{label}</DropdownMenuRadioItem>)}
                                    </DropdownMenuRadioGroup>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem variant="destructive" onSelect={() => removeCategory(category.id)} className="cursor-pointer"><Trash2 /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className={`mb-4 flex items-center justify-center rounded-2xl border py-3 ${gradeStyle(grade)}`}>
                            <span className="text-5xl font-black tracking-tight">{grade}</span>
                          </div>
                          <div dir="ltr">
                            <Slider min={0} max={GRADES.length - 1} step={1} value={[gradeScore]} onValueChange={(value) => updateTeam({ grades: { ...selected.grades, [category.id]: GRADES[GRADES.length - 1 - value[0]] } })} aria-label={`${category.name} grade`} />
                            <div className="mt-2 flex justify-between text-xs font-bold"><span className="text-rose-700">F</span><span className="text-amber-800">C</span><span className="text-emerald-700">A+</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2 rounded-xl border border-dashed border-white/10 p-2">
                    <Input value={drafts[group] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [group]: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && addCategory(group)} placeholder={`New ${group} category`} className="bg-[#0b1426]" />
                    <Button onClick={() => addCategory(group)} className="shrink-0 bg-orange-600 text-white hover:bg-orange-700"><Plus className="size-4" /> Add</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

        </div>

        <div className="space-y-4">
          <Card className="border-white/10 bg-[#111b2f]/95 text-foreground">
            <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg"><span>Roster · {teamPlayers.length}</span><div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-400">Starters {starterCount}/5 · Bench {benchCount}</span><Button size="sm" onClick={organizeRoster} disabled={starterCount !== 5} className="bg-emerald-600 text-white hover:bg-emerald-500"><Check className="size-4" /> Organize</Button></div></CardTitle>{rosterOrganized && <p className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" /> Starters are ordered by position; bench players by rating.</p>}</CardHeader>
            <CardContent className="max-h-[680px] space-y-2 overflow-y-auto">
              {teamPlayers.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-500">No players on this roster.</p>}
              {teamPlayers.map((player) => {
                const role = player.lineupRole ?? (player.starter ? "starter" : "out");
                return (
                  <div key={player.id} className={`rounded-xl border px-3 py-2.5 transition ${role === "starter" ? "border-orange-400/35 bg-orange-400/10" : role === "bench" ? "border-cyan-400/25 bg-cyan-400/[0.07]" : "border-white/5 bg-[#0b1426]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><span className="block truncate font-medium">{player.name}</span></div>
                      <div className="flex shrink-0 items-center gap-2"><NativeSelect value={player.position} onChange={(event) => setPlayerPosition(player.id, event.target.value as Position)} aria-label={`${player.name} position`} className="h-8 w-20 border-orange-300 bg-orange-100 py-1 font-bold text-orange-900 shadow-none">{POSITIONS.map((position) => <NativeSelectOption key={position} value={position}>{position}</NativeSelectOption>)}</NativeSelect><Popover><PopoverTrigger asChild><button type="button" className="grid h-8 min-w-12 place-items-center rounded-md border border-cyan-300 bg-cyan-100 px-2 font-black tabular-nums text-cyan-900 shadow-none transition hover:bg-cyan-200" aria-label={`Change ${player.name} rating`} title="Change rating">{player.rating}</button></PopoverTrigger><PopoverContent align="end" className="w-64 border-white/10 bg-[#111b2f] p-3 text-foreground"><div className="mb-3 flex items-center justify-between gap-3"><span className="truncate text-sm font-bold">{player.name}</span><strong className="text-2xl font-black tabular-nums text-cyan-600">{player.rating}</strong></div><Slider min={PLAYER_RATING_MIN} max={PLAYER_RATING_MAX} step={1} value={[player.rating]} onValueChange={(value) => setPlayerRating(player.id, value[0])} aria-label={`${player.name} rating`} /><div className="mt-2 flex justify-between text-xs font-medium text-slate-400"><span>{PLAYER_RATING_MIN}</span><span>{PLAYER_RATING_MAX}</span></div></PopoverContent></Popover></div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-black/10 p-1" role="group" aria-label={`${player.name} rotation role`}>
                      {([['starter', 'Starter'], ['bench', 'Bench'], ['out', 'Out']] as Array<[LineupRole, string]>).map(([value, label]) => (
                        <button key={value} onClick={() => setLineupRole(player.id, value)} disabled={value === "starter" && role !== "starter" && starterCount >= 5} aria-pressed={role === value} className={`rounded-md px-1.5 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${role === value ? value === "starter" ? "bg-orange-400 text-slate-950" : value === "bench" ? "bg-cyan-400 text-slate-950" : "bg-slate-600 text-white" : "text-slate-600 hover:bg-white/70 hover:text-foreground"}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ label, value, detail, compact = false }: { label: string; value: string | number; detail: string; compact?: boolean }) {
  return <div className="min-w-0 rounded-xl border border-white/15 bg-white/10 p-2.5"><span className="block text-[11px] font-bold text-white/60">{label}</span><strong className={`${compact ? "truncate text-sm" : "text-lg"} mt-0.5 block font-black tabular-nums text-white`}>{value}</strong><span className="block truncate text-[11px] text-white/60">{detail}</span></div>;
}
