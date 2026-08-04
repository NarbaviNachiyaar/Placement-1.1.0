import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { runReminderCheck } from "@/lib/reminders";
import { AppSidebar } from "@/components/crm/app-sidebar";
import { TopBar } from "@/components/crm/top-bar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AppShell,
});

function AppShell() {
  const { session, loading, user } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  // Offline detection — a banner beats silently-failing requests.
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Reminder engine — checks once per sign-in for overdue/due-today
  // follow-ups and tasks assigned to this user.
  useEffect(() => {
    if (user?.id) void runReminderCheck(user.id);
  }, [user?.id]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <AppSidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-destructive py-1.5 text-xs font-medium text-destructive-foreground">
            <WifiOff className="size-3.5" /> You&apos;re offline — changes won&apos;t save until you&apos;re back online.
          </div>
        )}
        <TopBar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
