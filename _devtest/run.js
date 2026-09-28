/**
 * 小程序页面逻辑集成测试（无需打开微信开发者工具）
 *
 * 原理：在 Node 里桩出 wx / App / Page / getApp 等全局对象，
 *      然后 require 真实的 pages/**\/*.js，用真实后端的数据驱动，
 *      断言页面 data 的变化是否符合预期。
 *
 * 用法： node _devtest/run.js      （需先启动 server/mock_api.py）
 */
const http = require('http')
const path = require('path')

const MINI = path.join(__dirname, '..', 'miniprogram')
const BASE = 'http://localhost:3000/api/v1' // 本地开发用，生产请改环境变量

let passed = 0, failed = 0
const results = []
function check(name, cond, extra) {
  if (cond) { passed++; results.push('  PASS  ' + name) }
  else { failed++; results.push('  FAIL  ' + name + (extra ? '  -> ' + extra : '')) }
}
function section(t) { results.push('\n### ' + t) }

// ---------------- 桩：wx ----------------
const storage = {}
function realRequest({ url, method = 'GET', data = {}, header = {}, success, fail }) {
  let qs = ''
  if (method === 'GET' && data && Object.keys(data).length) {
    const parts = []
    for (const k in data) {
      if (data[k] === undefined || data[k] === null) continue
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    }
    qs = '?' + parts.join('&')
  }
  const u = new URL(url + qs)
  const body = method === 'GET' ? null : JSON.stringify(data)
  // Node 默认用 chunked 传输，必须显式给 Content-Length，
  // 否则后端读到空 body（服务端按 Content-Length 取请求体）
  const headers = Object.assign({ 'Content-Type': 'application/json' }, header)
  if (body) headers['Content-Length'] = Buffer.byteLength(body)
  const req = http.request({
    hostname: u.hostname, port: u.port, path: u.pathname + u.search,
    method,
    headers
  }, (res) => {
    let buf = ''
    res.on('data', c => buf += c)
    res.on('end', () => {
      let parsed = {}
      try { parsed = JSON.parse(buf) } catch (e) { parsed = buf }
      success && success({ statusCode: res.statusCode, data: parsed })
    })
  })
  req.on('error', e => fail && fail({ errMsg: 'request:fail ' + e.message }))
  if (body) req.write(body)
  req.end()
}

const toasts = []
let pageInstance = null
global.wx = {
  request: realRequest,
  login: ({ success }) => setTimeout(() => success({ code: 'devtest_code_20260926' }), 0),
  setStorageSync: (k, v) => { storage[k] = v },
  getStorageSync: (k) => (k in storage ? storage[k] : ''),
  removeStorageSync: (k) => { delete storage[k] },
  showLoading: () => {}, hideLoading: () => {},
  showToast: (o) => { toasts.push(o.title) },
  showModal: (o) => {}, hideToast: () => {},
  scanCode: (o) => {}, openLocation: (o) => {}, navigateTo: (o) => {},
  switchTab: (o) => { wx.__lastNav = o.url }, redirectTo: (o) => { wx.__lastNav = o.url },
  reLaunch: (o) => { wx.__lastNav = o.url }, stopPullDownRefresh: () => {},
  connectSocket: () => { throw new Error('no ws in test') },
  onSocketOpen: () => {}, onSocketMessage: () => {},
  onSocketClose: () => {}, onSocketError: () => {},
  getDeviceInfo: () => ({ platform: 'devtools' }),
  getWindowInfo: () => ({ windowWidth: 375 }),
  getAppBaseInfo: () => ({ SDKVersion: '3.5.0' })
}

// ---------------- 桩：App / Page ----------------
const appInstance = { globalData: {}, request: null }
global.App = (opts) => { Object.assign(appInstance, opts); appInstance.__opts = opts }
global.getApp = () => {
  // app.js 里的 request 依赖 this.globalData，这里手动绑好
  if (!appInstance.request && appInstance.__opts) {
    Object.assign(appInstance, appInstance.__opts)
  }
  return appInstance
}
global.Page = (opts) => {
  const inst = Object.assign({}, opts)
  inst.data = JSON.parse(JSON.stringify(opts.data || {}))
  inst.setData = function (patch, cb) {
    Object.assign(this.data, patch)
    cb && cb()
  }
  pageInstance = inst
  return inst
}
global.getCurrentPages = () => []

function loadPage(rel) {
  pageInstance = null
  const p = path.join(MINI, rel)
  delete require.cache[require.resolve(p)]
  require(p)
  if (!pageInstance) throw new Error('Page() 未被调用: ' + rel)
  return pageInstance
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  results.push('充电桩雷达小程序 - 页面逻辑集成测试')
  results.push('后端: ' + BASE.replace('localhost', '[host]'))

  // 先初始化 app.js（拿到 globalData + request 封装）
  require(path.join(MINI, 'app.js'))

  // ================= 1. 首页雷达 =================
  section('1. 首页雷达页 pages/index')
  const idx = loadPage('pages/index/index.js')
  idx.onLoad()
  await sleep(600)
  check('API 直连成功（未进离线兜底）', idx.data.offlineMode === false, 'offlineMode=' + idx.data.offlineMode)
  check('默认 2km 半径扫到 7 个桩', idx.data.stations.length === 7, '实际 ' + idx.data.stations.length)
  check('totalNearby 与列表一致', idx.data.totalNearby === idx.data.stations.length)
  check('markers 已生成', idx.data.markers.length === idx.data.stations.length)
  check('freeNearby 计算正确', idx.data.freeNearby === idx.data.stations.filter(s => s.freePorts > 0).length)

  // 品牌筛选：修复前 id 是拼音，必然为空
  // 2km 内的分布：驴充充 3 / 猛犸 2 / 小兔 1 / 云智充 1
  const brandCases = [['驴充充', 3], ['猛犸', 2], ['小兔', 1], ['云智充', 1]]
  for (const [brand, expect] of brandCases) {
    idx.setFilterBrand({ currentTarget: { dataset: { id: brand } } })
    idx.filterStations()
    const all = idx.data.filteredStations.every(s => s.brand === brand)
    check(`品牌筛选「${brand}」命中 ${idx.data.filteredStations.length} 个且全部匹配`, all && idx.data.filteredStations.length === expect,
      '实际 ' + idx.data.filteredStations.length + ' 期望 ' + expect)
  }
  idx.resetFilter()
  check('重置筛选后恢复全量', idx.data.filteredStations.length === idx.data.stations.length,
    '实际 ' + idx.data.filteredStations.length)

  // 状态筛选
  idx.setFilterStatus({ currentTarget: { dataset: { id: 'free' } } })
  idx.applyFilter()
  check('状态=有空闲 过滤正确', idx.data.filteredStations.every(s => s.freePorts > 0))
  idx.resetFilter()

  // 刷新后筛选条件不被清空（修复点）
  idx.setFilterBrand({ currentTarget: { dataset: { id: '驴充充' } } })
  idx.filterStations()
  idx.startScan(true) // force：模拟用户主动点「重新扫描」
  await sleep(600)
  check('重新扫描后品牌筛选仍保留', idx.data.filterBrand === '驴充充' && idx.data.filteredStations.every(s => s.brand === '驴充充'),
    'filteredStations=' + idx.data.filteredStations.length)
  idx.resetFilter()

  // 节流 & 竞态（本次新增）
  const apiIdx = require(path.join(MINI, 'api/index.js'))
  let nearbyCalls = 0
  const origNearby = apiIdx.getNearbyStations
  apiIdx.getNearbyStations = (p) => { nearbyCalls++; return origNearby(p) }

  nearbyCalls = 0
  idx.onShow()          // 距上次扫描不足 30 秒
  await sleep(400)
  check('onShow 30 秒内重复触发被节流', nearbyCalls === 0, '实际发起 ' + nearbyCalls + ' 次请求')

  nearbyCalls = 0
  idx.startScan(true)   // 用户主动操作，不受限
  await sleep(700)
  check('主动重新扫描不受节流限制', nearbyCalls === 1, '实际发起 ' + nearbyCalls + ' 次请求')

  // 竞态：连发 3 次，只有最后一次结果落地
  nearbyCalls = 0
  idx.startScan(true)
  idx.startScan(true)
  idx.startScan(true)
  await sleep(1000)
  check('连发 3 次只保留最后一次结果（竞态防护）', idx.data.scanning === false && idx.data.stations.length > 0,
    'scanning=' + idx.data.scanning + ' len=' + idx.data.stations.length)

  apiIdx.getNearbyStations = origNearby

  // 半径切换
  idx.changeRadius({ currentTarget: { dataset: { radius: '5000' } } })
  await sleep(600)
  check('切到 5km 后命中 9 个', idx.data.stations.length === 9, '实际 ' + idx.data.stations.length)

  // 排序
  idx.changeSort({ currentTarget: { dataset: { sort: 'price' } } })
  await sleep(600)
  const prices = idx.data.stations.map(s => s.pricePerHour)
  check('按价格排序生效', prices.every((v, i) => i === 0 || prices[i - 1] <= v), JSON.stringify(prices))

  // ================= 2. 登录页 =================
  section('2. 登录页 pages/login')
  const login = loadPage('pages/login/index.js')
  login.onLoad && login.onLoad()
  check('已移除废弃的 canIUseGetUserProfile', login.data.canIUseGetUserProfile === undefined)
  check('已移除废弃的 getUserProfile 调用', typeof login.getUserProfile === 'undefined')
  check('存在 chooseAvatar 回调', typeof login.onChooseAvatar === 'function')
  check('存在 nickname 输入回调', typeof login.onNicknameInput === 'function')
  login.setData({ nickname: '骑手小王', userType: 'rider' })
  login.doLogin()
  await sleep(1200) // doLogin 内部有 800ms 后才 switchTab
  check('登录成功写入 token', !!getApp().globalData.token)
  check('登录成功写入 userInfo', !!(getApp().globalData.userInfo && getApp().globalData.userInfo.nickname),
    JSON.stringify(getApp().globalData.userInfo))
  check('登录后 switchTab 回首页', wx.__lastNav === '/pages/index/index', wx.__lastNav)

  // 造订单给订单页测分页
  // ⚠️ 必须动态挑「还有空闲端口」的站点，否则反复运行会把端口占满，
  //    被后端新的 free_ports 校验挡掉（这正是该校验生效的证明）
  const api = require(path.join(MINI, 'api/index.js'))
  const nearby = await api.getNearbyStations({ lat: 22.5329, lng: 113.9366, radius: 5000 })
  const freeStations = (nearby.stations || []).filter(s => s.freePorts > 0)
  check('存在可下单的空闲站点', freeStations.length >= 2,
    '空闲站点 ' + freeStations.length + ' 个')

  const createdIds = []
  for (const s of freeStations.slice(0, 3)) {
    const r = await api.startCharge({ stationId: s.id, portNo: 1, chargeMode: 'by_time', targetValue: 60 })
    createdIds.push(r.id)
  }
  // 停掉最后一笔，制造 completed 订单，让两个 tab 有区别
  if (createdIds.length) {
    await api.stopCharge(createdIds[createdIds.length - 1])
  }
  check('下单成功（未被空闲端口校验拦截）', createdIds.length >= 2,
    '成功 ' + createdIds.length + ' 笔')

  // ================= 3. 订单页 =================
  section('3. 订单列表页 pages/order/index')
  const order = loadPage('pages/order/index.js')
  order.setData({ size: 2 })
  order.onLoad()
  await sleep(700)
  check('第 1 页返回 2 条', order.data.orders.length === 2, '实际 ' + order.data.orders.length)
  check('total 反映全量（>=3）', order.data.total >= 3, 'total=' + order.data.total)
  check('hasMore = 已加载 < total', order.data.hasMore === (order.data.orders.length < order.data.total))

  const firstPageIds = order.data.orders.map(o => o.id)
  order.loadMore()
  await sleep(700)
  check('loadMore 是「追加」不是「覆盖」', order.data.orders.length > 2, '实际 ' + order.data.orders.length)
  check('首页数据仍保留在列表中', firstPageIds.every(id => order.data.orders.some(o => o.id === id)))

  // 状态筛选：修复前后端完全忽略 status
  order.switchTab({ currentTarget: { dataset: { tab: 'charging' } } })
  await sleep(700)
  check('tab=充电中 只返回 charging', order.data.orders.every(o => o.status === 'charging'),
    JSON.stringify(order.data.orders.map(o => o.status)))
  check('tab=充电中 时 page 已重置为 1', order.data.page === 1)
  const chargingCount = order.data.total

  order.switchTab({ currentTarget: { dataset: { tab: 'completed' } } })
  await sleep(700)
  check('tab=已完成 只返回 completed', order.data.orders.every(o => o.status === 'completed'),
    JSON.stringify(order.data.orders.map(o => o.status)))
  check('tab=已完成 有数据', order.data.total >= 1, 'total=' + order.data.total)
  check('两个 tab 结果不同（修复前完全相同）', chargingCount !== order.data.total,
    'charging=' + chargingCount + ' completed=' + order.data.total)

  order.switchTab({ currentTarget: { dataset: { tab: 'all' } } })
  await sleep(700)
  check('tab=全部 数量 >= 前两者', order.data.total >= chargingCount)

  // onShow 重置分页
  order.loadMore()
  await sleep(700)
  const beforeShow = order.data.orders.length
  order.onShow()
  await sleep(700)
  check('onShow 重置到第 1 页且不残留旧分页数据', order.data.page === 1 && order.data.orders.length <= beforeShow,
    'page=' + order.data.page + ' len=' + order.data.orders.length)

  // ================= 4. 充电进度页 =================
  section('4. 充电进度页 pages/charge/progress')
  const charging = order.data.orders.find(o => o.status === 'charging') || (await api.getOrders({ status: 'charging' })).orders[0]
  const prog = loadPage('pages/charge/progress.js')

  // 劫持 setInterval，手动推进轮询
  let pollFn = null
  const realSetInterval = global.setInterval
  global.setInterval = (fn) => { pollFn = fn; return 1 }
  const realClearInterval = global.clearInterval
  global.clearInterval = () => { pollFn = null }

  prog.onLoad({ orderId: String(charging.id) })
  await sleep(600)
  check('订单详情加载成功', !!prog.data.order)
  check('WS 不可用时降级到轮询', typeof pollFn === 'function')

  const targetMin = Number(prog.data.order.targetValue) || 60
  // 推进 6 次 = 30 秒
  for (let i = 0; i < 6; i++) pollFn && pollFn()
  const expectPercent = Math.min(100, Math.round((30 / (targetMin * 60)) * 100))
  const expectLeft = Math.max(0, Math.ceil((targetMin * 60 - 30) / 60))
  check('progressPercent 按秒计算正确', prog.data.progressPercent === expectPercent,
    '实际 ' + prog.data.progressPercent + ' 期望 ' + expectPercent)
  check('剩余时间单位是分钟', prog.data.chargingData.timeLeft === expectLeft,
    '实际 ' + prog.data.chargingData.timeLeft + ' 期望 ' + expectLeft)
  check('剩余时间不会出现「60分钟充了30秒就归零」', prog.data.chargingData.timeLeft > 0)

  global.setInterval = realSetInterval
  global.clearInterval = realClearInterval

  // tabBar 跳转必须 switchTab
  wx.__lastNav = null
  prog.goOrder()
  check('查看订单用 switchTab 跳 tabBar 页', wx.__lastNav === '/pages/order/index', wx.__lastNav)
  wx.__lastNav = null
  prog.goHome()
  check('返回首页用 switchTab', wx.__lastNav === '/pages/index/index', wx.__lastNav)

  // ================= 5. 详情页 & 扫码页 =================
  section('5. 电站详情页 / 扫码页')
  const st = loadPage('pages/station/index.js')
  st.onLoad({ id: '1' })
  await sleep(600)
  check('详情页加载成功', !!(st.data.station && st.data.station.id === 1))
  check('portList 已生成数组', Array.isArray(st.data.portList) && st.data.portList.length === st.data.station.totalPorts)
  check('starList 在 onLoad 已就绪', st.data.starList.length === 5)
  st.setData({ station: Object.assign({}, st.data.station, { freePorts: 2 }) })
  st.selectPort({ currentTarget: { dataset: { port: '5' } } })
  check('占用端口不能被选中', st.data.selectedPort === null || st.data.selectedPort <= 2,
    'selectedPort=' + st.data.selectedPort)
  st.selectPort({ currentTarget: { dataset: { port: '2' } } })
  check('空闲端口可选中', st.data.selectedPort === 2)

  // 用 spy 抓住真正传给 api.scanCharge 的字符串，验证编解码往返无损
  let captured = null
  const origScanCharge = api.scanCharge
  api.scanCharge = (qr) => { captured = qr; return origScanCharge(qr) }

  const scan = loadPage('pages/scan/index.js')
  captured = null
  scan.onLoad({ qrcode: encodeURIComponent('LCC001') })
  await sleep(600)
  check('二维码解码后与原始内容一致', captured === 'LCC001', JSON.stringify(captured))
  check('扫码命中站点', !!(scan.data.station && scan.data.station.stationCode === 'LCC001'),
    JSON.stringify(scan.data.station && scan.data.station.name))

  // 真实二维码常是带 ? & 的 URL，修复前会在 URL query 里被截断
  const weird = 'charge://pile?code=LCC001&port=3#frag'
  captured = null
  scan.onLoad({ qrcode: encodeURIComponent(weird) })
  await sleep(300)
  check('含 ? & # 的二维码内容解码完整', captured === weird, JSON.stringify(captured))

  // 未编码场景不能崩
  captured = null
  scan.onLoad({ qrcode: 'LCC001' })
  await sleep(300)
  check('未编码的裸参数也能正常处理', captured === 'LCC001', JSON.stringify(captured))

  api.scanCharge = origScanCharge

  // ================= 汇总 =================
  console.log(results.join('\n'))
  console.log('\n================================')
  console.log('  通过 ' + passed + ' 项，失败 ' + failed + ' 项')
  console.log('================================')
  process.exit(failed ? 1 : 0)
}

main().catch(e => {
  console.log(results.join('\n'))
  console.error('\n[已执行到的断言] 共 ' + results.length + ' 行')
  console.error('测试异常:', e && e.stack ? e.stack : e)
  process.exit(1)
})
