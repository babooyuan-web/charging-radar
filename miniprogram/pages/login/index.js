// pages/login/index.js - 登录页
const app = getApp()
const api = require('../../api/index')

Page({
  data: {
    loading: false,
    userType: 'normal', // rider / courier / normal
    avatarUrl: '',
    nickname: ''
  },

  // 选择用户身份
  selectUserType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ userType: type })
    app.globalData.userType = type
  },

  // 头像选择（open-type="chooseAvatar" 回调，拿到的是临时文件路径）
  onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl
    if (!tempPath) return
    // 临时路径会被系统清理，转存到小程序用户目录才是可长期使用的地址
    let saved = tempPath
    try {
      const fs = wx.getFileSystemManager()
      const m = /\.[a-zA-Z0-9]+$/.exec(tempPath)
      const ext = m ? m[0] : '.png'
      const dest = `${wx.env.USER_DATA_PATH}/avatar_${Date.now()}${ext}`
      fs.saveFileSync(tempPath, dest)
      saved = dest
    } catch (err) {
      console.warn('[头像] 转存失败，回退临时路径', err)
    }
    this.setData({ avatarUrl: saved })
  },

  // 昵称输入（input type="nickname"）
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  // 登录：wx.login 静默拿 code，昵称头像由用户主动填写
  // ⚠️ wx.getUserProfile 已于 2022-10-25 起废弃，新基础库调用必然失败，不要再使用
  doLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    wx.login({
      success: (res) => {
        if (!res.code) {
          this.setData({ loading: false })
          app.showToast('微信登录失败，请重试')
          return
        }
        api.wxLogin({
          code: res.code,
          userInfo: {
            nickName: this.data.nickname || '',
            avatarUrl: this.data.avatarUrl || ''
          },
          userType: this.data.userType
        }).then(data => {
          app.globalData.token = data.token
          app.globalData.userInfo = data.userInfo
          app.globalData.userType = data.userInfo.userType || 'normal'
          wx.setStorageSync('token', data.token)
          wx.setStorageSync('userInfo', data.userInfo)
          this.setData({ loading: false })
          app.showSuccess('登录成功')
          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' })
          }, 800)
        }).catch(err => {
          this.setData({ loading: false })
          app.showToast(err || '登录失败')
        })
      },
      fail: () => {
        this.setData({ loading: false })
        app.showToast('微信登录失败')
      }
    })
  },

  // 用户协议
  showAgreement() {
    app.showToast('用户协议')
  },

  // 隐私政策
  showPrivacy() {
    app.showToast('隐私政策')
  }
})
