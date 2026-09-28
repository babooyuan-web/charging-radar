// pages/charge/progress.js - 充电进度页
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    order: null,
    status: 'charging', // charging / completed / fault
    chargingData: {
      power: 0,
      energy: 0,
      timeLeft: 0,
      cost: 0
    },
    chartBars: [],
    wsConnected: false,
    progressPercent: 0,
    loading: true
  },

  onLoad(options) {
    this.orderId = options.orderId
    // 生成功率趋势柱状图数据（避免在 WXML 中使用 Math.random）
    this.setData({ chartBars: this.genChartBars() })
    this.loadOrderDetail()
    this.connectWebSocket()
  },

  onUnload() {
    if (this.ws) {
      this.ws.close()
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    // 必须清掉 WS 超时定时器，否则页面已销毁后仍会触发 startPolling 并 setData
    if (this.wsTimer) {
      clearTimeout(this.wsTimer)
      this.wsTimer = null
    }
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer)
      this.redirectTimer = null
    }
  },

  // 生成功率趋势数据
  genChartBars() {
    const bars = []
    for (let i = 0; i < 20; i++) {
      bars.push(Math.floor(20 + Math.random() * 60))
    }
    return bars
  },

  loadOrderDetail() {
    api.getOrderDetail(this.orderId).then(res => {
      if (!res || !res.id) {
        this.setData({ loading: false })
        app.showToast('订单不存在')
        return
      }
      this.setData({ order: res, loading: false })
      if (res.status === 'completed') {
        this.setData({ status: 'completed' })
      }
    }).catch(err => {
      this.setData({ loading: false })
      app.showToast(err || '加载失败')
    })
  },

  // 连接 WebSocket（失败自动降级轮询）
  connectWebSocket() {
    const wsUrl = app.globalData.wsUrl
    try {
      this.ws = wx.connectSocket({
        url: `${wsUrl}/charging/${this.orderId}`
      })

      // 超时保护：3秒内未连上则降级轮询
      this.wsTimer = setTimeout(() => {
        if (!this.data.wsConnected) {
          this.startPolling()
        }
      }, 3000)

      wx.onSocketOpen(() => {
        clearTimeout(this.wsTimer)
        this.setData({ wsConnected: true })
      })

      wx.onSocketMessage((res) => {
        try {
          const msg = JSON.parse(res.data)
          this.handleWSMessage(msg)
        } catch (e) {}
      })

      wx.onSocketClose(() => {
        this.setData({ wsConnected: false })
        if (this.data.status === 'charging') {
          this.startPolling()
        }
      })

      wx.onSocketError((err) => {
        console.warn('[WS] 连接失败，降级轮询', err)
        clearTimeout(this.wsTimer)
        this.setData({ wsConnected: false })
        this.startPolling()
      })
    } catch (err) {
      this.startPolling()
    }
  },

  handleWSMessage(msg) {
    if (msg.type === 'charging_update') {
      this.setData({
        chargingData: {
          power: msg.data.power?.toFixed(1) || 0,
          energy: msg.data.energy?.toFixed(2) || 0,
          timeLeft: msg.data.timeLeft || 0,
          cost: msg.data.cost || 0
        },
        progressPercent: Math.min(100, ((msg.data.energy || 0) / 4.8) * 100)
      })
    } else if (msg.type === 'charging_complete') {
      this.setData({ status: 'completed' })
      wx.showToast({ title: '充电完成', icon: 'success' })
      this.redirectTimer = setTimeout(() => {
        this.goToOrders()
      }, 2000)
    } else if (msg.type === 'fault_detected') {
      this.setData({ status: 'fault' })
      wx.showToast({ title: msg.data.message || '异常', icon: 'none' })
    }
  },

  startPolling() {
    if (this.pollTimer) return // 避免重复启动
    const tickSeconds = 5 // 与下面的 5000ms 间隔对应
    let elapsed = 0
    this.pollTimer = setInterval(() => {
      if (this.data.status !== 'charging') {
        clearInterval(this.pollTimer)
        this.pollTimer = null
        return
      }
      // 每轮实时读取，避免订单详情异步返回后 targetValue 还是旧值
      // targetValue 单位是「分钟」，统一换算成秒，否则进度和剩余时间都是错的
      const targetMinutes = Number(this.data.order && this.data.order.targetValue) || 60
      const targetSeconds = targetMinutes * 60
      elapsed += tickSeconds
      // 模拟充电进度（真实环境由后端推送）
      const energy = Math.min((elapsed / 3600) * 0.5, 4.8)
      const percent = Math.min(100, Math.round((elapsed / targetSeconds) * 100))
      this.setData({
        chargingData: {
          power: Math.round(180 + Math.random() * 40),
          energy: energy.toFixed(2),
          timeLeft: Math.max(0, Math.ceil((targetSeconds - elapsed) / 60)),
          cost: (energy * 0.8).toFixed(2)
        },
        progressPercent: percent
      })
      // 到达目标时长自动完成
      if (elapsed >= targetSeconds) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
        this.setData({ status: 'completed' })
      }
    }, tickSeconds * 1000)
  },

  // 停止充电
  stopCharge() {
    wx.showModal({
      title: '确认停止充电',
      content: '确定要停止当前充电吗？',
      success: (res) => {
        if (res.confirm) {
          api.stopCharge(this.orderId).then(() => {
            this.setData({ status: 'completed' })
            this.redirectTimer = setTimeout(() => {
              this.goToOrders()
            }, 1500)
          }).catch(err => {
            app.showToast(err || '停止失败')
          })
        }
      }
    })
  },

  // 延长充电
  extendCharge() {
    app.showToast('已延长充电时间')
  },

  // 故障报修
  reportFault() {
    wx.showModal({
      title: '故障报修',
      content: '确认要上报该桩故障吗？',
      success: (res) => {
        if (res.confirm) {
          app.showSuccess('已上报，我们将尽快处理')
        }
      }
    })
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 查看订单
  // ⚠️ pages/order/index 是 tabBar 页，只能用 switchTab，
  // 用 redirectTo / navigateTo 会直接报 "can not redirectTo a tabbar page"
  goToOrders() {
    wx.switchTab({
      url: '/pages/order/index',
      fail: () => {
        wx.reLaunch({ url: '/pages/order/index' })
      }
    })
  },

  goOrder() {
    this.goToOrders()
  }
})
