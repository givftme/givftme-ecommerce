import { CalendarIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const occasion = defineType({
  name: "occasion",
  title: "Museum occasion",
  type: "document",
  icon: CalendarIcon,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
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
      name: "occasionType",
      title: "Occasion type",
      type: "string",
      options: {
        list: [
          { title: "Birthday", value: "birthday" },
          { title: "Wedding", value: "wedding" },
          { title: "Anniversary", value: "anniversary" },
          { title: "Baby Shower", value: "baby_shower" },
          { title: "Graduation", value: "graduation" },
          { title: "Other", value: "other" },
        ],
      },
      initialValue: "birthday",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "emoji",
      title: "Emoji",
      type: "string",
      initialValue: "🎁",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "featured",
      title: "Featured",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "orderRank",
      title: "Display order",
      type: "number",
      initialValue: 0,
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "occasionType",
      media: "coverImage",
    },
  },
});
