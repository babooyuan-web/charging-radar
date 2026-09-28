// server/controllers/stationController.js - 充电桩控制器
const { query } = require('../config/database')

// 获取附近充电桩
exports.getNearby = async (req, res, next) => {
  try {
    const { lat, lng, radius = 2000, brand, status, sort, page = 1, size = 20 } = req.query
    
    if (!lat || !lng) {
      return res.status(400).json({ code: 400, message: '缺少定位参数' })
    }
    
    // 计算边界框（粗略过滤）
    const latRange = radius / 111000
    const lngRange = radius / (111000 * Math.cos(parseFloat(lat) * Math.PI / 180))
    
    let sql = `
      SELECT id, name, brand, total_ports, free_ports, occupied_ports, fault_ports,
             price_per_hour, lat, lng, address, tags, status, rating,
             (6371000 * acos(LEAST(1, cos(RADIANS(?)) * cos(RADIANS(lat)) * cos(RADIANS(lng) - RADIANS(?)) + sin(RADIANS(?)) * sin(RADIANS(lat)))) AS distance
      FROM charging_stations
      WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    `
    const params = [parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(lat) - latRange, parseFloat(lat) + latRange, parseFloat(lng) - lngRange, parseFloat(lng) + lngRange]
    
    // 品牌筛选
    if (brand && brand !== 'all') {
      sql += ` AND brand = ?`
      params.push(brand)
    }
    
    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'free') {
        sql += ` AND free_ports > 0`
      } else if (status === 'full') {
        sql += ` AND free_ports = 0`
      }
    }
    
    // 排序
    if (sort === 'price') {
      sql += ` ORDER BY price_per_hour ASC`
    } else if (sort === 'free') {
      sql += ` ORDER BY free_ports DESC`
    } else {
      sql += ` ORDER BY distance ASC`
    }
    
    // 分页
    const offset = (parseInt(page) - 1) * parseInt(size)
    sql += ` LIMIT ? OFFSET ?`
    params.push(parseInt(size), offset)
    
    const [rows] = await query(sql, params)
    
    // 获取总数
    const [countRows] = await query(
      `SELECT COUNT(*) as total FROM charging_stations WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`,
      [parseFloat(lat) - latRange, parseFloat(lat) + latRange, parseFloat(lng) - lngRange, parseFloat(lng) + lngRange]
    )
    
    // 格式化返回数据
    const stations = rows.map(row => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      totalPorts: row.total_ports,
      freePorts: row.free_ports,
      occupiedPorts: row.occupied_ports,
      faultPorts: row.fault_ports,
      pricePerHour: parseFloat(row.price_per_hour),
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      address: row.address,
      tags: row.tags ? JSON.parse(row.tags) : [],
      status: row.status,
      rating: parseFloat(row.rating) || 0,
      distance: Math.round(row.distance)
    }))
    
    res.json({
      code: 0,
      data: {
        stations,
        total: countRows[0].total,
        page: parseInt(page),
        size: parseInt(size)
      }
    })
    
  } catch (err) {
    next(err)
  }
}

// 获取充电桩详情
exports.getDetail = async (req, res, next) => {
  try {
    const { id } = req.params
    
    const [rows] = await query(
      `SELECT * FROM charging_stations WHERE id = ?`,
      [id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '充电桩不存在' })
    }
    
    const row = rows[0]
    res.json({
      code: 0,
      data: {
        id: row.id,
        name: row.name,
        brand: row.brand,
        operator: row.operator,
        totalPorts: row.total_ports,
        freePorts: row.free_ports,
        occupiedPorts: row.occupied_ports,
        faultPorts: row.fault_ports,
        pricePerHour: parseFloat(row.price_per_hour),
        priceDetail: row.price_detail ? JSON.parse(row.price_detail) : null,
        powerType: row.power_type,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        address: row.address,
        city: row.city,
        tags: row.tags ? JSON.parse(row.tags) : [],
        images: row.images ? JSON.parse(row.images) : [],
        phone: row.phone,
        businessHours: row.business_hours,
        rating: parseFloat(row.rating) || 0,
        status: row.status,
        lastHeartbeat: row.last_heartbeat_at
      }
    })
    
  } catch (err) {
    next(err)
  }
}

// 上报新桩
exports.create = async (req, res, next) => {
  try {
    const { name, brand, totalPorts, pricePerHour, lat, lng, address, tags, images } = req.body
    
    if (!name || !lat || !lng) {
      return res.status(400).json({ code: 400, message: '缺少必要参数' })
    }
    
    const [result] = await query(
      `INSERT INTO charging_stations (name, brand, total_ports, free_ports, price_per_hour, lat, lng, address, tags, images, data_source, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user_report', 'unknown')`,
      [name, brand || 'other', totalPorts || 0, totalPorts || 0, pricePerHour || 0, lat, lng, address || '', JSON.stringify(tags || []), JSON.stringify(images || [])]
    )
    
    res.json({
      code: 0,
      message: '上报成功',
      data: { id: result.insertId }
    })
    
  } catch (err) {
    next(err)
  }
}

// 更新桩信息
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params
    const updates = req.body
    
    const fields = []
    const values = []
    
    const allowedFields = ['name', 'brand', 'total_ports', 'free_ports', 'occupied_ports', 'fault_ports', 'price_per_hour', 'lat', 'lng', 'address', 'status', 'tags', 'images', 'phone']
    
    for (const [key, value] of Object.entries(updates)) {
      const dbField = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
      if (allowedFields.includes(dbField)) {
        fields.push(`${dbField} = ?`)
        values.push(typeof value === 'object' ? JSON.stringify(value) : value)
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ code: 400, message: '无有效更新字段' })
    }
    
    values.push(id)
    await query(
      `UPDATE charging_stations SET ${fields.join(', ')} WHERE id = ?`,
      values
    )
    
    res.json({ code: 0, message: '更新成功' })
    
  } catch (err) {
    next(err)
  }
}
