const redis = require('redis')

let client = null

async function initRedis() {
  try {
    client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
    await client.connect()
    console.log('✅ Redis 连接成功')
  } catch (err) {
    console.log('⚠️ Redis 连接失败:', err.message)
    client = null
  }
}

function getRedis() { return client }

module.exports = { initRedis, getRedis }
