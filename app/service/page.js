import ServiceClient from "./service-client";
import { requireAuth } from "@/lib/auth";

export default async function ServicePage() {
  await requireAuth({ roles: ["admin", "employee"] });
  return <ServiceClient />;
}
