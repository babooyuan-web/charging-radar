// server/index.js - 充电桩雷达后端入口
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const { Server } = require('ws')
const http = require('mysql2/promise')

const authRoutes = require('./routes/auth')
const stationRoutes = require('./routes/stations')
const orderRoutes = require('./routes/orders')
const userRoutes = require('./routes/user')
const scanRoutes = require('./routes/scan')
const { initDB } = require('./config/database')
const { initRedis } = require('./config/redis')
const { authenticate } = require('./middleware/auth')
const { errorHandler } = require('./middleware/error')

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// 请求日志
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`)
  next()
})

// API 路由
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/stations', authenticate, stationRoutes)
app.use('/api/v1/orders', authenticate, orderRoutes)
app.use('/api/v1/me', authenticate, userRoutes)
app.use('/api/v1/scan', authenticate, scanRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ code: 0, message: 'OK', data: { uptime: process.uptime() } })
})

// 错误处理
app.use(errorHandler)

// 启动服务器
async function start() {
  try {
    // 初始化数据库
    await initDB()
    console.log('✅ 数据库初始化完成')
    
    // 初始化 Redis
    await initRedis()
    console.log('✅ Redis 初始化完成')
    
    // 启动 HTTP 服务
    const server = app.listen(PORT, () => {
      console.log(`🚀 服务器启动成功，端口: ${PORT}`)
      console.log(`📡 API 地址: http://localhost:${PORT}/api/v1`)
    })
    
    // 启动 WebSocket 服务
    const wss = new Server({ server })
    
    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const orderId = url.pathname.split('/').pop()
      
      console.log(`WebSocket 连接: orderId=${orderId}`)
      
      // 发送欢迎消息
      ws.send(JSON.stringify({ type: 'connected', data: { orderId } }))
      
      // 模拟实时推送（实际应该根据订单ID从数据库读取状态）
      const interval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'charging_update',
            data: {
              power: 480 + Math.random() * 20,
              energy: 2.4 + Math.random() * 0.1,
              timeLeft: Math.floor(30 + Math.random() * 10)
            }
          }))
        }
      }, 3000)
      
      ws.on('close', () => {
        console.log(`WebSocket 关闭: orderId=${orderId}`)
        clearInterval(interval)
      })
      
      ws.on('error', (err) => {
        console.error('WebSocket 错误:', err)
        clearInterval(interval)
      })
    })
    
  } catch (err) {
    console.error('❌ 启动失败:', err)
    process.exit(1)
  }
}

start()

module.exports = app
