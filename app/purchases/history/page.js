import PurchasesHistoryClient from "./purchases-history-client";
import { requireAuth } from "@/lib/auth";

export default async function PurchasesHistoryPage() {
  await requireAuth({ roles: ["admin", "employee"] });
  return <PurchasesHistoryClient />;
}
