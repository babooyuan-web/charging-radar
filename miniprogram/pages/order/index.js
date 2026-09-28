// pages/order/index.js - 订单列表页
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    orders: [],
    loading: true,
    activeTab: 'all', // all / charging / completed
    total: 0,
    page: 1,
    size: 10,
    hasMore: true
  },

  onLoad() {
    this.refresh()
  },

  onShow() {
    // 从详情页返回时必须重置分页，否则停留在第 N 页会只剩那一页的数据
    this.refresh()
  },

  // 重新加载第一页
  refresh() {
    this.setData({ page: 1, orders: [] }, () => {
      this.loadOrders(false)
    })
  },

  // append=true 表示「加载更多」，追加到现有列表后；false 表示覆盖刷新
  loadOrders(append) {
    this.setData({ loading: true })
    api.getOrders({
      status: this.data.activeTab,
      page: this.data.page,
      size: this.data.size
    }).then(res => {
      const list = (res && res.orders) ? res.orders : []
      const total = (res && res.total) ? res.total : 0
      const orders = append ? this.data.orders.concat(list) : list
      this.setData({
        orders: orders,
        total: total,
        loading: false,
        // 用「已加载条数 < 总数」判断是否还有下一页，比按 size 猜更可靠
        hasMore: orders.length < total
      })
    }).catch(err => {
      this.setData({ loading: false })
      app.showToast(err || '加载失败')
    })
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab }, () => {
      this.refresh()
    })
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 }, () => {
      this.loadOrders(true)
    })
  },

  // 查看订单详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order/detail?id=${id}` })
  },

  // 去充电
  goCharging() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refresh()
    wx.stopPullDownRefresh()
  }
})
