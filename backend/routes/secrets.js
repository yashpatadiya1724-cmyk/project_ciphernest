const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { addSecret, getSecrets, revealSecret, deleteSecret } = require('../controllers/secretController');

router.use(protect);

router.route('/')
  .post(addSecret)
  .get(getSecrets);

router.route('/:id')
  .get(revealSecret)
  .delete(deleteSecret);

module.exports = router;
