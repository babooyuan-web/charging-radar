// app.js - 充电桩雷达小程序
App({
  globalData: {
    // 后端地址配置（上线时请替换为您的服务器地址）
    // 本地开发用 'http://localhost:3000/api/v1'
    baseUrl: 'https://your-server.com/api/v1',
    wsUrl: 'wss://your-server.com/ws',
    
    // 用户信息
    userInfo: null,
    token: null,
    
    // 定位信息（立即给默认值）
    location: {
      latitude: 22.5329,
      longitude: 113.9366
    },
    city: '深圳',
    
    // 用户类型
    userType: 'normal', // rider / courier / normal
    
    // 系统信息
    systemInfo: null
  },

  onLaunch() {
    // 检查登录态
    this.checkLogin()
    
    // 获取真实定位
    this.getLocation()
    
    // 获取系统信息（新版 API，兼容旧版）
    if (wx.getDeviceInfo) {
      this.globalData.systemInfo = {
        ...wx.getDeviceInfo(),
        ...(wx.getWindowInfo ? wx.getWindowInfo() : {}),
        ...(wx.getAppBaseInfo ? wx.getAppBaseInfo() : {})
      }
    } else {
      wx.getSystemInfo({
        success: (res) => {
          this.globalData.systemInfo = res
        }
      })
    }
  },

  // 检查登录状态
  checkLogin() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.token = token
      this.globalData.userInfo = wx.getStorageSync('userInfo')
    }
  },

  // 获取真实位置
  // ⚠️ 说明：演示阶段固定用默认坐标，避免定位权限/接口申请的阻塞。
  // 正式启用真实定位需两步：
  //   1) app.json 加 "requiredPrivateInfos": ["getFuzzyLocation"]（注意与 getLocation 互斥，只能写一个）
  //   2) 微信公众平台 → 开发管理 → 接口设置 → 申请开通「模糊地理位置」
  //   3) 然后把下面注释的代码放开即可
  getLocation() {
    // wx.getFuzzyLocation({
    //   type: 'wgs84',
    //   success: (res) => {
    //     this.globalData.location = {
    //       latitude: res.latitude,
    //       longitude: res.longitude
    //     }
    //     this.globalData.isRealLocation = true
    //     console.log('[定位成功]', res.latitude, res.longitude)
    //   },
    //   fail: (err) => {
    //     console.log('[定位失败，使用默认位置]', err)
    //   }
    // })
    console.log('[定位] 演示模式：使用默认坐标', this.globalData.location)
  },

  // 登录
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            wx.request({
              url: `${this.globalData.baseUrl}/auth/login`,
              method: 'POST',
              data: { code: res.code },
              success: (r) => {
                if (r.data.code === 0) {
                  const { token, userInfo } = r.data.data
                  this.globalData.token = token
                  this.globalData.userInfo = userInfo
                  this.globalData.userType = userInfo.userType || 'normal'
                  wx.setStorageSync('token', token)
                  wx.setStorageSync('userInfo', userInfo)
                  resolve(userInfo)
                } else {
                  reject(r.data.message)
                }
              },
              fail: reject
            })
          } else {
            reject('登录失败')
          }
        },
        fail: reject
      })
    })
  },

  // 退出登录
  logout() {
    this.globalData.token = null
    this.globalData.userInfo = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
  },

  // 显示加载中
  showLoading(title = '加载中') {
    wx.showLoading({ title, mask: true })
  },

  // 隐藏加载
  hideLoading() {
    wx.hideLoading()
  },

  // 显示提示
  showToast(title, icon = 'none') {
    wx.showToast({ title, icon, duration: 2000 })
  },

  // 显示成功
  showSuccess(title = '操作成功') {
    wx.showToast({ title, icon: 'success', duration: 2000 })
  },

  // 显示错误
  showError(title = '操作失败') {
    wx.showToast({ title, icon: 'none', duration: 2000 })
  },

  // API 请求封装
  request(options) {
    const token = this.globalData.token
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        success: (res) => {
          // res.data 可能不是 JSON（代理拦截、HTML 错误页等），必须先兜底
          const body = (res && res.data && typeof res.data === 'object') ? res.data : {}
          const bizCode = body.code !== undefined ? body.code : res.statusCode
          if (bizCode === 0) {
            resolve(body.data)
          } else if (bizCode === 401 || res.statusCode === 401) {
            // 登录过期
            this.logout()
            wx.reLaunch({ url: '/pages/login/index' })
            reject(body.message || '登录已过期')
          } else {
            reject(body.message || (res.statusCode >= 500 ? '服务器异常' : '请求失败'))
          }
        },
        fail: (err) => {
          reject((err && err.errMsg) || '网络错误，请检查服务器是否已启动')
        }
      })
    })
  }
})
