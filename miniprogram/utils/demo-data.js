// utils/demo-data.js - 离线演示兜底数据
// 当 API 请求失败（未启动服务器 / 域名校验未关闭 / 断网）时使用，
// 保证界面始终有内容可看，同时在页面上提示「离线演示模式」。

const DEMO_STATIONS = [
  {
    id: 9001, stationCode: 'LCC001', name: '驴充充·科技园', brand: '驴充充', operator: '驴充充科技',
    totalPorts: 8, freePorts: 3, occupiedPorts: 5, faultPorts: 0,
    status: 'online', pricePerHour: 0.80, powerType: 'slow',
    lat: 22.5329, lng: 113.9366, address: '科技园路1号', city: '深圳', district: '南山区',
    tags: ['有雨棚', '24小时'], phone: '400-888-0001', businessHours: '24小时'
  },
  {
    id: 9002, stationCode: 'MM003', name: '猛犸充电·深南天桥', brand: '猛犸', operator: '猛犸科技',
    totalPorts: 10, freePorts: 5, occupiedPorts: 4, faultPorts: 1,
    status: 'online', pricePerHour: 1.00, powerType: 'fast',
    lat: 22.5344, lng: 113.9386, address: '深南大道天桥下', city: '深圳', district: '南山区',
    tags: ['快充', '有雨棚'], phone: '400-999-0001', businessHours: '24小时'
  },
  {
    id: 9003, stationCode: 'XTC003', name: '小兔充充·科苑北', brand: '小兔', operator: '小兔科技',
    totalPorts: 6, freePorts: 2, occupiedPorts: 4, faultPorts: 0,
    status: 'maintenance', pricePerHour: 0.70, powerType: 'slow',
    lat: 22.5301, lng: 113.9378, address: '科苑北路12号', city: '深圳', district: '南山区',
    tags: ['室内'], phone: '400-777-0001', businessHours: '07:00-23:00'
  },
  {
    id: 9004, stationCode: 'YZC003', name: '云智充·高新园', brand: '云智充', operator: '云智充科技',
    totalPorts: 8, freePorts: 4, occupiedPorts: 4, faultPorts: 0,
    status: 'online', pricePerHour: 0.60, powerType: 'slow',
    lat: 22.5369, lng: 113.9276, address: '高新园地铁B口', city: '深圳', district: '南山区',
    tags: ['地铁口', '24小时'], phone: '400-666-0001', businessHours: '24小时'
  },
  {
    id: 9005, stationCode: 'LCC002', name: '驴充充·软件园', brand: '驴充充', operator: '驴充充科技',
    totalPorts: 10, freePorts: 0, occupiedPorts: 10, faultPorts: 0,
    status: 'online', pricePerHour: 0.90, powerType: 'slow',
    lat: 22.5400, lng: 113.9450, address: '软件园A座', city: '深圳', district: '南山区',
    tags: ['室内'], phone: '400-888-0001', businessHours: '24小时'
  },
  {
    id: 9006, stationCode: 'MM001', name: '猛犸充电·商业街', brand: '猛犸', operator: '猛犸科技',
    totalPorts: 12, freePorts: 5, occupiedPorts: 7, faultPorts: 0,
    status: 'online', pricePerHour: 1.00, powerType: 'fast',
    lat: 22.5250, lng: 113.9280, address: '商业大街88号', city: '深圳', district: '南山区',
    tags: ['快充', '有雨棚'], phone: '400-999-0001', businessHours: '24小时'
  },
  {
    id: 9007, stationCode: 'LCC005', name: '驴充充·白石洲', brand: '驴充充', operator: '驴充充科技',
    totalPorts: 14, freePorts: 9, occupiedPorts: 5, faultPorts: 0,
    status: 'online', pricePerHour: 0.75, powerType: 'slow',
    lat: 22.5209, lng: 113.9426, address: '白石洲村口', city: '深圳', district: '南山区',
    tags: ['24小时', '夜间优惠'], phone: '400-888-0001', businessHours: '24小时'
  },
  {
    id: 9008, stationCode: 'XTC004', name: '小兔充充·世界之窗', brand: '小兔', operator: '小兔科技',
    totalPorts: 8, freePorts: 3, occupiedPorts: 5, faultPorts: 0,
    status: 'online', pricePerHour: 0.85, powerType: 'slow',
    lat: 22.5174, lng: 113.9231, address: '世界之窗地铁A口', city: '深圳', district: '南山区',
    tags: ['地铁口'], phone: '400-777-0001', businessHours: '06:00-24:00'
  },
  {
    id: 9009, stationCode: 'MM002', name: '猛犸充电·大冲', brand: '猛犸', operator: '猛犸科技',
    totalPorts: 15, freePorts: 8, occupiedPorts: 7, faultPorts: 0,
    status: 'online', pricePerHour: 0.95, powerType: 'fast',
    lat: 22.5450, lng: 113.9550, address: '大冲国际大厦', city: '深圳', district: '南山区',
    tags: ['快充', '室内'], phone: '400-999-0001', businessHours: '24小时'
  },
  {
    id: 9010, stationCode: 'LCC004', name: '驴充充·大学城', brand: '驴充充', operator: '驴充充科技',
    totalPorts: 20, freePorts: 12, occupiedPorts: 8, faultPorts: 0,
    status: 'online', pricePerHour: 0.75, powerType: 'slow',
    lat: 22.5800, lng: 113.9600, address: '大学城地铁C口', city: '深圳', district: '南山区',
    tags: ['有雨棚', '学生优惠'], phone: '400-888-0001', businessHours: '24小时'
  },
  {
    id: 9011, stationCode: 'YZC001', name: '云智充·宝安站', brand: '云智充', operator: '云智充科技',
    totalPorts: 8, freePorts: 6, occupiedPorts: 2, faultPorts: 0,
    status: 'online', pricePerHour: 0.60, powerType: 'slow',
    lat: 22.5650, lng: 113.8800, address: '宝安大道100号', city: '深圳', district: '宝安区',
    tags: ['室内', '24小时'], phone: '400-666-0001', businessHours: '24小时'
  },
  {
    id: 9012, stationCode: 'LCC003', name: '驴充充·车公庙', brand: '驴充充', operator: '驴充充科技',
    totalPorts: 10, freePorts: 1, occupiedPorts: 9, faultPorts: 0,
    status: 'online', pricePerHour: 0.85, powerType: 'slow',
    lat: 22.5380, lng: 114.0200, address: '车公庙地铁A口', city: '深圳', district: '福田区',
    tags: ['地铁口'], phone: '400-888-0001', businessHours: '24小时'
  },
  {
    id: 9013, stationCode: 'XTC002', name: '小兔充充·会展', brand: '小兔', operator: '小兔科技',
    totalPorts: 10, freePorts: 0, occupiedPorts: 10, faultPorts: 0,
    status: 'online', pricePerHour: 1.10, powerType: 'fast',
    lat: 22.5350, lng: 114.0500, address: '会展中心北门', city: '深圳', district: '福田区',
    tags: ['快充'], phone: '400-777-0001', businessHours: '24小时'
  },
  {
    id: 9014, stationCode: 'XTC001', name: '小兔充充·福田中心', brand: '小兔', operator: '小兔科技',
    totalPorts: 6, freePorts: 4, occupiedPorts: 2, faultPorts: 0,
    status: 'online', pricePerHour: 0.70, powerType: 'slow',
    lat: 22.5470, lng: 114.0600, address: '福田区中心城', city: '深圳', district: '福田区',
    tags: ['24小时'], phone: '400-777-0001', businessHours: '24小时'
  },
  {
    id: 9015, stationCode: 'YZC002', name: '云智充·东门', brand: '云智充', operator: '云智充科技',
    totalPorts: 6, freePorts: 4, occupiedPorts: 2, faultPorts: 0,
    status: 'online', pricePerHour: 0.65, powerType: 'slow',
    lat: 22.5430, lng: 114.1100, address: '东门老街步行街', city: '深圳', district: '罗湖区',
    tags: ['24小时', '商圈'], phone: '400-666-0001', businessHours: '24小时'
  }
]

// 两点间距离（米）
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 按条件筛选 + 排序，返回与后端一致的 { stations, total }
function queryDemoStations({ lat = 22.5329, lng = 113.9366, radius = 2000, brand = 'all', status = 'all', sort = 'distance' } = {}) {
  let list = DEMO_STATIONS.map((s) => {
    const copy = Object.assign({}, s)
    copy.distance = Math.round(haversine(lat, lng, s.lat, s.lng))
    return copy
  }).filter((s) => s.distance <= radius)

  if (brand !== 'all') list = list.filter((s) => s.brand === brand)
  if (status === 'free') list = list.filter((s) => s.freePorts > 0)
  if (status === 'full') list = list.filter((s) => s.freePorts === 0)

  if (sort === 'price') list.sort((a, b) => a.pricePerHour - b.pricePerHour)
  else if (sort === 'free') list.sort((a, b) => b.freePorts - a.freePorts)
  else list.sort((a, b) => a.distance - b.distance)

  return { stations: list, total: list.length }
}

// 按 stationCode 或 id 查单个桩
function findDemoStation(key) {
  return DEMO_STATIONS.find((s) => s.stationCode === key || String(s.id) === String(key)) || null
}

module.exports = { DEMO_STATIONS, queryDemoStations, findDemoStation, haversine }
