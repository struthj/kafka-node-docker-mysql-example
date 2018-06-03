const router = module.exports = require('express').Router();

router.use('/products', require('./products').router);
