// server/controllers/authController.js - 登录控制器
const jwt = require('jsonwebtoken')
const { query } = require('../config/database')

const JWT_SECRET = process.env.JWT_SECRET || 'charging-radar-secret-key'
const JWT_EXPIRES = '7d'

exports.login = async (req, res, next) => {
  try {
    const { code, userInfo } = req.body
    
    if (!code) {
      return res.status(400).json({ code: 400, message: '缺少微信授权码' })
    }
    
    // TODO: 实际应该调用微信接口用 code 换取 openid
    // 这里用 mock 数据演示
    const openid = `mock_openid_${code.slice(-8)}`
    
    // 查找或创建用户
    let [users] = await query('SELECT * FROM users WHERE openid = ?', [openid])
    
    let user
    if (users.length === 0) {
      const nickname = userInfo?.nickName || `用户${openid.slice(-6)}`
      const avatarUrl = userInfo?.avatarUrl || ''
      
      const [result] = await query(
        'INSERT INTO users (openid, nickname, avatar_url, user_type) VALUES (?, ?, ?, ?)',
        [openid, nickname, avatarUrl, 'normal']
      )
      
      user = {
        id: result.insertId,
        openid,
        nickname,
        avatarUrl,
        userType: 'normal',
        points: 0,
        balance: 0
      }
    } else {
      user = {
        id: users[0].id,
        openid: users[0].openid,
        nickname: users[0].nickname,
        avatarUrl: users[0].avatar_url,
        userType: users[0].user_type,
        points: users[0].points,
        balance: parseFloat(users[0].balance)
      }
      
      // 更新最后登录时间
      await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id])
    }
    
    // 生成 JWT
    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )
    
    res.json({
      code: 0,
      data: {
        token,
        userInfo: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname,
          avatarUrl: user.avatarUrl,
          userType: user.userType,
          points: user.points,
          balance: user.balance
        }
      }
    })
    
  } catch (err) {
    next(err)
  }
}
