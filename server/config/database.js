// server/config/database.js - 数据库配置
const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'charging_radar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

async function initDB() {
  const connection = await pool.getConnection()
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        openid VARCHAR(64) UNIQUE NOT NULL,
        nickname VARCHAR(64),
        avatar_url VARCHAR(512),
        phone VARCHAR(20),
        user_type ENUM('rider','courier','normal') DEFAULT 'normal',
        city VARCHAR(32),
        lat DECIMAL(10,7),
        lng DECIMAL(10,7),
        balance DECIMAL(10,2) DEFAULT 0.00,
        points INT DEFAULT 0,
        reputation_score INT DEFAULT 100,
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_openid (openid),
        INDEX idx_city_type (city, user_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS charging_stations (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        station_code VARCHAR(64) UNIQUE,
        name VARCHAR(128) NOT NULL,
        brand VARCHAR(64) DEFAULT 'other',
        operator VARCHAR(128),
        total_ports INT NOT NULL DEFAULT 0,
        free_ports INT DEFAULT 0,
        occupied_ports INT DEFAULT 0,
        fault_ports INT DEFAULT 0,
        status ENUM('online','offline','fault','unknown') DEFAULT 'unknown',
        price_per_hour DECIMAL(5,2) DEFAULT 0.00,
        price_detail JSON,
        power_type ENUM('slow','fast','super') DEFAULT 'slow',
        lat DECIMAL(10,7) NOT NULL,
        lng DECIMAL(10,7) NOT NULL,
        address VARCHAR(256),
        city VARCHAR(32),
        district VARCHAR(32),
        tags JSON,
        images JSON,
        phone VARCHAR(20),
        business_hours VARCHAR(64),
        verification_status ENUM('unverified','verified','suspicious') DEFAULT 'unverified',
        last_heartbeat_at DATETIME,
        data_source ENUM('user_report','api_sync','manual_input') DEFAULT 'user_report',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_brand_status (brand, status),
        INDEX idx_city (city),
        INDEX idx_location (lat, lng)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        order_no VARCHAR(32) UNIQUE NOT NULL,
        user_id BIGINT NOT NULL,
        station_id BIGINT NOT NULL,
        port_no INT NOT NULL,
        status ENUM('pending','charging','completed','cancelled','fault') DEFAULT 'pending',
        charge_mode ENUM('by_time','by_amount','full') NOT NULL,
        target_value DECIMAL(10,2),
        start_time DATETIME,
        end_time DATETIME,
        power_used DECIMAL(8,3) DEFAULT 0,
        duration_minutes INT DEFAULT 0,
        total_cost DECIMAL(8,2) DEFAULT 0,
        payment_status ENUM('unpaid','paid','refunded') DEFAULT 'unpaid',
        payment_method VARCHAR(32),
        wx_transaction_id VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_station (station_id),
        INDEX idx_order_no (order_no),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_contributions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        station_id BIGINT,
        contribution_type ENUM('scan','photo','review','verify','report','invite') NOT NULL,
        points_earned INT NOT NULL DEFAULT 0,
        description VARCHAR(256),
        images JSON,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        reviewer_id BIGINT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_type (contribution_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `)
    
    console.log('✅ 数据库表初始化完成')
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err)
    throw err
  } finally {
    connection.release()
  }
}

function query(sql, params) {
  return pool.execute(sql, params)
}

module.exports = { pool, query, initDB }
