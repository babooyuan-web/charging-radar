// pages/scan/index.js - 扫码充电页
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    station: null,
    loading: true,
    selectedPort: null,
    portList: [],
    chargeMode: 'by_time',
    chargeValue: 60,
    canStartCharge: false
  },

  onLoad(options) {
    if (options.qrcode) {
      // 跳转时已 encodeURIComponent，这里必须解码，
      // 否则带 ? & % 的二维码内容会与真实 station_code 对不上
      let qrcode = options.qrcode
      try {
        qrcode = decodeURIComponent(options.qrcode)
      } catch (e) {
        qrcode = options.qrcode
      }
      this.decodeQR(qrcode)
    } else {
      this.setData({ loading: false })
    }
  },

  // 生成端口数组 [1..n]
  genPortList(n) {
    const list = []
    for (let i = 1; i <= (n || 0); i++) list.push(i)
    return list
  },

  // 解码二维码
  decodeQR(qrcode) {
    api.scanCharge(qrcode).then(res => {
      if (res.found) {
        this.setData({
          station: res.station,
          portList: this.genPortList(res.station.totalPorts),
          loading: false
        })
      } else {
        this.setData({ loading: false })
        wx.showModal({
          title: '未找到充电桩',
          content: '该二维码对应的充电桩尚未收录。是否手动上报？',
          confirmText: '去上报',
          success: (r) => {
            if (r.confirm) {
              // 上报功能页面暂未实现，先用提示占位
              app.showToast('上报功能开发中，感谢反馈！')
            }
          }
        })
      }
    }).catch(err => {
      this.setData({ loading: false })
      app.showToast('扫码失败')
    })
  },

  // 扫码
  scanQR() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        this.decodeQR(res.result)
      }
    })
  },

  // 选择端口
  selectPort(e) {
    this.setData({ selectedPort: e.currentTarget.dataset.port }, () => {
      this.checkCanStart()
    })
  },

  // 设置充电模式
  setMode(e) {
    this.setData({ chargeMode: e.currentTarget.dataset.mode })
  },

  // 设置充电时间
  setTime(e) {
    this.setData({ chargeValue: e.detail.value }, () => {
      this.checkCanStart()
    })
  },

  // 检查是否可以启动
  checkCanStart() {
    const { selectedPort, chargeMode, chargeValue } = this.data
    let canStart = false
    if (selectedPort) {
      if (chargeMode === 'by_time' && chargeValue > 0) canStart = true
      if (chargeMode === 'full') canStart = true
    }
    this.setData({ canStartCharge: canStart })
  },

  // 启动充电
  startCharge() {
    const { station, selectedPort, chargeMode, chargeValue } = this.data
    if (!station || !selectedPort) {
      app.showToast('请选择充电端口')
      return
    }
    if (!this.data.canStartCharge) return
    api.startCharge({
      stationId: station.id,
      portNo: selectedPort,
      chargeMode,
      targetValue: chargeMode === 'by_time' ? chargeValue : 0
    }).then(res => {
      wx.redirectTo({ url: `/pages/charge/progress?orderId=${res.id}` })
    }).catch(err => {
      app.showToast(err || '启动失败')
    })
  }
})
