import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import InvoicePrint from "@/components/invoice-print";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params, searchParams }) {
  await requireAuth();

  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const id = resolvedParams?.id;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      billedBy: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });

  if (!invoice) {
    return <div className="p-6">Invoice not found.</div>;
  }

  // Pass invoice data to client component for print handling
  const invoiceData = JSON.parse(JSON.stringify({
    ...invoice,
    labourCharge: Number(invoice.totalAmount || 0) - Number(invoice.subtotal || 0) - Number(invoice.gstAmount || 0),
  }));

  return <InvoicePrint invoice={invoiceData} autoPrint={Boolean(resolvedSearch?.print)} />;
}
