// server/routes/stations.js - 充电桩路由
const router = require('express').Router()
const {
  getNearby,
  getDetail,
  create,
  update
} = require('../controllers/stationController')

// 附近充电桩
router.get('/nearby', getNearby)

// 桩详情
router.get('/:id', getDetail)

// 上报新桩
router.post('/', create)

// 更新桩信息
router.put('/:id', update)

module.exports = router
