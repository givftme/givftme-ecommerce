import { defineArrayMember, defineField, defineType } from "sanity";

export const variantAttribute = defineType({
  name: "variantAttribute",
  title: "Variant attribute",
  type: "object",
  fields: [
    defineField({
      name: "name",
      title: "Machine name",
      type: "string",
      description: "Lowercase key used in variant combinations, e.g. size.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "label",
      title: "Display label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "options",
      title: "Options",
      type: "array",
      of: [defineArrayMember({ type: "attributeOption" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      title: "label",
    },
  },
});
