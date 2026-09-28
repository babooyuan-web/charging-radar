// server/controllers/scanController.js
const { query } = require('../config/database')

exports.scanQR = async (req, res, next) => {
  try {
    const { qrcode } = req.body
    if (!qrcode) return res.status(400).json({ code: 400, message: '缺少二维码' })
    
    // 解析二维码（格式：品牌:桩编号:端口号，如 LCC:001:3）
    const parts = qrcode.split(':')
    const stationCode = parts[1] || qrcode
    
    const [rows] = await query('SELECT * FROM charging_stations WHERE station_code = ? OR id = ?', [stationCode, stationCode])
    
    if (rows.length === 0) {
      return res.json({ code: 0, data: { found: false, message: '未找到该充电桩，是否上报？' }})
    }
    
    const s = rows[0]
    res.json({
      code: 0,
      data: {
        found: true,
        station: {
          id: s.id, name: s.name, brand: s.brand, totalPorts: s.total_ports,
          freePorts: s.free_ports, pricePerHour: parseFloat(s.price_per_hour),
          lat: parseFloat(s.lat), lng: parseFloat(s.lng), address: s.address
        }
      }
    })
  } catch (err) { next(err) }
}
