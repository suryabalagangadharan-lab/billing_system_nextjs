import ReportsClient from "./reports-client";
import { requireAuth } from "@/lib/auth";

export default async function ReportsPage() {
  await requireAuth({ roles: ["admin"] });
  return <ReportsClient />;
}
