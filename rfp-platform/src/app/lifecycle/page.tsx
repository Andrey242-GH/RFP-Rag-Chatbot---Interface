import { AppShell } from "@/components/layout/app-shell";
import { LifecycleDashboard } from "@/components/dashboard/lifecycle-dashboard";

export const metadata = {
  title: "Proposal Lifecycle — RFP Platform",
};

export default function LifecyclePage() {
  return (
    <AppShell>
      <LifecycleDashboard />
    </AppShell>
  );
}
