// server/routes/user.js
const router = require('express').Router()
const { getProfile, updateProfile, getPoints } = require('../controllers/userController')

router.get('/', getProfile)
router.put('/', updateProfile)
router.get('/points', getPoints)

module.exports = router
