import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/data/client";
import { MODE_LABEL, PRIORITY_TONE, titleCase, type Mode, type Priority } from "@/lib/crm";
import { PageHeader } from "@/components/crm/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Placement CRM" },
      { name: "description", content: "Month view of every scheduled recruiter follow-up." },
      { property: "og:title", content: "Calendar — Placement CRM" },
      {
        property: "og:description",
        content: "Month view of every scheduled recruiter follow-up.",
      },
    ],
  }),
  component: CalendarPage,
});

type Row = {
  id: string;
  company_id: string;
  followup_date: string;
  followup_time: string | null;
  mode: Mode;
  priority: Priority;
  status: string;
  companies?: { name: string } | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    db
      .from("followups")
      .select("id,company_id,followup_date,followup_time,mode,priority,status,companies(name)")
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => map.set(r.followup_date, [...(map.get(r.followup_date) ?? []), r]));
    return map;
  }, [rows]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  ];

  const selectedItems = byDate.get(selected) ?? [];

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Plan your recruiter outreach across the month."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-40 text-center text-sm font-semibold">
              {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="glass rounded-2xl p-4 shadow-soft">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-2">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <span key={`e${i}`} />;
              const items = byDate.get(date) ?? [];
              const pending = items.filter((x) => x.status === "pending").length;
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  className={cn(
                    "flex min-h-16 flex-col rounded-xl border p-1.5 text-left transition-colors hover:bg-accent",
                    selected === date && "border-primary bg-primary/10",
                  )}
                >
                  <span className="text-xs font-semibold">{Number(date.slice(-2))}</span>
                  {items.length > 0 && (
                    <span className="mt-auto text-[10px] font-medium text-primary">
                      {items.length} item{items.length > 1 ? "s" : ""}
                      {pending ? ` · ${pending} due` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-4 shadow-soft">
          <h2 className="text-sm font-bold">{selected}</h2>
          {selectedItems.length ? (
            <ul className="mt-3 space-y-2">
              {selectedItems.map((r) => (
                <li key={r.id} className="rounded-xl border p-3">
                  <Link
                    to="/companies/$companyId"
                    params={{ companyId: r.company_id }}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {r.companies?.name ?? "Company"}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {MODE_LABEL[r.mode]}
                    {r.followup_time ? ` · ${r.followup_time.slice(0, 5)}` : ""}
                  </p>
                  <Badge className={cn("mt-2 border-0", PRIORITY_TONE[r.priority])}>
                    {titleCase(r.priority)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">No follow-ups on this day.</p>
          )}
        </section>
      </div>
    </>
  );
}
