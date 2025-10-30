"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
function validateBody(schema) {
    return (req, res, next) => {
        try {
            const parsed = schema.parse(req.body);
            req.body = parsed;
            next();
        }
        catch (err) {
            return res.status(400).json({ message: "Validation failed", errors: err.errors || err });
        }
    };
}
