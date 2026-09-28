// pages/me/index.js - 个人中心
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    userInfo: null,
    stats: {
      orderCount: 0,
      totalPower: 0,
      totalCost: 0,
      carbonSaved: 0
    },
    menuItems: [
      { icon: '📋', title: '我的订单', url: '/pages/order/index', tab: true },
      { icon: '⭐', title: '我的收藏', key: 'favorites' },
      { icon: '🎁', title: '我的积分', key: 'points' },
      { icon: '🚲', title: '我的车辆', key: 'vehicles' },
      { icon: '📊', title: '充电统计', key: 'stats' },
      { icon: '🤝', title: '邀请好友', key: 'invite' },
      { icon: '📞', title: '联系客服', key: 'contact' },
      { icon: '⚙️', title: '设置', key: 'settings' }
    ]
  },

  onShow() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    // 未登录直接跳登录页（避免重复跳转）
    if (!app.globalData.token) {
      if (!this.redirected) {
        this.redirected = true
        wx.navigateTo({
          url: '/pages/login/index',
          complete: () => { setTimeout(() => { this.redirected = false }, 1000) }
        })
      }
      return
    }
    api.getProfile().then(res => {
      this.setData({
        userInfo: res,
        stats: res.stats || {
          orderCount: 0,
          totalPower: 0,
          totalCost: 0,
          carbonSaved: 0
        }
      })
    }).catch(() => {
      app.showToast('获取资料失败')
    })
  },

  // 点击菜单
  onMenuTap(e) {
    const { url, tab, key } = e.currentTarget.dataset
    if (url) {
      if (tab) {
        wx.switchTab({ url })
      } else {
        wx.navigateTo({ url })
      }
      return
    }
    // 未实现的二级功能
    const names = {
      favorites: '我的收藏', points: '我的积分', vehicles: '我的车辆',
      stats: '充电统计', invite: '邀请好友', contact: '联系客服', settings: '设置'
    }
    app.showToast(`${names[key] || '该功能'} 开发中`)
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout()
          wx.reLaunch({ url: '/pages/login/index' })
        }
      }
    })
  }
})
