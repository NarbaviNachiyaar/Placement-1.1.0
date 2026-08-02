import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PasswordSetupCard } from "@/components/crm/password-setup-card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/set-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create a password — Placement CRM" },
      {
        name: "description",
        content: "Set a password so you can sign in without a one-time code next time.",
      },
      { property: "og:title", content: "Create a password — Placement CRM" },
      {
        property: "og:description",
        content: "Set a password so you can sign in without a one-time code next time.",
      },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [session, loading, navigate]);

  return (
    <PasswordSetupCard
      title="Create your password"
      subtitle="From now on you can sign in with just your email and this password."
      cta="Save password"
      onDone={() => navigate({ to: "/dashboard", replace: true })}
      secondary={{
        label: "Skip for now",
        onClick: () => navigate({ to: "/dashboard", replace: true }),
      }}
    />
  );
}
