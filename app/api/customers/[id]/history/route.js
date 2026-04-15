import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth";
import { ApiError, handleRouteError, sumMoney } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET(request, context) {
  const authResult = await requireApiAuth(request, { roles: ["admin", "employee"] });

  if (authResult.error) {
    return authResult.error;
  }

  try {
    const customerId = context?.params?.id;

    if (!customerId) {
      throw new ApiError("Customer ID is required.", 400);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                gstAmount: true,
                total: true,
              },
            },
          },
        },
        serviceJobs: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                total: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new ApiError("Customer not found.", 404);
    }

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      summary: {
        invoiceCount: customer.invoices.length,
        serviceCount: customer.serviceJobs.length,
        invoiceRevenue: sumMoney(customer.invoices.map((invoice) => invoice.totalAmount)).toFixed(2),
        serviceRevenue: sumMoney(customer.serviceJobs.map((job) => job.totalAmount)).toFixed(2),
        invoiceProfit: sumMoney(customer.invoices.map((invoice) => invoice.profitAmount)).toFixed(2),
        serviceProfit: sumMoney(customer.serviceJobs.map((job) => job.profitAmount)).toFixed(2),
        totalProfit: (
          sumMoney(customer.invoices.map((invoice) => invoice.profitAmount)) +
          sumMoney(customer.serviceJobs.map((job) => job.profitAmount))
        ).toFixed(2),
      },
      invoices: customer.invoices,
      serviceJobs: customer.serviceJobs,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load customer history.");
  }
}
