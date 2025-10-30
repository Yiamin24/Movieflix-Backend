"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEntrySchema = exports.createEntrySchema = void 0;
const zod_1 = require("zod");
exports.createEntrySchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    type: zod_1.z.enum(["MOVIE", "TV_SHOW"], { required_error: "Type is required" }),
    director: zod_1.z.string().optional(),
    budget: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    durationMin: zod_1.z
        .union([zod_1.z.string(), zod_1.z.number()])
        .optional()
        .transform((val) => (val === undefined ? undefined : String(val).trim())),
    year: zod_1.z.coerce
        .number()
        .int()
        .optional()
        .nullable(),
    details: zod_1.z
        .union([zod_1.z.string(), zod_1.z.null()])
        .optional()
        .transform((val) => (val === null ? "" : val?.trim?.() || "")),
});
exports.updateEntrySchema = exports.createEntrySchema.partial();
