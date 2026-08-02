import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/data/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordSetupCard({
  title,
  subtitle,
  cta,
  onDone,
  secondary,
}: {
  title: string;
  subtitle: string;
  cta: string;
  onDone: () => void;
  secondary?: { label: string; onClick: () => void };
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const email = auth.getSession()?.user.email;
      if (!email) throw new Error("Your session expired. Sign in again.");
      const { error: updateError } = auth.setPassword(email, password);
      if (updateError) throw new Error(updateError);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gradient-mesh flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md rounded-3xl p-8 shadow-elevated"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="gradient-brand flex size-10 items-center justify-center rounded-xl">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-tight">Placement CRM</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="mt-1.5 h-11 rounded-xl"
            />
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 size-4" />
            )}
            {cta}
          </Button>
        </form>

        {secondary && (
          <button
            className="mt-4 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={secondary.onClick}
          >
            {secondary.label}
          </button>
        )}

        {error && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}
      </motion.div>
    </main>
  );
}
