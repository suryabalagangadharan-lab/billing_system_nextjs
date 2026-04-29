import PurchasesClient from "./purchases-client";
import { requireAuth } from "@/lib/auth";

export default async function PurchasesPage() {
  await requireAuth({ roles: ["admin", "employee"] });
  return <PurchasesClient />;
}
