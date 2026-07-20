import { z } from "zod";
import { isWishlistStoragePath } from "@/lib/wishlist/images";

const optionalInviteEmail = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim().toLowerCase();
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().email("Enter a valid email").optional()
);

const optionalInvitePhone = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number")
    .optional()
);

const optionalImageRef = z
  .union([
    z
      .string()
      .refine(
        (value) => {
          if (value === "") {
            return true;
          }

          if (isWishlistStoragePath(value)) {
            return true;
          }

          return z.string().url().safeParse(value).success;
        },
        { message: "Enter a valid image URL" }
      ),
    z.null(),
  ])
  .optional()
  .transform((value) => (value ? value : null));

const optionalPositivePrice = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value == null || value === "") {
      return;
    }

    const price =
      typeof value === "number" ? value : Number(value.trim());

    if (!Number.isFinite(price)) {
      ctx.addIssue({
        code: "custom",
        message: "Price must be a number",
      });
      return;
    }

    if (price < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Price must be a positive number",
      });
    }
  })
  .transform((value) => {
    if (value == null || value === "") {
      return null;
    }

    const price = typeof value === "number" ? value : Number(value.trim());

    return price === 0 ? null : price;
  });

const optionalDescription = z
  .union([
    z.string().trim().max(500, "Keep description under 500 characters"),
    z.null(),
  ])
  .optional()
  .transform((value) => value || null);

const wishlistItemDetailsSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  image_url: optionalImageRef,
  price: optionalPositivePrice,
  description: optionalDescription,
});

export const externalWishlistItemSchema = wishlistItemDetailsSchema.extend({
  origin: z.literal("external"),
  // Manual external items still require a source URL because the DB constraint
  // requires product_url whenever origin = external.
  product_url: z.string().url("Enter a valid product URL"),
  scraped_currency: z.string().trim().max(10).optional().nullable(),
  is_exclusive: z.boolean().optional().default(false),
});

export const catalogWishlistItemSchema = wishlistItemDetailsSchema.extend({
  origin: z.literal("catalog"),
  catalog_product_id: z.string().trim().min(1).max(200),
  is_exclusive: z.boolean().optional().default(false),
});

export const wishlistItemCreateSchema = z.discriminatedUnion("origin", [
  externalWishlistItemSchema,
  catalogWishlistItemSchema,
]).superRefine((value, ctx) => {
  if (value.origin === "catalog" && typeof value.price !== "number") {
    ctx.addIssue({
      code: "custom",
      message: "Catalog items require a current display price.",
      path: ["price"],
    });
  }
});

export const editWishlistItemSchema = wishlistItemDetailsSchema.partial();

export const reorderWishlistItemsSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1),
});

export const wishlistTitleSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").max(100),
});

export const wishlistUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(100).optional(),
    visibility: z.enum(["private", "friends_family", "public"]).optional(),
    prices_visible: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.visibility !== undefined ||
      value.prices_visible !== undefined,
    { message: "Provide something to update" }
  );

export const inviteWishlistViewerSchema = z
  .object({
    invitee_email: optionalInviteEmail,
    invitee_phone: optionalInvitePhone,
  })
  .refine(
    (value) => Boolean(value.invitee_email || value.invitee_phone),
    { message: "Enter an email or phone number" }
  );

export const purchaseConfirmationSchema = z.object({
  wishlist_item_id: z.string().uuid(),
});

export const scrapeRequestSchema = z.object({
  url: z.string().url("Enter a valid URL"),
});

export type ExternalWishlistItemFormValues = z.input<
  typeof externalWishlistItemSchema
>;
export type ExternalWishlistItemInput = z.output<typeof externalWishlistItemSchema>;
export type CatalogWishlistItemInput = z.output<typeof catalogWishlistItemSchema>;
export type EditWishlistItemFormValues = z.input<typeof editWishlistItemSchema>;
export type EditWishlistItemInput = z.output<typeof editWishlistItemSchema>;
export type InviteWishlistViewerInput = z.input<
  typeof inviteWishlistViewerSchema
>;
export type InviteWishlistViewer = z.output<typeof inviteWishlistViewerSchema>;
