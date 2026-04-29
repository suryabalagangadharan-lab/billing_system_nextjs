import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const requiredString = (fieldName) =>
  z.string().trim().min(1, `${fieldName} is required.`);

const moneyLike = (fieldName) =>
  z.union([z.string(), z.number()]).refine((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, `${fieldName} must be a valid non-negative number.`);

const intLike = (fieldName, minimum = 0) =>
  z.union([z.string(), z.number()]).refine((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= minimum;
  }, `${fieldName} must be an integer${minimum > 0 ? ` greater than or equal to ${minimum}` : ""}.`);

export const loginSchema = z.object({
  username: requiredString("Username"),
  password: requiredString("Password"),
});

export const productCreateSchema = z.object({
  name: requiredString("Name"),
  sku: optionalTrimmedString,
  description: optionalTrimmedString,
  unitPrice: moneyLike("Unit price"),
  gstRate: moneyLike("GST rate").optional(),
  costPrice: moneyLike("Cost price").optional(),
  stock: intLike("Stock", 0).optional(),
  brandId: optionalTrimmedString,
  brandName: optionalTrimmedString,
});

export const purchaseCreateSchema = z.object({
  productId: requiredString("Product ID"),
  quantity: intLike("Quantity", 1),
  unitCost: moneyLike("Unit cost"),
  supplierName: optionalTrimmedString,
  notes: optionalTrimmedString,
});

const purchaseLineItemSchema = z.object({
  productId: requiredString("Product"),
  quantity: intLike("Quantity", 1),
  purchasePrice: moneyLike("Purchase price"),
  discountAmount: moneyLike("Discount amount").optional(),
  gstRate: moneyLike("GST rate").optional(),
});

export const purchaseGroupCreateSchema = z.object({
  warehouse: requiredString("Warehouse"),
  supplierName: requiredString("Supplier name"),
  referenceNo: optionalTrimmedString,
  purchaseDate: optionalTrimmedString,
  note: optionalTrimmedString,
  otherCharges: moneyLike("Other charges").optional(),
  discountOnAll: moneyLike("Discount on all").optional(),
  roundOff: moneyLike("Round off").optional(),
  items: z.array(purchaseLineItemSchema).min(1, "At least one purchase item is required."),
});

export const purchaseGroupUpdateSchema = purchaseGroupCreateSchema.extend({
  items: z.array(
    purchaseLineItemSchema.extend({
      id: optionalTrimmedString,
    })
  ).min(1, "At least one purchase item is required."),
});

export const purchasePaymentSchema = z.object({
  amount: moneyLike("Amount"),
  paymentType: requiredString("Payment type"),
  account: optionalTrimmedString,
  note: optionalTrimmedString,
});

const invoiceItemSchema = z
  .object({
    productId: optionalTrimmedString,
    description: optionalTrimmedString,
    quantity: intLike("Item quantity", 1),
    unitPrice: moneyLike("Item unit price").optional(),
    gstRate: moneyLike("Item GST rate").optional(),
  })
  .superRefine((value, context) => {
    if (!value.productId && !value.description) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Item description is required when productId is not provided.",
        path: ["description"],
      });
    }
  });

export const invoiceCreateSchema = z.object({
  customerName: requiredString("Customer name"),
  customerPhone: optionalTrimmedString,
  customerEmail: optionalTrimmedString,
  status: optionalTrimmedString,
  gstRate: moneyLike("GST rate").optional(),
  labourCharge: moneyLike("Labour charge").optional(),
  taxAmount: moneyLike("Tax amount").optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one invoice item is required."),
});

const serviceItemSchema = z
  .object({
    productId: optionalTrimmedString,
    description: optionalTrimmedString,
    quantity: intLike("Service item quantity", 1),
    unitPrice: moneyLike("Service item unit price").optional(),
  })
  .superRefine((value, context) => {
    if (!value.productId && !value.description) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Service item description is required when productId is not provided.",
        path: ["description"],
      });
    }
  });

export const serviceCreateSchema = z.object({
  customerName: requiredString("Customer name"),
  customerPhone: optionalTrimmedString,
  deviceName: requiredString("Device name"),
  deviceModel: optionalTrimmedString,
  serialNumber: optionalTrimmedString,
  complaint: optionalTrimmedString,
  diagnosis: optionalTrimmedString,
  serviceCharge: moneyLike("Service charge").optional(),
  status: optionalTrimmedString,
  brandId: optionalTrimmedString,
  assignedToId: optionalTrimmedString,
  items: z.array(serviceItemSchema).optional(),
});

export const reportQuerySchema = z.object({
  date: optionalTrimmedString,
  month: optionalTrimmedString,
  lowStockThreshold: intLike("Low stock threshold", 0).optional(),
});
