const productModel = require('../models/productModel');
const { httpError } = require('../services/httpError');
const { logAudit } = require('../services/auditService');

function parsePage(req) {
  return {
    q: req.query.q || '',
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20)),
    stock_status: req.query.stock_status || ''
  };
}

function validateProductPayload(payload) {
  if (!payload.libelle || payload.libelle.trim() === '') {
    throw httpError(400, 'VALIDATION_ERROR', 'libelle est obligatoire.');
  }

  const pu = Number(payload.pu);
  const stockMin = Number(payload.stock_min);
  const stockMax = Number(payload.stock_max);

  if (!Number.isFinite(pu) || pu <= 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'pu doit être un nombre positif.');
  }

  if (!Number.isInteger(stockMin) || stockMin < 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'stock_min doit être un entier >= 0.');
  }

  if (!Number.isInteger(stockMax) || stockMax < stockMin) {
    throw httpError(400, 'VALIDATION_ERROR', 'stock_max doit être un entier >= stock_min.');
  }

  return { libelle: payload.libelle, pu, stock_min: stockMin, stock_max: stockMax };
}

function getProducts(req, res, next) {
  try {
    const result = productModel.listProducts(parsePage(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

function getProduct(req, res, next) {
  try {
    const product = productModel.getProductById(Number(req.params.id));
    if (!product) throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

function createProduct(req, res, next) {
  try {
    const payload = validateProductPayload(req.body);
    const product = productModel.createProduct(payload);
    logAudit({
      action: 'CREATE_PRODUCT',
      entity_type: 'Product',
      entity_id: product.id_prod,
      detail: `${product.libelle} créé`
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

function updateProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const exists = productModel.getProductById(id);
    if (!exists) throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');

    const payload = validateProductPayload(req.body);
    const product = productModel.updateProduct(id, payload);
    logAudit({
      action: 'UPDATE_PRODUCT',
      entity_type: 'Product',
      entity_id: id,
      detail: `${product.libelle} mis à jour`
    });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

function deleteProduct(req, res, next) {
  try {
    const id = Number(req.params.id);
    const exists = productModel.getProductById(id);
    if (!exists) throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');

    if (productModel.hasRelatedData(id)) {
      throw httpError(
        409,
        'PRODUCT_HAS_HISTORY',
        'Suppression impossible: le produit est lié à des mouvements ou commandes.'
      );
    }

    productModel.deleteProduct(id);
    logAudit({
      action: 'DELETE_PRODUCT',
      entity_type: 'Product',
      entity_id: id,
      detail: `${exists.libelle} supprimé`
    });
    res.json({ success: true, message: 'Produit supprimé.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
};
