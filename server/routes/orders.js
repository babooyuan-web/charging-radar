// server/routes/orders.js
const router = require('express').Router()
const { list, detail, create, stop } = require('../controllers/orderController')

router.get('/', list)
router.get('/:id', detail)
router.post('/', create)
router.post('/:id/stop', stop)

module.exports = router
