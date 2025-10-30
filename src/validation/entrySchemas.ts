import { z } from "zod";

export const createEntrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["MOVIE", "TV_SHOW"], { required_error: "Type is required" }),
  director: z.string().optional(),
  budget: z.string().optional(),
  location: z.string().optional(),

  
  durationMin: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val === undefined ? undefined : String(val).trim())),

  
  year: z.coerce
    .number()
    .int()
    .optional()
    .nullable(),

  
  details: z
    .union([z.string(), z.null()])
    .optional()
    .transform((val) => (val === null ? "" : val?.trim?.() || "")),
});

export const updateEntrySchema = createEntrySchema.partial();
