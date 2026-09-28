// server/controllers/orderController.js
const { query } = require('../config/database')

function generateOrderNo() {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `CR${timestamp}${random}`
}

exports.list = async (req, res, next) => {
  try {
    const userId = req.user.userId
    const { status, page = 1, size = 20 } = req.query
    
    let sql = `
      SELECT o.*, s.name as station_name, s.brand as station_brand
      FROM orders o
      LEFT JOIN charging_stations s ON o.station_id = s.id
      WHERE o.user_id = ?
    `
    const params = [userId]
    
    if (status && status !== 'all') {
      sql += ` AND o.status = ?`
      params.push(status)
    }
    
    sql += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
    params.push(parseInt(size), (parseInt(page) - 1) * parseInt(size))
    
    const [rows] = await query(sql, params)
    
    const orders = rows.map(o => ({
      id: o.id,
      orderNo: o.order_no,
      stationId: o.station_id,
      stationName: o.station_name,
      stationBrand: o.station_brand,
      portNo: o.port_no,
      status: o.status,
      chargeMode: o.charge_mode,
      powerUsed: parseFloat(o.power_used) || 0,
      durationMinutes: o.duration_minutes || 0,
      totalCost: parseFloat(o.total_cost) || 0,
      paymentStatus: o.payment_status,
      startTime: o.start_time,
      endTime: o.end_time,
      createdAt: o.created_at
    }))
    
    const [countRows] = await query('SELECT COUNT(*) as total FROM orders WHERE user_id = ?', [userId])
    
    res.json({ code: 0, data: { orders, total: countRows[0].total } })
    
  } catch (err) {
    next(err)
  }
}

exports.detail = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.userId
    
    const [rows] = await query(`
      SELECT o.*, s.name as station_name, s.brand as station_brand, s.address, s.phone
      FROM orders o
      LEFT JOIN charging_stations s ON o.station_id = s.id
      WHERE o.id = ? AND o.user_id = ?
    `, [id, userId])
    
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '订单不存在' })
    }
    
    const o = rows[0]
    res.json({
      code: 0,
      data: {
        id: o.id,
        orderNo: o.order_no,
        station: {
          id: o.station_id,
          name: o.station_name,
          brand: o.station_brand,
          address: o.address,
          phone: o.phone
        },
        portNo: o.port_no,
        status: o.status,
        chargeMode: o.charge_mode,
        powerUsed: parseFloat(o.power_used) || 0,
        durationMinutes: o.duration_minutes || 0,
        totalCost: parseFloat(o.total_cost) || 0,
        paymentStatus: o.payment_status,
        wxTransactionId: o.wx_transaction_id,
        startTime: o.start_time,
        endTime: o.end_time,
        createdAt: o.created_at
      }
    })
    
  } catch (err) {
    next(err)
  }
}

exports.create = async (req, res, next) => {
  try {
    const userId = req.user.userId
    const { stationId, portNo, chargeMode, targetValue } = req.body
    
    if (!stationId || !portNo || !chargeMode) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' })
    }
    
    const orderNo = generateOrderNo()
    
    const [result] = await query(
      `INSERT INTO orders (order_no, user_id, station_id, port_no, charge_mode, target_value, status, start_time)
       VALUES (?, ?, ?, ?, ?, ?, 'charging', NOW())`,
      [orderNo, userId, stationId, portNo, chargeMode, targetValue || 0]
    )
    
    // 更新充电桩状态
    await query(
      'UPDATE charging_stations SET free_ports = GREATEST(0, free_ports - 1), occupied_ports = occupied_ports + 1 WHERE id = ?',
      [stationId]
    )
    
    res.json({
      code: 0,
      message: '充电启动成功',
      data: { id: result.insertId, orderNo }
    })
    
  } catch (err) {
    next(err)
  }
}

exports.stop = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.userId
    
    const [rows] = await query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId])
    
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '订单不存在' })
    }
    
    const order = rows[0]
    
    // 计算费用（模拟：按时间计费，0.1元/分钟）
    const duration = Math.floor((Date.now() - new Date(order.start_time).getTime()) / 60000)
    const cost = (duration * 0.1).toFixed(2)
    
    await query(
      `UPDATE orders SET status = 'completed', end_time = NOW(), duration_minutes = ?, total_cost = ?, payment_status = 'paid' WHERE id = ?`,
      [duration, cost, id]
    )
    
    // 释放端口
    await query(
      'UPDATE charging_stations SET free_ports = LEAST(total_ports, free_ports + 1), occupied_ports = GREATEST(0, occupied_ports - 1) WHERE id = ?',
      [order.station_id]
    )
    
    res.json({
      code: 0,
      message: '充电已完成',
      data: { duration: minutes: duration, cost }
    })
    
  } catch (err) {
    next(err)
  }
}
