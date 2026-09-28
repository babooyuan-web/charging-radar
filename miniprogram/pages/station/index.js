// pages/station/index.js - 充电桩详情页
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    station: null,
    loading: true,
    activeTab: 'info', // info / reviews / records
    reviews: [],
    chargeRecords: [],
    showChargePopup: false,
    selectedPort: null,
    portList: [],
    starList: [],
    chargeMode: 'by_time', // by_time / by_amount / full
    chargeValue: 60, // 默认60分钟
    chargeAmount: 3, // 默认3元
    canStartCharge: false
  },

  onLoad(options) {
    this.stationId = options.id
    this.setData({ starList: [0, 1, 2, 3, 4] })
    this.loadStationDetail()
  },

  onShow() {
    // onLoad 已加载过，首次 onShow 直接跳过，避免首屏重复请求两次
    if (this.firstShowDone === undefined) {
      this.firstShowDone = true
      return
    }
    if (this.stationId) {
      this.loadStationDetail()
    }
  },

  loadStationDetail() {
    if (!this.stationId) {
      this.setData({ loading: false })
      app.showToast('缺少充电桩 ID')
      return
    }
    this.setData({ loading: true })
    api.getStationDetail(this.stationId).then(res => {
      if (!res || !res.id) {
        this.setData({ loading: false, station: null })
        app.showToast('充电桩不存在')
        return
      }
      this.setData({
        station: res,
        loading: false,
        portList: this.genPortList(res.totalPorts)
      })
      this.loadReviews()
      this.loadChargeRecords()
    }).catch(err => {
      this.setData({ loading: false })
      app.showToast(err || '加载失败')
    })
  },

  // 生成端口数组 [1..n]
  genPortList(n) {
    const list = []
    for (let i = 1; i <= (n || 0); i++) list.push(i)
    return list
  },

  loadReviews() {
    // 模拟评价数据
    this.setData({
      reviews: [
        { id: 1, nickname: '骑手小王', rating: 5, content: '充电很快，有雨棚很方便', images: [], time: '2026-09-20' },
        { id: 2, nickname: '快递老李', rating: 4, content: '位置好找，就是有时候要排队', images: [], time: '2026-09-18' },
        { id: 3, nickname: '上班族小张', rating: 5, content: '价格实惠，24小时都有人', images: [], time: '2026-09-15' }
      ]
    })
  },

  loadChargeRecords() {
    // 模拟充电记录
    this.setData({
      chargeRecords: [
        { time: '2026-09-25 18:30', duration: 45, cost: 3.6 },
        { time: '2026-09-24 12:15', duration: 60, cost: 4.8 },
        { time: '2026-09-23 20:00', duration: 30, cost: 2.4 }
      ]
    })
  },

  // 切换标签
  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  // 导航
  navigate() {
    const { station } = this.data
    if (!station) return
    const latitude = Number(station.lat)
    const longitude = Number(station.lng)
    if (!latitude || !longitude) {
      app.showToast('该充电桩坐标缺失')
      return
    }
    wx.openLocation({
      latitude,
      longitude,
      name: station.name || '充电桩',
      address: station.address || ''
    })
  },

  // 扫码充电
  scanToCharge() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        // 二维码内容常含 ? & #，不编码会破坏 URL query
        const qrcode = encodeURIComponent(res.result || '')
        wx.navigateTo({ url: `/pages/scan/index?qrcode=${qrcode}` })
      },
      fail: () => {
        app.showToast('扫码取消')
      }
    })
  },

  // 直接充电（选择端口）
  startCharge() {
    const { station } = this.data
    if (station.freePorts === 0) {
      app.showToast('暂无空闲端口')
      return
    }
    this.setData({ showChargePopup: true })
  },

  // 选择端口（占用端口禁止选中）
  selectPort(e) {
    const port = Number(e.currentTarget.dataset.port)
    const free = Number(this.data.station ? this.data.station.freePorts : 0)
    if (!port) return
    if (port > free) {
      app.showToast('该端口正在使用，请选择空闲端口')
      return
    }
    this.setData({ selectedPort: port }, () => {
      this.checkCanStart()
    })
  },

  // 选择充电模式
  setChargeMode(e) {
    this.setData({ chargeMode: e.currentTarget.dataset.mode })
  },

  // 设置充电时间
  setChargeTime(e) {
    this.setData({ chargeValue: e.detail.value }, () => {
      this.checkCanStart()
    })
  },

  // 设置充电金额
  setChargeAmount(e) {
    this.setData({ chargeAmount: e.detail.value }, () => {
      this.checkCanStart()
    })
  },

  // 检查是否可以启动
  checkCanStart() {
    const { selectedPort, chargeMode, chargeValue, chargeAmount } = this.data
    let canStart = false
    if (selectedPort) {
      if (chargeMode === 'by_time' && chargeValue > 0) canStart = true
      if (chargeMode === 'by_amount' && chargeAmount > 0) canStart = true
      if (chargeMode === 'full') canStart = true
    }
    this.setData({ canStartCharge: canStart })
  },

  // 关闭弹窗
  closeChargePopup() {
    this.setData({ showChargePopup: false, selectedPort: null })
  },

  // 确认充电
  confirmCharge() {
    const { station, selectedPort, chargeMode, chargeValue, chargeAmount } = this.data
    if (!station || !selectedPort) {
      app.showToast('请选择充电端口')
      return
    }
    if (!this.data.canStartCharge) return

    api.startCharge({
      stationId: station.id,
      portNo: selectedPort,
      chargeMode,
      targetValue: chargeMode === 'by_time' ? chargeValue : chargeMode === 'by_amount' ? chargeAmount : 0
    }).then(res => {
      this.setData({ showChargePopup: false })
      wx.redirectTo({ url: `/pages/charge/progress?orderId=${res.id}` })
    }).catch(err => {
      app.showToast(err || '启动失败')
    })
  },

  // 收藏
  toggleFavorite() {
    app.showSuccess('收藏成功')
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.station?.name} - 充电桩雷达`,
      path: `/pages/station/index?id=${this.stationId}`
    }
  }
})
