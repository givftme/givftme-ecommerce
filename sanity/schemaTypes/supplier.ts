import { ComposeIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const supplier = defineType({
  name: "supplier",
  title: "Supplier",
  type: "document",
  icon: ComposeIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "supplierType",
      title: "Supplier type",
      type: "string",
      options: {
        list: [
          { title: "Spocket", value: "spocket" },
          { title: "CJDropshipping", value: "cj_dropshipping" },
          { title: "Manual", value: "manual" },
        ],
        layout: "radio",
      },
      initialValue: "manual",
    }),
    defineField({
      name: "website",
      title: "Website",
      type: "url",
      validation: (rule) =>
        rule.uri({ scheme: ["http", "https"] }).warning("Use a valid URL."),
    }),
    defineField({
      name: "contactEmail",
      title: "Contact email",
      type: "string",
      validation: (rule) => rule.email().warning("Use a valid email address."),
    }),
    defineField({
      name: "notes",
      title: "Internal notes",
      type: "text",
      rows: 3,
    }),
  ],
});
