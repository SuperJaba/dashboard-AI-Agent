/**
 * Express middleware factory — validates req.body against a Zod schema.
 * Returns uniform 400 JSON errors on failure.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'Nieprawidłowe dane wejściowe', errors });
    }
    req.body = result.data;
    next();
  };
}
