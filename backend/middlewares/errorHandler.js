function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Ressource introuvable.'
    }
  });
}

function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Erreur interne serveur.';

  if (!err.status && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    status = 409;
    code = 'DATA_CONSTRAINT_ERROR';
    message = 'Contrainte de données violée (doublon ou relation invalide).';
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: err.details || null
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
