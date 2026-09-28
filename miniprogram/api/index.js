// api/index.js - 统一 API 管理
const app = getApp()

// 微信登录
function wxLogin(data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}/auth/login`,
      method: 'POST',
      data,
      success: (res) => {
        const body = (res && res.data && typeof res.data === 'object') ? res.data : {}
        if (body.code === 0) resolve(body.data)
        else reject(body.message || '登录失败')
      },
      fail: () => reject('网络错误，请检查服务器是否已启动')
    })
  })
}

// 获取附近充电桩
function getNearbyStations(params = {}) {
  return app.request({
    url: '/stations/nearby',
    method: 'GET',
    data: {
      lat: params.lat || params.latitude,
      lng: params.lng || params.longitude,
      radius: params.radius || 2000,
      brand: params.brand || 'all',
      status: params.status || 'all',
      sort: params.sort || 'distance',
      page: params.page || 1,
      size: params.size || 20
    }
  })
}

// 获取充电桩详情
function getStationDetail(id) {
  return app.request({ url: `/stations/${id}`, method: 'GET' })
}

// 上报新桩
function reportStation(data) {
  return app.request({ url: '/stations', method: 'POST', data })
}

// 扫码充电
function scanCharge(qrcode) {
  return app.request({ url: '/scan', method: 'POST', data: { qrcode } })
}

// 启动充电
function startCharge(data) {
  return app.request({ url: '/orders', method: 'POST', data })
}

// 停止充电
function stopCharge(orderId) {
  return app.request({ url: `/orders/${orderId}/stop`, method: 'POST' })
}

// 获取订单列表
function getOrders(params = {}) {
  return app.request({ url: '/orders', method: 'GET', data: params })
}

// 获取订单详情
function getOrderDetail(id) {
  return app.request({ url: `/orders/${id}`, method: 'GET' })
}

// 获取充电状态
function getChargingStatus(orderId) {
  return app.request({ url: `/orders/${orderId}`, method: 'GET' })
}

// 获取个人信息
function getProfile() {
  return app.request({ url: '/me', method: 'GET' })
}

// 更新个人信息
function updateProfile(data) {
  return app.request({ url: '/me', method: 'PUT', data })
}

module.exports = {
  wxLogin,
  getNearbyStations,
  getStationDetail,
  reportStation,
  scanCharge,
  startCharge,
  stopCharge,
  getOrders,
  getOrderDetail,
  getChargingStatus,
  getProfile,
  updateProfile
}
