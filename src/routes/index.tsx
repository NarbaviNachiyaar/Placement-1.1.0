import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Building2, Mic, ShieldCheck, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Placement CRM — Campus Recruitment Command Center" },
      {
        name: "description",
        content:
          "A secure, invite-only CRM for Training & Placement cells: company outreach, HR contacts, follow-ups, voice notes, reminders and analytics.",
      },
      { property: "og:title", content: "Placement CRM — Campus Recruitment Command Center" },
      {
        property: "og:description",
        content:
          "Manage company outreach, HR contacts, follow-ups and campus drives in one premium placement workspace.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Building2,
    title: "Company pipeline",
    body: "Track every recruiter from first contact to campus drive with status, owners and full history.",
  },
  {
    icon: Mic,
    title: "Voice follow-ups",
    body: "Speak your call summary — it becomes an editable transcript attached to the follow-up.",
  },
  {
    icon: BarChart3,
    title: "Placement analytics",
    body: "Response rates, industry mix, coordinator workload and drive conversion at a glance.",
  },
  {
    icon: ShieldCheck,
    title: "Invite-only access",
    body: "Passwordless email OTP plus an approved-user whitelist and five granular roles.",
  },
];

function Landing() {
  return (
    <main className="gradient-mesh min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="gradient-brand flex size-10 items-center justify-center rounded-xl shadow-elevated">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <span className="text-base font-bold tracking-tight">Placement CRM</span>
        </div>
        <Button asChild>
          <Link to="/auth">
            Sign in <ArrowRight className="ml-1.5 size-4" />
          </Link>
        </Button>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-16 text-center md:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mx-auto mb-6 w-fit rounded-full px-4 py-1.5 text-xs font-semibold text-primary"
        >
          Built for Training &amp; Placement Offices
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl"
        >
          Every recruiter conversation,{" "}
          <span className="text-gradient">in one placement workspace</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg"
        >
          Company outreach, HR contacts, follow-ups, voice notes, reminders, assignments and campus
          drive analytics — secured behind passwordless OTP and role-based access.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex justify-center"
        >
          <Button size="lg" asChild className="rounded-xl px-7">
            <Link to="/auth">
              Enter the workspace <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <motion.article
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="glass rounded-2xl p-6 shadow-soft"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="size-5" />
            </span>
            <h2 className="mt-4 text-sm font-bold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </motion.article>
        ))}
      </section>
    </main>
  );
}
