import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PasswordSetupCard } from "@/components/crm/password-setup-card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Placement CRM" },
      {
        name: "description",
        content: "Choose a new password for your Placement CRM account.",
      },
      { property: "og:title", content: "Reset password — Placement CRM" },
      {
        property: "og:description",
        content: "Choose a new password for your Placement CRM account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  return (
    <PasswordSetupCard
      title="Set a new password"
      subtitle="Enter a new password for your account. You'll use it to sign in from now on."
      cta="Update password"
      onDone={() => navigate({ to: "/dashboard", replace: true })}
      secondary={{ label: "Back to sign in", onClick: () => navigate({ to: "/auth" }) }}
    />
  );
}
