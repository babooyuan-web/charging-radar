// server/controllers/userController.js
const { query } = require('../config/database')

exports.getProfile = async (req, res, next) => {
  try {
    const [rows] = await query('SELECT * FROM users WHERE id = ?', [req.user.userId])
    if (rows.length === 0) return res.status(404).json({ code: 404, message: '用户不存在' })
    const u = rows[0]
    res.json({ code: 0, data: { id: u.id, nickname: u.nickname, avatarUrl: u.avatar_url, phone: u.phone, userType: u.user_type, city: u.city, points: u.points, balance: parseFloat(u.balance) }})
  } catch (err) { next(err) }
}

exports.updateProfile = async (req, res, next) => {
  try {
    const fields = [], values = []
    const map = { nickname: 'nickname', avatarUrl: 'avatar_url', phone: 'phone', city: 'city' }
    for (const [k, v] of Object.entries(req.body)) { if (map[k]) { fields.push(`${map[k]} = ?`); values.push(v) } }
    if (!fields.length) return res.status(400).json({ code: 400, message: '无有效字段' })
    values.push(req.user.userId)
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    res.json({ code: 0, message: '更新成功' })
  } catch (err) { next(err) }
}

exports.getPoints = async (req, res, next) => {
  try {
    const [rows] = await query('SELECT points FROM users WHERE id = ?', [req.user.userId])
    const [logs] = await query('SELECT * FROM user_contributions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.user.userId])
    res.json({ code: 0, data: { points: rows[0].points, logs }})
  } catch (err) { next(err) }
}
