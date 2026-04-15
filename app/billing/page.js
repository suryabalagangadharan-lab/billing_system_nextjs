import BillingClient from "./billing-client";
import { requireAuth } from "@/lib/auth";

export default async function BillingPage() {
  await requireAuth({ roles: ["admin", "employee"] });
  return <BillingClient />;
}
