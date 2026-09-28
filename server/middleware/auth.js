// server/middleware/auth.js - JWT 鉴权中间件
const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'charging-radar-secret-key'

module.exports.authenticate = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未授权' })
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ code: 401, message: '登录已过期' })
  }
}
