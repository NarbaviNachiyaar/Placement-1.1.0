import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  Clock,
  Search as SearchIcon,
  Users,
} from "lucide-react";
import { db } from "@/lib/data/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const RECENT_KEY = "placement-crm:recent-searches:v1";
const RECENT_LIMIT = 6;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    const current = loadRecent().filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...current].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable — recent search history just won't persist */
  }
}

type CompanyHit = { id: string; name: string; industry: string | null; location: string | null };
type ContactHit = { id: string; name: string; designation: string | null; company_id: string };
type TaskHit = { id: string; title: string; status: string; priority: string };
type FollowupHit = { id: string; message: string | null; company_id: string; status: string };
type MemberHit = { id: string; full_name: string | null; email: string; department: string | null };

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [companies, setCompanies] = useState<CompanyHit[]>([]);
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [tasks, setTasks] = useState<TaskHit[]>([]);
  const [followups, setFollowups] = useState<FollowupHit[]>([]);
  const [members, setMembers] = useState<MemberHit[]>([]);

  // Ctrl/Cmd+K opens the palette from anywhere in the app.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setCompanies([]);
      setContacts([]);
      setTasks([]);
      setFollowups([]);
      setMembers([]);
      return;
    }
    const handle = setTimeout(async () => {
      const like = `%${term}%`;
      const [c, ct, t, f, m] = await Promise.all([
        db
          .from("companies")
          .select("id,name,industry,location")
          .is("deleted_at", null)
          .or(`name.ilike.${like},industry.ilike.${like},location.ilike.${like}`)
          .limit(6),
        db
          .from("contacts")
          .select("id,name,designation,company_id")
          .or(`name.ilike.${like},designation.ilike.${like},email.ilike.${like}`)
          .limit(6),
        db.from("tasks").select("id,title,status,priority").ilike("title", like).limit(6),
        db
          .from("followups")
          .select("id,message,company_id,status")
          .ilike("message", like)
          .limit(6),
        db
          .from("profiles")
          .select("id,full_name,email,department")
          .or(`full_name.ilike.${like},email.ilike.${like},department.ilike.${like}`)
          .limit(6),
      ]);
      setCompanies((c.data as CompanyHit[]) ?? []);
      setContacts((ct.data as ContactHit[]) ?? []);
      setTasks((t.data as TaskHit[]) ?? []);
      setFollowups((f.data as FollowupHit[]) ?? []);
      setMembers((m.data as MemberHit[]) ?? []);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function go(path: string, params?: Record<string, string>) {
    saveRecent(query);
    setOpen(false);
    setQuery("");
    navigate(params ? { to: path, params } : { to: path });
  }

  const hasResults =
    companies.length + contacts.length + tasks.length + followups.length + members.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-xl items-center gap-2 rounded-xl border border-transparent bg-muted/70 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search companies, contacts, tasks, people…</span>
        <kbd className="hidden shrink-0 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
          {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search everything…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2 ? "Type at least 2 characters to search." : "No results found."}
          </CommandEmpty>

          {query.trim().length < 2 && recent.length > 0 && (
            <>
              <CommandGroup heading="Recent searches">
                {recent.map((term) => (
                  <CommandItem key={term} onSelect={() => setQuery(term)}>
                    <Clock className="mr-2 size-4 text-muted-foreground" />
                    {term}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {companies.length > 0 && (
            <CommandGroup heading="Companies">
              {companies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`company-${c.id}-${c.name}`}
                  onSelect={() => go("/companies/$companyId", { companyId: c.id })}
                >
                  <Building2 className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.industry ?? c.location ?? ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {contacts.length > 0 && (
            <CommandGroup heading="Contacts">
              {contacts.map((ct) => (
                <CommandItem
                  key={ct.id}
                  value={`contact-${ct.id}-${ct.name}`}
                  onSelect={() => go("/companies/$companyId", { companyId: ct.company_id })}
                >
                  <Users className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1">{ct.name}</span>
                  <span className="text-xs text-muted-foreground">{ct.designation ?? ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {tasks.length > 0 && (
            <CommandGroup heading="Tasks">
              {tasks.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task-${t.id}-${t.title}`}
                  onSelect={() => go("/tasks")}
                >
                  <ClipboardList className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1">{t.title}</span>
                  <span className="text-xs capitalize text-muted-foreground">{t.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {followups.length > 0 && (
            <CommandGroup heading="Follow-ups">
              {followups.map((f) => (
                <CommandItem
                  key={f.id}
                  value={`followup-${f.id}-${f.message ?? ""}`}
                  onSelect={() => go("/companies/$companyId", { companyId: f.company_id })}
                >
                  <CalendarClock className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.message ?? "Follow-up"}</span>
                  <span className="text-xs capitalize text-muted-foreground">{f.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {members.length > 0 && (
            <CommandGroup heading="People">
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`member-${m.id}-${m.full_name ?? m.email}`}
                  onSelect={() => go("/team")}
                >
                  <Users className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1">{m.full_name ?? m.email}</span>
                  <span className="text-xs text-muted-foreground">{m.department ?? ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!hasResults && query.trim().length >= 2 && null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
