// global.d.ts (project root)
// Add ambient module declarations for packages missing type defs in your build environment
declare module "jsonwebtoken";
declare module "bcryptjs";
declare module "multer";
declare module "swagger-jsdoc";
declare module "swagger-ui-express";
declare module "@getbrevo/brevo";

// Augment Express Request so `req.user` is allowed (optional).
// This prevents the "Property 'user' does not exist on type 'Request'" issues.
import * as express from "express";

declare global {
  namespace Express {
    interface Request {
      // keep optional so Express.Request remains compatible with handlers
      user?: {
        id?: number;
        email?: string;
        role?: string;
        [key: string]: any;
      };
      // multer may attach file(s)
      file?: any;
      files?: any;
    }
  }
}
