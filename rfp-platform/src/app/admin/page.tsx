import { AppShell } from "@/components/layout/app-shell";
import { AdminPortal } from "@/components/admin/admin-portal";

export const metadata = {
  title: "Admin — RFP Platform",
};

export default function AdminPage() {
  return (
    <AppShell>
      <AdminPortal />
    </AppShell>
  );
}
