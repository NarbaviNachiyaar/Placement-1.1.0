import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, GraduationCap, Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { auth } from "@/lib/data/auth";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Placement CRM" },
      {
        name: "description",
        content: "Password or email OTP sign-in for approved placement cell members.",
      },
      { property: "og:title", content: "Sign in — Placement CRM" },
      {
        property: "og:description",
        content: "Password or email OTP sign-in for approved placement cell members.",
      },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(200);

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [step, setStep] = useState<"email" | "password" | "otp">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, loading, navigate]);

  useEffect(() => () => void (timerRef.current && clearInterval(timerRef.current)), []);

  function startCountdown() {
    setCountdown(60);
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          timerRef.current && clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function checkApproved() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return null;
    }
    const approved = await auth.isApproved(parsed.data);
    if (!approved) {
      setError("Your account is not authorized. Please contact the administrator.");
      return null;
    }
    return parsed.data;
  }

  async function continueWithEmail() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const value = await checkApproved();
      if (!value) return;
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: signInError } = await auth.signInWithPassword(email.trim(), password);
      if (signInError) {
        setError(signInError);
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(resend = false) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const value = await checkApproved();
      if (!value) return;
      const { error: otpError } = await auth.sendOtp(value);
      if (otpError) {
        setError(otpError);
        return;
      }
      setStep("otp");
      setCode("");
      startCountdown();
      setNotice(
        `${resend ? "New code sent" : "Code sent"} to ${value}. Check your inbox for the 6-digit code.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const value = await checkApproved();
      if (!value) return;
      const { error: resetError } = await auth.resetPasswordForEmail(value);
      if (resetError) {
        setError(resetError);
        return;
      }
      setNotice(`Password reset link sent to ${value}. Check your inbox to continue.`);
      setStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(token: string) {
    setError(null);
    setBusy(true);
    try {
      const value = email.trim();
      const { error: signInError } = await auth.verifyOtp(value, token);
      if (signInError) {
        setError(signInError);
        setCode("");
        return;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setCode("");
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
        <Link to="/" className="mb-8 flex items-center gap-3">
          <div className="gradient-brand flex size-10 items-center justify-center rounded-xl">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-tight">Placement CRM</span>
        </Link>

        <AnimatePresence mode="wait">
          {step === "email" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="space-y-5"
            >
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Access is invite-only. Enter your approved institute email to continue.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void continueWithEmail();
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@institute.edu"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
                <Button type="submit" className="h-11 w-full rounded-xl" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Continue
                </Button>
              </form>
            </motion.div>
          ) : step === "password" ? (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-5"
            >
              <button
                onClick={() => {
                  setStep("email");
                  setError(null);
                  setNotice(null);
                  setPassword("");
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Use a different email
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Enter your password</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Signing in as <span className="font-medium">{email}</span>. First time here? Use a
                  one-time code and you&apos;ll be asked to create a password.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void signInWithPassword();
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-xl"
                  disabled={busy || password.length < 1}
                >
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>

              <div className="flex items-center justify-between text-xs">
                <button
                  className="font-semibold text-primary hover:underline"
                  disabled={busy}
                  onClick={() => void sendOtp()}
                >
                  Sign in with a one-time code
                </button>
                <button
                  className="font-medium text-muted-foreground hover:text-foreground"
                  disabled={busy}
                  onClick={() => void forgotPassword()}
                >
                  Forgot password?
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-5"
            >
              <button
                onClick={() => {
                  setStep("password");
                  setError(null);
                  setNotice(null);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Enter your code</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium">{email}</span>.
                </p>
              </div>

              <div className="flex justify-center py-2">
                <InputOTP
                  maxLength={6}
                  value={code}
                  autoFocus
                  onChange={(value) => {
                    setCode(value);
                    if (value.length === 6) void verify(value);
                  }}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                className="h-11 w-full rounded-xl"
                disabled={busy || code.length !== 6}
                onClick={() => void verify(code)}
              >
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Verify &amp; continue
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                {countdown > 0 ? (
                  <span>Resend available in {countdown}s</span>
                ) : (
                  <button
                    className="font-semibold text-primary hover:underline"
                    onClick={() => void sendOtp(true)}
                  >
                    Resend code
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {notice && !error && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-xs text-success">
            <MailCheck className="mt-0.5 size-4 shrink-0" /> {notice}
          </p>
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
