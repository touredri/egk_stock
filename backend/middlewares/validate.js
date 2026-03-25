function requireFields(fieldNames) {
  return (req, res, next) => {
    const missing = fieldNames.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Champs obligatoires manquants.',
          details: missing
        }
      });
    }

    next();
  };
}

module.exports = { requireFields };
