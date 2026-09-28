// pages/order/detail.js - 订单详情页
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    order: null,
    loading: true
  },

  onLoad(options) {
    this.orderId = options.id
    this.loadOrderDetail()
  },

  loadOrderDetail() {
    this.setData({ loading: true })
    api.getOrderDetail(this.orderId).then(res => {
      if (!res || !res.id) {
        this.setData({ loading: false, order: null })
        app.showToast('订单不存在')
        return
      }
      this.setData({ order: res, loading: false })
    }).catch(err => {
      this.setData({ loading: false })
      app.showToast(err || '加载失败')
    })
  },

  // 查看充电桩
  viewStation() {
    const station = this.data.order && this.data.order.station
    if (!station || !station.id) {
      app.showToast('该订单未关联充电桩')
      return
    }
    wx.navigateTo({ url: `/pages/station/index?id=${station.id}` })
  },

  // 去充电
  goCharging() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 评价
  writeReview() {
    wx.showModal({
      title: '评价本次充电',
      editable: true,
      placeholderText: '请写下您的充电体验...',
      success: (res) => {
        if (res.confirm && res.content) {
          app.showSuccess('感谢您的评价！')
        }
      }
    })
  }
})
