import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/crm/app-sidebar";
import { TopBar } from "@/components/crm/top-bar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AppShell,
});

function AppShell() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

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
        <TopBar onOpenSidebar={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
