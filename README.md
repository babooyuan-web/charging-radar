# 电瓶车充电桩雷达小程序

> 一扫即知，全市充电桩实时状态

## 项目简介

聚合驴充充、猛犸充电、小兔充充、云智充等主流充电桩品牌，提供实时空闲状态查询、扫码充电、电量上报、导航找桩等核心功能。

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | 微信原生小程序 (WXML + WXSS + JS) |
| 后端 API | Python 标准库 HTTP Server（零依赖） |
| 数据库 | SQLite |
| 鉴权 | JWT (HS256) |
| 实时 | WebSocket（降级轮询） |

## 目录结构

```
charging-radar/
├── miniprogram/                # 小程序前端
│   ├── app.js                  # 全局入口
│   ├── app.json                # 页面配置
│   ├── app.wxss                # 全局样式
│   ├── api/index.js            # API 封装
│   ├── pages/                  # 8个页面
│   │   ├── index/              # 雷达首页
│   │   ├── login/              # 登录
│   │   ├── station/            # 充电桩详情
│   │   ├── scan/               # 扫码充电
│   │   ├── charge/progress     # 充电进度
│   │   ├── order/              # 订单列表
│   │   ├── order/detail        # 订单详情
│   │   └── me/                 # 个人中心
│   └── static/icons/           # TabBar & 地图标记图标
├── server/
│   ├── mock_api.py             # SQLite Mock API（开发用）
│   └── index.js                # Express 生产 API
├── database/init.sql           # MySQL 建表脚本
├── docs/                       # 文档
│   ├── 电瓶车充电桩雷达小程序_完整PRD.md
│   ├── 电瓶车充电桩雷达小程序_技术资料手册.md
│   └── 充电桩雷达小程序_广告位报价单.md
└── test.db                     # SQLite 数据库文件
```

## 快速开始

### 1. 启动 Mock API 服务器

```bash
cd charging-radar
python server/mock_api.py
```

服务器启动后输出：

```
DB initialized (10 stations + 1 user)
API server: http://localhost:3000  ← 本地开发地址，生产请替换为您的服务器
```

### 2. 在微信开发者工具中导入

1. 打开微信开发者工具
2. 选择「导入项目」
3. 选择 `charging-radar/miniprogram/` 目录
4. AppID 选择「测试号」
5. 进入开发设置 → 服务器域名 → 将 `https://your-server.com` 加入 request 合法域名（本地开发可选「不校验合法域名」）

### 3. 测试账号

| 账号 | 密码 | 说明 |
|------|------|------|
| 任意 code | — | 任意微信登录 code 都能获取 JWT Token |

## API 文档

### 基础信息

- BaseURL: `https://your-server.com/api/v1`
- 数据格式: `{"code": 0, "message": "OK", "data": ...}`
- 认证方式: `Authorization: Bearer <token>`

### 接口列表

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查 | 否 |
| POST | `/auth/login` | 微信登录 | 否 |
| GET | `/stations/nearby` | 附近充电桩 | 否 |
| GET | `/stations/:id` | 充电桩详情 | 否 |
| POST | `/stations` | 上报新桩 | 否 |
| POST | `/scan` | 扫码查桩 | 否 |
| GET | `/orders` | 订单列表 | 否 |
| POST | `/orders` | 启动充电 | 是 |
| GET | `/orders/:id` | 订单详情 | 否 |
| POST | `/orders/:id/stop` | 停止充电 | 是 |
| GET | `/me` | 个人中心 | 是 |
| PUT | `/me` | 更新资料 | 是 |
| GET | `/me/points` | 积分查询 | 是 |

### 参数示例

**附近搜索**

```
GET /api/v1/stations/nearby?lat=22.5329&lng=113.9366&radius=5000&brand=all&status=free&sort=distance
```

**启动充电**

```json
POST /api/v1/orders
{
  "stationId": 1,
  "portNo": 3,
  "chargeMode": "by_time",
  "targetValue": 60
}
```

## 变现模式

### 1. 电量抽成（核心）

| 等级 | 抽成 | 条件 |
|------|------|------|
| 基础 | 3% | 默认 |
| 标准 | 5% | 月充电量 > 1000kWh |
| 深度 | 8% | 月充电量 > 5000kWh |

### 2. 广告位

- 搜索置顶 ¥500/周
- 首页推荐 ¥1000/周
- 开屏广告 ¥2000/天
- 年度框 ¥288,000/年

详见 `docs/充电桩雷达小程序_广告位报价单.md`

## 数据策略

无品牌公开 API，采用三源聚合：

1. **UGC 众包** → 用户上报（积分激励）
2. **高德 POI** → 地理编码 + 地址匹配
3. **政府合作** → 智慧城市数据对接

## 后续规划

- [ ] 品牌 API 接入（云快充 1.5/1.6 协议）
- [ ] 充电桩实时状态 WebSocket 推送
- [ ] 社区评价体系
- [ ] 会员等级 + 积分商城
- [ ] B端运营商 SaaS 后台
- [ ] 城市合伙人代理系统

## License

仅供学习交流使用，商业使用前请自行评估法律风险。
