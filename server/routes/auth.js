// server/routes/auth.js - 登录路由
const router = require('express').Router()
const { login } = require('../controllers/authController')

// 微信登录
router.post('/login', login)

module.exports = router
