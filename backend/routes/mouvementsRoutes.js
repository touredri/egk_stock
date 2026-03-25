const express = require('express');
const controller = require('../controllers/mouvementsController');

const router = express.Router();

router.get('/', controller.getMouvements);
router.post('/', controller.addMouvement);
router.put('/:num_op/:id_prod', controller.putMouvement);
router.delete('/:num_op/:id_prod', controller.removeMouvement);

module.exports = router;
