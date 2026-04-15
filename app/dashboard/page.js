import DashboardClient from "./dashboard-client";
import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  await requireAuth({ roles: ["admin", "employee"] });
  return <DashboardClient />;
}
