import { BasketIcon } from "@sanity/icons";
import { defineArrayMember, defineField, defineType } from "sanity";

export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  icon: BasketIcon,
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "catalog", title: "Catalog" },
    { name: "variants", title: "Pricing & variants" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "content",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "Active", value: "active" },
          { title: "Draft", value: "draft" },
          { title: "Archived", value: "archived" },
        ],
        layout: "radio",
      },
      initialValue: "draft",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      group: "content",
      initialValue: false,
    }),
    defineField({
      name: "shortDescription",
      title: "Short description",
      type: "text",
      rows: 2,
      group: "content",
      validation: (rule) => rule.max(180).warning("Keep card copy short."),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: "images",
      title: "Images",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt text",
              type: "string",
            }),
          ],
        }),
      ],
      validation: (rule) => rule.max(8),
    }),
    defineField({
      name: "supplier",
      title: "Supplier",
      type: "reference",
      group: "catalog",
      to: [{ type: "supplier" }],
    }),
    defineField({
      name: "collections",
      title: "Collections",
      type: "array",
      group: "catalog",
      of: [defineArrayMember({ type: "reference", to: [{ type: "collection" }] })],
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      group: "catalog",
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      group: "catalog",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.unique(),
    }),
    defineField({
      name: "supplierProductId",
      title: "Supplier product ID",
      type: "string",
      group: "catalog",
    }),
    defineField({
      name: "estimatedDeliveryDays",
      title: "Estimated delivery",
      type: "string",
      group: "catalog",
      initialValue: "5-10 days",
    }),
    defineField({
      name: "hasVariants",
      title: "Has variants",
      type: "boolean",
      group: "variants",
      initialValue: false,
    }),
    defineField({
      name: "basePrice",
      title: "Base price (NGN)",
      type: "number",
      group: "variants",
      hidden: ({ parent }) => parent?.hasVariants === true,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "compareAtPrice",
      title: "Compare-at price (NGN)",
      type: "number",
      group: "variants",
      hidden: ({ parent }) => parent?.hasVariants === true,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "baseSku",
      title: "Base SKU",
      type: "string",
      group: "variants",
      hidden: ({ parent }) => parent?.hasVariants === true,
    }),
    defineField({
      name: "attributes",
      title: "Attributes",
      type: "array",
      group: "variants",
      of: [defineArrayMember({ type: "variantAttribute" })],
      hidden: ({ parent }) => parent?.hasVariants !== true,
    }),
    defineField({
      name: "variants",
      title: "Variants",
      type: "array",
      group: "variants",
      of: [defineArrayMember({ type: "productVariant" })],
      hidden: ({ parent }) => parent?.hasVariants !== true,
    }),
    defineField({
      name: "salePrice",
      title: "Flash sale price (NGN)",
      type: "number",
      group: "variants",
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "saleStartTime",
      title: "Sale start time",
      type: "datetime",
      group: "variants",
    }),
    defineField({
      name: "saleEndTime",
      title: "Sale end time",
      type: "datetime",
      group: "variants",
      validation: (rule) =>
        rule.custom((endTime, context) => {
          const startTime = context.document?.saleStartTime as string | undefined;

          if (startTime && endTime && new Date(endTime) < new Date(startTime)) {
            return "Sale end time must be after sale start time.";
          }

          return true;
        }),
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "category",
      media: "images.0",
    },
  },
});
