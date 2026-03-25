const express = require('express');
const controller = require('../controllers/clientsController');

const router = express.Router();

router.get('/', controller.getClients);
router.post('/', controller.createClient);
router.put('/:id', controller.updateClient);
router.delete('/:id', controller.deleteClient);

module.exports = router;
