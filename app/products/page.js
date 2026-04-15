import ProductsClient from "./products-client";
import { requireAuth } from "@/lib/auth";

export default async function ProductsPage() {
  await requireAuth({ roles: ["admin", "employee"] });
  return <ProductsClient />;
}
