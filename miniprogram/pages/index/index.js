// pages/index/index.js - 雷达首页
const app = getApp()
const api = require('../../api/index')
const demo = require('../../utils/demo-data')

// onShow 触发扫描的最小间隔，避免来回切 tabBar 时打爆接口
const SCAN_THROTTLE_MS = 30 * 1000

Page({
  data: {
    // 雷达状态
    scanning: false,
    scanRadius: 2000, // 默认2km
    
    // 充电桩列表
    stations: [],
    filteredStations: [],
    
    // 筛选
    showFilter: false,
    filterBrand: 'all',
    filterStatus: 'all',
    filterPrice: 'all',
    sortBy: 'distance', // distance / free / price
    
    // 地图
    latitude: 22.5329,
    longitude: 113.9366,
    markers: [],
    showMap: false,
    
    // 搜索
    searchValue: '',
    searchHistory: [],
    
    // 统计数据
    totalNearby: 0,
    freeNearby: 0,
    offlineMode: false,
    
    // 品牌列表
    // ⚠️ id 必须与后端 station.brand 的真实取值一致（中文品牌名），
    // 否则 s.brand === filterBrand 永远为 false，选任何品牌都会得到空列表
    brands: [
      { id: 'all', name: '全部品牌' },
      { id: '驴充充', name: '驴充充' },
      { id: '猛犸', name: '猛犸' },
      { id: '小兔', name: '小兔' },
      { id: '云智充', name: '云智充' }
    ],
    
    statusOptions: [
      { id: 'all', name: '全部状态' },
      { id: 'free', name: '有空闲' },
      { id: 'full', name: '全满' }
    ],
    
    priceOptions: [
      { id: 'all', name: '不限价格' },
      { id: 'low', name: '<0.5元/时' },
      { id: 'mid', name: '0.5-1元/时' },
      { id: 'high', name: '>1元/时' }
    ]
  },

  onLoad() {
    this.loadSearchHistory()
    this.hasLoaded = true
    this.startScan(true)
  },

  // 用户主动点「重新扫描」按钮 —— 跳过节流
  onRescan() {
    this.startScan(true)
  },

  onShow() {
    // 首次进入已扫描，避免重复请求；从其他页返回时刷新
    if (this.hasLoaded) {
      this.hasLoaded = false
      return
    }
    // 节流：来回切 tabBar 会频繁触发 onShow，没必要每次都打接口
    const now = Date.now()
    if (this.lastScanAt && now - this.lastScanAt < SCAN_THROTTLE_MS) {
      console.log('[雷达扫描] 节流跳过（距上次不足 30 秒）')
      return
    }
    this.startScan()
  },

  // 开始雷达扫描
  // force = true 时跳过节流（用户主动点按钮/下拉刷新/改条件）
  startScan(force) {
    const now = Date.now()
    if (!force && this.lastScanAt && now - this.lastScanAt < SCAN_THROTTLE_MS) {
      console.log('[雷达扫描] 节流跳过')
      return
    }
    this.lastScanAt = now

    // 竞态防护：快速连点时，只让最后一次请求的结果落地
    const seq = (this.scanSeq = (this.scanSeq || 0) + 1)
    const location = app.globalData.location || { latitude: 22.5329, longitude: 113.9366 }

    this.setData({ scanning: true })
    app.showLoading('正在扫描附近充电桩...')
    console.log('[雷达扫描] 参数:', location)

    api.getNearbyStations({
      lat: location.latitude,
      lng: location.longitude,
      radius: this.data.scanRadius,
      sort: this.data.sortBy
    }).then(res => {
      if (seq !== this.scanSeq) return // 已有更新的请求，丢弃本次结果
      app.hideLoading()
      const stations = (res && res.stations) ? res.stations : []
      console.log('[雷达扫描] API 返回站点数:', stations.length)
      this.applyStations(stations, res ? (res.total || 0) : 0, location, false)
    }).catch(err => {
      if (seq !== this.scanSeq) return
      app.hideLoading()
      console.warn('[雷达扫描] API 失败，切换离线演示数据:', err)
      // 离线兜底：接口不可用时用内置演示数据，保证界面不空白
      const fallback = demo.queryDemoStations({
        lat: location.latitude,
        lng: location.longitude,
        radius: this.data.scanRadius,
        sort: this.data.sortBy
      })
      this.applyStations(fallback.stations, fallback.total, location, true)
    })
  },

  // 统一写入数据
  applyStations(stations, total, location, offline) {
    this.setData({
      stations: stations,
      totalNearby: total,
      freeNearby: stations.filter(s => s.freePorts > 0).length,
      scanning: false,
      offlineMode: offline,
      latitude: location.latitude,
      longitude: location.longitude,
      markers: this.createMarkers(stations)
    })
    // 重新走一遍本地筛选，避免刷新后已有的品牌/状态/价格筛选被清空
    this.filterStations()
    if (offline) {
      app.showToast('离线演示模式（未连接服务器）')
    }
  },

  // 创建地图标记
  createMarkers(stations) {
    return stations.map((s, i) => ({
      id: s.id,
      latitude: s.lat,
      longitude: s.lng,
      iconPath: s.freePorts > 0 ? '/static/icons/marker-green.png' : '/static/icons/marker-red.png',
      width: 24,
      height: 24,
      callout: {
        content: s.name,
        color: '#fff',
        fontSize: 12,
        borderRadius: 4,
        padding: 4,
        display: 'BY_CLICK'
      }
    }))
  },

  // 切换搜索范围（用户主动操作，跳过节流）
  changeRadius(e) {
    const radius = parseInt(e.currentTarget.dataset.radius)
    this.setData({ scanRadius: radius })
    this.startScan(true)
  },

  // 切换排序（用户主动操作，跳过节流）
  changeSort(e) {
    const sort = e.currentTarget.dataset.sort
    this.setData({ sortBy: sort })
    this.startScan(true)
  },

  // 搜索
  onSearch(e) {
    const value = e.detail.value
    this.setData({ searchValue: value })
    if (value) {
      this.saveSearchHistory(value)
    }
    this.filterStations()
  },

  // 筛选
  filterStations() {
    let list = [...this.data.stations]
    
    // 品牌筛选
    if (this.data.filterBrand !== 'all') {
      list = list.filter(s => s.brand === this.data.filterBrand)
    }
    
    // 状态筛选
    if (this.data.filterStatus !== 'all') {
      if (this.data.filterStatus === 'free') {
        list = list.filter(s => s.freePorts > 0)
      } else if (this.data.filterStatus === 'full') {
        list = list.filter(s => s.freePorts === 0)
      }
    }
    
    // 价格筛选
    if (this.data.filterPrice !== 'all') {
      list = list.filter(s => {
        const price = s.pricePerHour || 0
        if (this.data.filterPrice === 'low') return price < 0.5
        if (this.data.filterPrice === 'mid') return price >= 0.5 && price <= 1
        if (this.data.filterPrice === 'high') return price > 1
        return true
      })
    }
    
    // 搜索
    if (this.data.searchValue) {
      const search = String(this.data.searchValue).toLowerCase()
      list = list.filter(s =>
        String(s.name || '').toLowerCase().includes(search) ||
        String(s.address || '').toLowerCase().includes(search)
      )
    }
    
    this.setData({ filteredStations: list })
  },

  // 打开筛选
  openFilter() {
    this.setData({ showFilter: true })
  },

  // 关闭筛选
  closeFilter() {
    this.setData({ showFilter: false })
  },

  // 设置品牌筛选
  setFilterBrand(e) {
    this.setData({ filterBrand: e.currentTarget.dataset.id })
  },

  // 设置状态筛选
  setFilterStatus(e) {
    this.setData({ filterStatus: e.currentTarget.dataset.id })
  },

  // 设置价格筛选
  setFilterPrice(e) {
    this.setData({ filterPrice: e.currentTarget.dataset.id })
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      filterBrand: 'all',
      filterStatus: 'all',
      filterPrice: 'all',
      searchValue: ''
    })
    // 重置后立即刷新列表，否则要等到点「确定」才生效
    this.filterStations()
  },

  // 应用筛选
  applyFilter() {
    this.filterStations()
    this.setData({ showFilter: false })
  },

  // 切换地图/列表
  toggleMap() {
    this.setData({ showMap: !this.data.showMap })
  },

  // 点击充电桩卡片
  onStationTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/station/index?id=${id}` })
  },

  // 导航到充电桩
  // dataset 取出的数值不可信，必须显式转 Number，否则 openLocation 直接 fail
  onNavigate(e) {
    const { lat, lng, name } = e.currentTarget.dataset
    const latitude = Number(lat)
    const longitude = Number(lng)
    if (!latitude || !longitude) {
      app.showToast('该充电桩坐标缺失')
      return
    }
    wx.openLocation({
      latitude,
      longitude,
      name: name || '充电桩',
      address: ''
    })
  },

  // 扫码充电
  onScanCharge() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        // 二维码内容常含 ? & # 等字符，不编码会破坏 URL query 导致参数截断
        const qrcode = encodeURIComponent(res.result || '')
        wx.navigateTo({ url: `/pages/scan/index?qrcode=${qrcode}` })
      },
      fail: () => {
        app.showToast('扫码取消')
      }
    })
  },

  // 保存搜索历史
  saveSearchHistory(value) {
    let history = wx.getStorageSync('searchHistory') || []
    if (!history.includes(value)) {
      history.unshift(value)
      if (history.length > 10) history.pop()
      wx.setStorageSync('searchHistory', history)
      this.setData({ searchHistory: history })
    }
  },

  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || []
    this.setData({ searchHistory: history })
  },

  // 清除搜索历史
  clearSearchHistory() {
    wx.removeStorageSync('searchHistory')
    this.setData({ searchHistory: [] })
  },

  // 下拉刷新（用户主动操作，跳过节流）
  onPullDownRefresh() {
    this.startScan(true)
    wx.stopPullDownRefresh()
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '充电桩雷达 - 一扫即知，全市充电桩实时状态',
      path: '/pages/index/index'
    }
  }
})
