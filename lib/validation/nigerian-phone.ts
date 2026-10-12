import { z } from "zod";

export const nigerianPhoneSchema = z
  .string()
  .trim()
  .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number");
