import { defineField, defineType } from "sanity";

export const attributeOption = defineType({
  name: "attributeOption",
  title: "Attribute option",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "value",
      title: "Value",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "colorHex",
      title: "Color hex",
      type: "string",
      description: "Optional swatch value for color-like options.",
    }),
  ],
  preview: {
    select: {
      title: "label",
      subtitle: "value",
    },
  },
});
