const express = require('express');
const controller = require('../controllers/commandesController');

const router = express.Router();

router.get('/', controller.getCommandes);
router.get('/:id/history', controller.getCommandeHistory);
router.get('/:id', controller.getCommande);
router.post('/', controller.postCommande);
router.put('/:id', controller.putCommande);
router.delete('/:id', controller.deleteCommande);
router.put('/:id/validate', controller.postValidateCommande);
router.put('/:id/status', controller.postChangeCommandeStatus);

module.exports = router;
