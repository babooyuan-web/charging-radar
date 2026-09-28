// server/middleware/error.js
module.exports.errorHandler = (err, req, res, next) => {
  console.error('❌', err)
  res.status(500).json({ code: 500, message: err.message || '服务器错误' })
}
