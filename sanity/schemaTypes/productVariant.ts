import { defineArrayMember, defineField, defineType } from "sanity";

export const productVariant = defineType({
  name: "productVariant",
  title: "Product variant",
  type: "object",
  fields: [
    defineField({
      name: "combinationKey",
      title: "Combination key",
      type: "string",
      description: "Stable key such as size:medium|color:red.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "options",
      title: "Selected options",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "attribute",
              title: "Attribute",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "value",
              title: "Value",
              type: "string",
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: {
              title: "attribute",
              subtitle: "value",
            },
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "price",
      title: "Price (NGN)",
      type: "number",
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: "compareAtPrice",
      title: "Compare-at price (NGN)",
      type: "number",
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "sku",
      title: "SKU",
      type: "string",
    }),
    defineField({
      name: "supplierSku",
      title: "Supplier SKU",
      type: "string",
    }),
    defineField({
      name: "supplierProductId",
      title: "Supplier product ID",
      type: "string",
    }),
    defineField({
      name: "available",
      title: "Available",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "image",
      title: "Variant image",
      type: "image",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      title: "combinationKey",
      subtitle: "price",
      media: "image",
    },
  },
});
