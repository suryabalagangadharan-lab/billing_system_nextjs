import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  await requireAuth({ roles: ["admin", "employee"] });
  redirect("/");
}
