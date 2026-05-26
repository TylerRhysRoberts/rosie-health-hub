import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/BottomNav";
import { DailyLog, fetchLogs, averageScore, SCORE_META, totalWalkMinutes } from "@/lib/daily-logs";
import { Activity, Footprints, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Rosie Health Hub — Insights" },
      { name: "description", content: "Health score trends and averages." },
    ],
  }),
});

function InsightsPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    fetchLogs(user.id, 120)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setMounted(true));
  }, [user, isLoading, navigate]);

  if (!mounted) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;

  const timeframes: { label: string; days: number }[] = [
    { label: "Last 7 Days", days: 7 },
    { label: "Last 30 Days", days: 30 },
    { label: "Last 90 Days", days: 90 },
  ];

  const last7Walks = logs
    .filter((l) => {
      const c = new Date(); c.setDate(c.getDate() - 7);
      return l.log_date >= c.toISOString().split("T")[0];
    })
    .reduce((s, l) => s + totalWalkMinutes(l.walks), 0);

  const last30Entries = logs.filter((l) => {
    const c = new Date(); c.setDate(c.getDate() - 30);
    return l.log_date >= c.toISOString().split("T")[0];
  }).length;

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-5 pt-10">
        <div className="animate-fade-up-blur">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Trends</p>
          <h1 className="text-2xl font-semibold text-foreground mt-1 tracking-tight">Insights</h1>
        </div>

        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={CalendarCheck} label="Entries (30d)" value={`${last30Entries}`} />
              <MiniStat icon={Footprints} label="Walks (7d)" value={`${Math.round(last7Walks)} min`} />
            </div>

            <h2 className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground pt-2 px-1">Average Health Score</h2>

            {timeframes.map((tf) => {
              const avg = averageScore(logs, tf.days);
              return <ScoreCard key={tf.days} label={tf.label} avg={avg} />;
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function ScoreCard({ label, avg }: { label: string; avg: number | null }) {
  const rounded = avg === null ? null : Math.round(avg) as 1 | 2 | 3;
  const meta = rounded ? SCORE_META[rounded] : null;
  return (
    <div className="rounded-2xl bg-card border border-border p-5 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{meta?.label ?? "No data"}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
          {avg === null ? "—" : avg.toFixed(1)}
        </span>
        {meta && (
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ backgroundColor: meta.bg }}
          >
            {meta.emoji}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <Icon className="w-4 h-4 text-primary mb-2" />
      <p className="font-mono text-xl font-semibold text-foreground tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-2 border-dashed border-border rounded-2xl py-16 px-6 text-center mt-6">
      <Activity className="w-7 h-7 text-muted-foreground/50 mx-auto mb-4" />
      <p className="text-foreground font-semibold">No data yet</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px] mx-auto">
        Save a daily log to start seeing trends here.
      </p>
    </div>
  );
}

function Sparkline({ habitId, logs }: { habitId: string; logs: HabitLog[] }) {
  const days: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push(logs.some((l) => l.habitId === habitId && l.date === key));
  }

  return (
    <div className="flex items-end gap-[3px] h-8">
      {days.map((done, i) => (
        <div
          key={i}
          className={`w-[6px] rounded-sm transition-all duration-300 ${
            done ? "bg-primary" : "bg-border"
          }`}
          style={{ height: done ? "100%" : "30%" }}
        />
      ))}
    </div>
  );
}

function InsightsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const loadData = async () => {
      if (user) {
        try {
          const [h, l] = await Promise.all([
            fetchHabitsFromCloud(user.id),
            fetchLogsFromCloud(user.id),
          ]);
          setHabits(h);
          setLogs(l);
        } catch {
          setHabits(getHabits());
          setLogs(getLogs());
        }
      } else {
        setHabits(getHabits());
        setLogs(getLogs());
      }
      setMounted(true);
    };

    loadData();
  }, [user, authLoading]);

  const handleAdd = async (habit: Habit) => {
    const updated = [...habits, habit];
    setHabits(updated);
    if (user) {
      try { await saveHabitToCloud(habit, user.id, updated.length - 1); } catch {}
    } else {
      saveHabits(updated);
    }
  };

  if (!mounted || authLoading) return null;

  const totalHabits = habits.length;
  const todayCompleted = habits.filter((h) => isCompletedToday(h.id, logs)).length;
  const avgRate = totalHabits > 0
    ? Math.round(habits.reduce((sum, h) => sum + getCompletionRate(h.id, logs, h), 0) / totalHabits)
    : 0;
  const bestStreak = totalHabits > 0
    ? Math.max(...habits.map((h) => getLongestStreak(h.id, logs)))
    : 0;

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-5 pt-12">
        <div className="animate-fade-up-blur">
          <p className="text-[13px] text-muted-foreground font-medium">Your progress</p>
          <h1 className="text-2xl font-semibold text-foreground mt-0.5 tracking-tight" style={{ lineHeight: "1.2" }}>
            Insights
          </h1>
        </div>

        {habits.length === 0 ? (
          <div className="text-center py-20 animate-fade-up-blur" style={{ animationDelay: "80ms" }}>
            <div className="w-20 h-20 rounded-3xl bg-accent/40 flex items-center justify-center mx-auto mb-5">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-foreground font-semibold text-lg">No insights yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[240px] mx-auto" style={{ textWrap: "pretty" }}>
              Add a habit and start logging to see your data here
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl bg-card shadow-[0_1px_4px_0_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] p-5 animate-fade-up-blur" style={{ animationDelay: "60ms" }}>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">{todayCompleted}/{totalHabits}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Today</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-2xl font-semibold text-primary tabular-nums">{avgRate}%</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Avg. rate</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">{bestStreak}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Best streak</p>
                </div>
              </div>
            </div>

            {habits.map((habit, i) => {
              const streak = getStreak(habit.id, logs);
              const longest = getLongestStreak(habit.id, logs);
              const rate = getCompletionRate(habit.id, logs, habit);
              const totalCompletions = logs.filter((l) => l.habitId === habit.id).length;

              return (
                <div
                  key={habit.id}
                  className="relative rounded-2xl bg-card shadow-[0_1px_4px_0_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)] overflow-hidden animate-fade-up-blur"
                  style={{ animationDelay: `${(i + 1) * 80}ms` }}
                >
                  <div
                    className="absolute left-3 top-4 bottom-4 w-1 rounded-full"
                    style={{ backgroundColor: habit.color }}
                  />
                  <div className="p-5 pl-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
                        <h2 className="font-medium text-foreground">{habit.name}</h2>
                      </div>
                      <Sparkline habitId={habit.id} logs={logs} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-muted/60 p-3">
                        <Flame className="w-3.5 h-3.5 text-primary mb-1.5" />
                        <p className="font-mono text-xl font-semibold text-foreground tabular-nums leading-none">{streak}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Current</p>
                      </div>
                      <div className="rounded-xl bg-muted/60 p-3">
                        <Trophy className="w-3.5 h-3.5 text-primary mb-1.5" />
                        <p className="font-mono text-xl font-semibold text-foreground tabular-nums leading-none">{longest}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Best</p>
                      </div>
                      <div className="rounded-xl bg-muted/60 p-3">
                        <TrendingUp className="w-3.5 h-3.5 text-primary mb-1.5" />
                        <p className="font-mono text-xl font-semibold text-foreground tabular-nums leading-none">{rate}%</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Rate</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Last 30 days</p>
                      <CalendarHeatmap habitId={habit.id} logs={logs} color={habit.color} />
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {totalCompletions} total completion{totalCompletions !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav onAddClick={() => setSheetOpen(true)} />
      <AddHabitSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={handleAdd} />
    </div>
  );
}
