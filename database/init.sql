-- database/init.sql - 充电桩雷达数据库初始化脚本

CREATE DATABASE IF NOT EXISTS charging_radar DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_general_ci;
USE charging_radar;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) UNIQUE NOT NULL,
  nickname VARCHAR(64) COMMENT '昵称',
  avatar_url VARCHAR(512) COMMENT '头像',
  phone VARCHAR(20) COMMENT '手机号',
  user_type ENUM('rider','courier','normal') DEFAULT 'normal' COMMENT '骑手/快递/普通',
  city VARCHAR(32) COMMENT '城市',
  lat DECIMAL(10,7) COMMENT '纬度',
  lng DECIMAL(10,7) COMMENT '经度',
  balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '余额',
  points INT DEFAULT 0 COMMENT '积分',
  reputation_score INT DEFAULT 100 COMMENT '信誉分',
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_city_type (city, user_type)
) ENGINE=InnoDB COMMENT='用户表';

-- 充电桩表
CREATE TABLE IF NOT EXISTS charging_stations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  station_code VARCHAR(64) UNIQUE COMMENT '桩编号',
  name VARCHAR(128) NOT NULL COMMENT '桩名称',
  brand VARCHAR(64) DEFAULT 'other' COMMENT '品牌',
  operator VARCHAR(128) COMMENT '运营商',
  total_ports INT NOT NULL DEFAULT 0 COMMENT '总端口数',
  free_ports INT DEFAULT 0 COMMENT '空闲端口数',
  occupied_ports INT DEFAULT 0 COMMENT '占用端口数',
  fault_ports INT DEFAULT 0 COMMENT '故障端口数',
  status ENUM('online','offline','fault','unknown') DEFAULT 'unknown' COMMENT '状态',
  price_per_hour DECIMAL(5,2) DEFAULT 0.00 COMMENT '每小时价格',
  price_detail JSON COMMENT '详细价格方案',
  power_type ENUM('slow','fast','super') DEFAULT 'slow' COMMENT '功率类型',
  lat DECIMAL(10,7) NOT NULL COMMENT '纬度',
  lng DECIMAL(10,7) NOT NULL COMMENT '经度',
  address VARCHAR(256) COMMENT '详细地址',
  city VARCHAR(32) COMMENT '城市',
  district VARCHAR(32) COMMENT '行政区',
  tags JSON COMMENT '标签',
  images JSON COMMENT '图片',
  phone VARCHAR(20) COMMENT '客服电话',
  business_hours VARCHAR(64) COMMENT '营业时间',
  verification_status ENUM('unverified','verified','suspicious') DEFAULT 'unverified' COMMENT '验证状态',
  last_heartbeat_at DATETIME COMMENT '最后心跳',
  data_source ENUM('user_report','api_sync','manual_input') DEFAULT 'user_report' COMMENT '数据来源',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_brand_status (brand, status),
  INDEX idx_city (city),
  INDEX idx_location (lat, lng)
) ENGINE=InnoDB COMMENT='充电桩表';

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(32) UNIQUE NOT NULL COMMENT '订单号',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  station_id BIGINT NOT NULL COMMENT '桩ID',
  port_no INT NOT NULL COMMENT '端口号',
  status ENUM('pending','charging','completed','cancelled','fault') DEFAULT 'pending' COMMENT '状态',
  charge_mode ENUM('by_time','by_amount','full') NOT NULL COMMENT '充电模式',
  target_value DECIMAL(10,2) COMMENT '目标值（分钟/元）',
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  power_used DECIMAL(8,3) DEFAULT 0 COMMENT '已充电量kWh',
  duration_minutes INT DEFAULT 0 COMMENT '充电时长',
  total_cost DECIMAL(8,2) DEFAULT 0 COMMENT '总费用',
  payment_status ENUM('unpaid','paid','refunded') DEFAULT 'unpaid' COMMENT '支付状态',
  payment_method VARCHAR(32) COMMENT '支付方式',
  wx_transaction_id VARCHAR(64) COMMENT '微信交易号',
  platform_fee DECIMAL(8,2) DEFAULT 0 COMMENT '平台抽成',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_station (station_id),
  INDEX idx_order_no (order_no),
  INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='订单表';

-- 用户贡献记录
CREATE TABLE IF NOT EXISTS user_contributions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  station_id BIGINT,
  contribution_type ENUM('scan','photo','review','verify','report','invite') NOT NULL COMMENT '贡献类型',
  points_earned INT NOT NULL DEFAULT 0 COMMENT '获得积分',
  description VARCHAR(256) COMMENT '描述',
  images JSON COMMENT '图片',
  status ENUM('pending','approved','rejected') DEFAULT 'pending' COMMENT '审核状态',
  reviewer_id BIGINT COMMENT '审核人',
  reviewed_at DATETIME COMMENT '审核时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_type (contribution_type)
) ENGINE=InnoDB COMMENT='用户贡献记录';

-- 插入示例充电桩数据
INSERT INTO charging_stations (station_code, name, brand, total_ports, free_ports, occupied_ports, price_per_hour, lat, lng, address, city, tags, status) VALUES
('LCC001', '驴充充·科技园社区充电站', '驴充充', 8, 3, 5, 0.80, 22.5329, 113.9366, '深圳市南山区科技园路1号', '深圳', '["有雨棚","24h"]', 'online'),
('LCC002', '驴充充·软件园充电站', '驴充充', 10, 0, 10, 0.90, 22.5400, 113.9450, '深圳软件园A座', '深圳', '["室内"]', 'online'),
('MM001', '猛犸充电·南山区商业广场', '猛犸', 12, 5, 7, 1.00, 22.5250, 113.9280, '南山区商业大街88号', '深圳', '["快充","有雨棚"]', 'online'),
('XTC001', '小兔充充·福田中心区', '小兔', 6, 4, 2, 0.70, 22.5470, 114.0600, '福田区中心城', '深圳', '["24h"]', 'online'),
('YZC001', '云智充·宝安大道站', '云智充', 8, 6, 2, 0.60, 22.5650, 113.8800, '宝安区大道100号', '深圳', '["室内","24h"]', 'online'),
('OTHER001', '无名桩·罗湖老小区', 'other', 4, 2, 2, 1.20, 22.5500, 114.1200, '罗湖区老小区', '深圳', '[]', 'unknown'),
('LCC003', '驴充充·车公庙地铁站', '驴充充', 10, 1, 9, 0.85, 22.5380, 114.0200, '福田区车公庙', '深圳', '["地铁口"]', 'online'),
('MM002', '猛犸充电·大冲国际', '猛犸', 15, 8, 7, 0.95, 22.5450, 113.9550, '大冲国际中心', '深圳', '["快充","室内","有雨棚"]', 'online');
