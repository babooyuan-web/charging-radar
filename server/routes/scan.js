// server/routes/scan.js
const router = require('express').Router()
const { scanQR } = require('../controllers/scanController')

router.post('/', scanQR)

module.exports = router
