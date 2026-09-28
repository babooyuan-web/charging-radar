# -*- coding: utf-8 -*-
import sqlite3, json, os, time, uuid, math, hashlib, hmac, base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = 3000
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'test.db')
SEED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'seed_stations.json')
JWT_SECRET = 'charging-radar-secret-key'

def haversine(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlmb/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def b64url(s):
    return base64.urlsafe_b64encode(s.encode() if isinstance(s,str) else s).rstrip(b'=').decode()

def jwt_sign(payload):
    header = json.dumps({"alg":"HS256","typ":"JWT"},separators=(',',':'))
    payload['iat'] = int(time.time())
    payload['exp'] = payload['iat'] + 86400
    payload_json = json.dumps(payload,separators=(',',':'))
    sig_input = f"{b64url(header)}.{b64url(payload_json)}"
    sig = hmac.new(JWT_SECRET.encode(), sig_input.encode(), hashlib.sha256).digest()
    return f"{sig_input}.{b64url(sig)}"

def jwt_verify(token):
    try:
        parts = token.split('.')
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
        return payload if payload.get('exp',0) > time.time() else None
    except:
        return None

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def insert_station(db, s):
    """从 seed_stations.json 的字典插入一条站点记录"""
    db.execute(
        "INSERT INTO charging_stations (station_code,name,brand,operator,total_ports,free_ports,occupied_ports,fault_ports,status,price_per_hour,power_type,lat,lng,address,city,district,tags,phone,business_hours,data_source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'manual_input')",
        (
            s['code'], s['name'], s['brand'], s['operator'],
            s['totalPorts'], s['freePorts'], s['occupiedPorts'], s['faultPorts'],
            s['status'], s['price'], s['powerType'],
            s['lat'], s['lng'], s['address'], s['city'], s['district'],
            json.dumps(s['tags'], ensure_ascii=False), s['phone'], s['hours']
        )
    )

def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            openid TEXT UNIQUE NOT NULL, nickname TEXT, avatar_url TEXT, phone TEXT,
            user_type TEXT DEFAULT 'normal', city TEXT, lat REAL, lng REAL,
            balance REAL DEFAULT 0, points INTEGER DEFAULT 0, reputation_score INTEGER DEFAULT 100,
            last_login_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS charging_stations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, station_code TEXT UNIQUE, name TEXT NOT NULL,
            brand TEXT DEFAULT 'other', operator TEXT, total_ports INTEGER DEFAULT 0,
            free_ports INTEGER DEFAULT 0, occupied_ports INTEGER DEFAULT 0, fault_ports INTEGER DEFAULT 0,
            status TEXT DEFAULT 'unknown', price_per_hour REAL DEFAULT 0, price_detail TEXT,
            power_type TEXT DEFAULT 'slow', lat REAL NOT NULL, lng REAL NOT NULL,
            address TEXT, city TEXT, district TEXT, tags TEXT, images TEXT,
            phone TEXT, business_hours TEXT, verification_status TEXT DEFAULT 'unverified',
            last_heartbeat_at TEXT, data_source TEXT DEFAULT 'user_report',
            created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL, station_id INTEGER NOT NULL, port_no INTEGER NOT NULL,
            status TEXT DEFAULT 'pending', charge_mode TEXT NOT NULL, target_value REAL,
            start_time TEXT, end_time TEXT, power_used REAL DEFAULT 0,
            duration_minutes INTEGER DEFAULT 0, total_cost REAL DEFAULT 0,
            payment_status TEXT DEFAULT 'unpaid', payment_method TEXT,
            wx_transaction_id TEXT, platform_fee REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS user_contributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, station_id INTEGER,
            contribution_type TEXT NOT NULL, points_earned INTEGER DEFAULT 0,
            description TEXT, images TEXT, status TEXT DEFAULT 'pending',
            reviewer_id INTEGER, reviewed_at TEXT, created_at TEXT DEFAULT (datetime('now'))
        );
    ''')
    db.execute("DELETE FROM charging_stations")
    # 必须同时重置 AUTOINCREMENT 序列，否则每次重启站点 id 都会往上漂移，
    # 前端已渲染/收藏的 id 全部失效
    db.execute("DELETE FROM sqlite_sequence WHERE name='charging_stations'")

    # 从 JSON 读取中文种子数据（避免源码编码问题）
    try:
        with open(SEED_PATH, 'r', encoding='utf-8') as f:
            seed = json.load(f)
        for s in seed:
            insert_station(db, s)
        print(f'已载入 {len(seed)} 个充电桩')
    except FileNotFoundError:
        print(f'警告：未找到 {SEED_PATH}，跳过站点初始化')

    db.execute("INSERT OR IGNORE INTO users (openid,nickname,avatar_url,user_type,city,points,balance) VALUES ('mock_openid_001','骑手小王','','rider','深圳',150,25.50)")
    db.commit()
    db.close()
    print('DB initialized')

class APIHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  {args[0]}")

    # 读取并解析 JSON 请求体（非法 JSON 不再抛异常炸掉连接）
    def json_body(self):
        try:
            cl = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError):
            cl = 0
        raw = self.rfile.read(cl) if cl > 0 else b'{}'
        try:
            return json.loads(raw.decode('utf-8') or '{}')
        except Exception:
            return {}

    # 统一错误响应：必须带 code 字段，否则前端 res.data.code 判断失效
    def err(self, http_status, code, message):
        return self.resp(http_status, {'code': code, 'message': message, 'data': None})

    def do_GET(self):
        p = urlparse(self.path)
        q = parse_qs(p.query)
        path = p.path
        if path == '/health':
            return self.resp(200, {'code':0,'message':'OK','data':{'uptime':time.time()}})
        if path == '/api/v1/stations/nearby':
            return self.handle_nearby(q)
        if path.startswith('/api/v1/stations/'):
            sid = path.split('/')[-1]
            if sid != 'nearby':
                return self.handle_station_detail(sid)
        if path == '/api/v1/orders':
            return self.handle_orders_list(q)
        if path.startswith('/api/v1/orders/'):
            parts = path.split('/')
            if parts[-1] == 'stop':
                return self.handle_stop_order(parts[-2])
            return self.handle_order_detail(parts[-1])
        if path == '/api/v1/me':
            return self.handle_profile()
        if path == '/api/v1/me/points':
            return self.handle_points()
        return self.err(404, 404, '接口不存在')

    def do_POST(self):
        parsed = urlparse(self.path)
        data = self.json_body()
        path = parsed.path
        if path == '/api/v1/auth/login':
            return self.handle_login(data)
        if path == '/api/v1/scan':
            return self.handle_scan(data)
        if path == '/api/v1/stations':
            return self.handle_create_station(data)
        if path == '/api/v1/orders':
            return self.handle_start_charge(data)
        # POST /api/v1/orders/:id/stop
        if path.startswith('/api/v1/orders/'):
            parts = path.split('/')
            if parts[-1] == 'stop':
                return self.handle_stop_order(parts[-2])
        return self.err(404, 404, '接口不存在')

    def do_PUT(self):
        parsed = urlparse(self.path)
        data = self.json_body()
        if parsed.path == '/api/v1/me':
            return self.handle_update_profile(data)
        return self.err(404, 404, '接口不存在')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        self.end_headers()

    def resp(self, code, data):
        body = json.dumps(data, default=str, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def auth_user(self):
        auth = self.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return jwt_verify(auth[7:])
        return None

    def handle_login(self, data):
        code = data.get('code', '')
        user_info = data.get('userInfo') or {}
        user_type = data.get('userType', 'normal')
        openid = f"mock_{code[-8:]}" if code else 'mock_default'
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE openid=?', (openid,)).fetchone()
        if not user:
            db.execute('INSERT INTO users (openid,nickname,avatar_url,user_type,city) VALUES (?,?,?,?,?)',
                (openid, user_info.get('nickName','用户'), user_info.get('avatarUrl',''), user_type, '深圳'))
            db.commit()
            user = db.execute('SELECT * FROM users WHERE openid=?', (openid,)).fetchone()
        else:
            # 更新用户类型和昵称
            db.execute('UPDATE users SET user_type=?, nickname=? WHERE id=?',
                (user_type, user_info.get('nickName') or user['nickname'], user['id']))
            db.commit()
            user = db.execute('SELECT * FROM users WHERE openid=?', (openid,)).fetchone()
        token = jwt_sign({'userId':user['id'],'openid':user['openid']})
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'token':token,'userInfo':{
            'id':user['id'],'nickname':user['nickname'],'avatarUrl':user['avatar_url'],
            'userType':user['user_type'],'points':user['points'],'balance':user['balance']
        }}})

    def handle_nearby(self, q):
        # 兼容 lat/lng 和 latitude/longitude
        lat = float(q.get('lat', q.get('latitude', [22.5329]))[0])
        lng = float(q.get('lng', q.get('longitude', [113.9366]))[0])
        radius = float(q.get('radius',[5000])[0])
        brand = q.get('brand',['all'])[0]
        status = q.get('status',['all'])[0]
        sort = q.get('sort',['distance'])[0]
        db = get_db()
        rows = db.execute('SELECT * FROM charging_stations').fetchall()
        stations = []
        for r in rows:
            s = dict(r)
            dist = haversine(lat, lng, s['lat'], s['lng'])
            if dist > radius:
                continue
            # 转换snake_case → camelCase，对齐前端字段名
            station = {
                'id': s['id'],
                'stationCode': s['station_code'],
                'name': s['name'],
                'brand': s['brand'],
                'operator': s['operator'],
                'totalPorts': s['total_ports'],
                'freePorts': s['free_ports'],
                'occupiedPorts': s['occupied_ports'],
                'faultPorts': s['fault_ports'],
                'status': s['status'],
                'pricePerHour': s['price_per_hour'],
                'priceDetail': s['price_detail'],
                'powerType': s['power_type'],
                'lat': s['lat'],
                'lng': s['lng'],
                'address': s['address'],
                'city': s['city'],
                'district': s['district'],
                'tags': json.loads(s['tags'] or '[]'),
                'images': s['images'],
                'phone': s['phone'],
                'businessHours': s['business_hours'],
                'verificationStatus': s['verification_status'],
                'lastHeartbeatAt': s['last_heartbeat_at'],
                'dataSource': s['data_source'],
                'createdAt': s['created_at'],
                'updatedAt': s['updated_at'],
                'distance': round(dist),
            }
            if brand != 'all' and station['brand'] != brand:
                continue
            if status == 'free' and station['freePorts'] <= 0:
                continue
            if status == 'full' and station['freePorts'] > 0:
                continue
            stations.append(station)
        if sort == 'price':
            stations.sort(key=lambda x: x['pricePerHour'])
        elif sort == 'free':
            stations.sort(key=lambda x: x['freePorts'], reverse=True)
        else:
            stations.sort(key=lambda x: x['distance'])
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'stations':stations,'total':len(stations)}})

    def handle_station_detail(self, sid):
        db = get_db()
        row = db.execute('SELECT * FROM charging_stations WHERE id=?', (sid,)).fetchone()
        db.close()
        if not row:
            return self.err(404, 404, '充电桩不存在')
        s = dict(row)
        station = {
            'id': s['id'],
            'stationCode': s['station_code'],
            'name': s['name'],
            'brand': s['brand'],
            'operator': s['operator'],
            'totalPorts': s['total_ports'],
            'freePorts': s['free_ports'],
            'occupiedPorts': s['occupied_ports'],
            'faultPorts': s['fault_ports'],
            'status': s['status'],
            'pricePerHour': s['price_per_hour'],
            'priceDetail': s['price_detail'],
            'powerType': s['power_type'],
            'lat': s['lat'],
            'lng': s['lng'],
            'address': s['address'],
            'city': s['city'],
            'district': s['district'],
            'tags': json.loads(s['tags'] or '[]'),
            'images': s['images'],
            'phone': s['phone'],
            'businessHours': s['business_hours'],
            'verificationStatus': s['verification_status'],
            'lastHeartbeatAt': s['last_heartbeat_at'],
            'dataSource': s['data_source'],
            'createdAt': s['created_at'],
            'updatedAt': s['updated_at'],
        }
        return self.resp(200, {'code':0,'message':'OK','data':station})

    def handle_scan(self, data):
        qrcode = data.get('qrcode', '')
        db = get_db()
        row = db.execute('SELECT * FROM charging_stations WHERE station_code=?', (qrcode,)).fetchone()
        db.close()
        if not row:
            return self.resp(200, {'code':0,'message':'OK','data':{'found':False}})
        s = dict(row)
        station = {
            'id': s['id'],
            'stationCode': s['station_code'],
            'name': s['name'],
            'brand': s['brand'],
            'operator': s['operator'],
            'totalPorts': s['total_ports'],
            'freePorts': s['free_ports'],
            'occupiedPorts': s['occupied_ports'],
            'faultPorts': s['fault_ports'],
            'status': s['status'],
            'pricePerHour': s['price_per_hour'],
            'priceDetail': s['price_detail'],
            'powerType': s['power_type'],
            'lat': s['lat'],
            'lng': s['lng'],
            'address': s['address'],
            'city': s['city'],
            'district': s['district'],
            'tags': json.loads(s['tags'] or '[]'),
            'images': s['images'],
            'phone': s['phone'],
            'businessHours': s['business_hours'],
            'verificationStatus': s['verification_status'],
            'lastHeartbeatAt': s['last_heartbeat_at'],
            'dataSource': s['data_source'],
            'createdAt': s['created_at'],
            'updatedAt': s['updated_at'],
        }
        return self.resp(200, {'code':0,'message':'OK','data':{'found':True,'station':station}})

    def handle_create_station(self, data):
        db = get_db()
        sc = data.get('station_code', f'REP{int(time.time())}')
        tp = data.get('totalPorts', 0)
        db.execute('INSERT INTO charging_stations (station_code,name,brand,total_ports,free_ports,price_per_hour,lat,lng,address,tags,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            (sc, data.get('name',''), data.get('brand','other'), tp, tp,
             data.get('pricePerHour',0), data.get('lat',0), data.get('lng',0),
             data.get('address',''), json.dumps(data.get('tags',[])), 'unknown'))
        db.commit()
        new_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'id':new_id}})

    def serialize_order(self, r, station=None):
        """订单 snake_case → camelCase"""
        o = dict(r)
        result = {
            'id': o['id'],
            'orderNo': o['order_no'],
            'userId': o['user_id'],
            'stationId': o['station_id'],
            'stationName': o.get('station_name') or (station['name'] if station else ''),
            'stationBrand': o.get('station_brand') or (station['brand'] if station else 'other'),
            'portNo': o['port_no'],
            'status': o['status'],
            'chargeMode': o['charge_mode'],
            'targetValue': o['target_value'],
            'startTime': o['start_time'],
            'endTime': o['end_time'],
            'powerUsed': o['power_used'],
            'durationMinutes': o['duration_minutes'],
            'totalCost': o['total_cost'],
            'paymentStatus': o['payment_status'],
            'paymentMethod': o['payment_method'],
            'createdAt': o['created_at'],
            'updatedAt': o['updated_at'],
        }
        if station:
            result['station'] = {
                'id': station['id'],
                'name': station['name'],
                'brand': station['brand'],
                'address': station['address'],
                'lat': station['lat'],
                'lng': station['lng'],
            }
        return result

    def handle_orders_list(self, q):
        user = self.auth_user()
        # 状态筛选：all / charging / completed
        status = q.get('status', ['all'])[0]
        try:
            page = max(1, int(q.get('page', ['1'])[0]))
        except (TypeError, ValueError):
            page = 1
        try:
            size = min(50, max(1, int(q.get('size', ['10'])[0])))
        except (TypeError, ValueError):
            size = 10

        db = get_db()
        sql = 'SELECT o.*, s.name as station_name, s.brand as station_brand FROM orders o LEFT JOIN charging_stations s ON o.station_id=s.id'
        where = []
        args = []
        if user:
            where.append('o.user_id=?')
            args.append(user['userId'])
        if status and status != 'all':
            where.append('o.status=?')
            args.append(status)
        if where:
            sql += ' WHERE ' + ' AND '.join(where)

        # total 必须按筛选后的全量统计，否则分页的 hasMore 会算错
        total = db.execute(
            'SELECT COUNT(*) as cnt FROM orders o' + (' WHERE ' + ' AND '.join(where) if where else ''),
            args
        ).fetchone()['cnt']

        sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
        args.extend([size, (page - 1) * size])
        rows = db.execute(sql, args).fetchall()
        db.close()
        orders = [self.serialize_order(r) for r in rows]
        return self.resp(200, {'code':0,'message':'OK','data':{'orders':orders,'total':total,'page':page,'size':size}})

    def handle_order_detail(self, oid):
        db = get_db()
        row = db.execute('SELECT o.*, s.name as station_name FROM orders o LEFT JOIN charging_stations s ON o.station_id=s.id WHERE o.id=?', (oid,)).fetchone()
        if not row:
            db.close()
            return self.err(404, 404, '订单不存在')
        station = db.execute('SELECT * FROM charging_stations WHERE id=?', (row['station_id'],)).fetchone()
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':self.serialize_order(row, station)})

    def handle_start_charge(self, data):
        user = self.auth_user()
        if not user:
            return self.err(401, 401, '登录已过期，请重新登录')
        db = get_db()
        station = db.execute('SELECT * FROM charging_stations WHERE id=?', (data.get('stationId'),)).fetchone()
        if not station:
            db.close()
            return self.err(404, 404, '充电桩不存在')
        try:
            port_no = int(data.get('portNo'))
        except (TypeError, ValueError):
            db.close()
            return self.err(400, 400, '请选择充电端口')
        if port_no < 1 or port_no > station['total_ports']:
            db.close()
            return self.err(400, 400, '端口编号不存在')
        # 空闲端口为 0 时拒绝下单，否则 free_ports 会被扣成负数
        if station['free_ports'] <= 0:
            db.close()
            return self.err(400, 400, '暂无空闲端口')
        order_no = f"CR{time.strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"
        db.execute('INSERT INTO orders (order_no,user_id,station_id,port_no,charge_mode,target_value,status,start_time) VALUES (?,?,?,?,?,?,?,datetime("now"))',
            (order_no, user['userId'], data['stationId'], port_no, data.get('chargeMode','by_time'), data.get('targetValue',0), 'charging'))
        db.execute('UPDATE charging_stations SET free_ports=MAX(0,free_ports-1), occupied_ports=occupied_ports+1 WHERE id=?', (data['stationId'],))
        db.commit()
        new_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'id':new_id,'orderNo':order_no}})

    def handle_stop_order(self, oid):
        user = self.auth_user()
        if not user:
            return self.err(401, 401, '登录已过期，请重新登录')
        db = get_db()
        row = db.execute('SELECT * FROM orders WHERE id=? AND user_id=?', (oid, user['userId'])).fetchone()
        if not row:
            db.close()
            return self.err(404, 404, '订单不存在')
        cost = round(30 * 0.1, 2)
        db.execute('UPDATE orders SET status="completed", end_time=datetime("now"), duration_minutes=30, total_cost=?, payment_status="paid" WHERE id=?', (cost, oid))
        db.execute('UPDATE charging_stations SET free_ports=MIN(total_ports,free_ports+1), occupied_ports=MAX(0,occupied_ports-1) WHERE id=?', (row['station_id'],))
        db.commit()
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'duration':30,'cost':cost}})

    def handle_profile(self):
        user = self.auth_user()
        if not user:
            return self.err(401, 401, '登录已过期，请重新登录')
        db = get_db()
        r = db.execute('SELECT id,nickname,avatar_url,phone,user_type,city,points,balance FROM users WHERE id=?', (user['userId'],)).fetchone()
        # 统计用户订单
        stats_row = db.execute('SELECT COUNT(*) as cnt, COALESCE(SUM(power_used),0) as power, COALESCE(SUM(total_cost),0) as cost FROM orders WHERE user_id=?', (user['userId'],)).fetchone()
        db.close()
        if not r:
            return self.resp(200, {'code':0,'message':'OK','data':{}})
        profile = {
            'id': r['id'],
            'nickname': r['nickname'],
            'avatarUrl': r['avatar_url'] or '',
            'phone': r['phone'] or '',
            'userType': r['user_type'],
            'city': r['city'],
            'points': r['points'],
            'balance': r['balance'],
            'stats': {
                'orderCount': stats_row['cnt'] if stats_row else 0,
                'totalPower': round(stats_row['power'], 2) if stats_row else 0,
                'totalCost': round(stats_row['cost'], 2) if stats_row else 0,
                'carbonSaved': round((stats_row['power'] or 0) * 0.8, 2) if stats_row else 0,
            }
        }
        return self.resp(200, {'code':0,'message':'OK','data':profile})

    def handle_update_profile(self, data):
        user = self.auth_user()
        if not user:
            return self.err(401, 401, '登录已过期，请重新登录')
        db = get_db()
        if 'nickname' in data:
            db.execute('UPDATE users SET nickname=? WHERE id=?', (data['nickname'], user['userId']))
        db.commit()
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'message':'updated'}})

    def handle_points(self):
        user = self.auth_user()
        if not user:
            return self.err(401, 401, '登录已过期，请重新登录')
        db = get_db()
        row = db.execute('SELECT points FROM users WHERE id=?', (user['userId'],)).fetchone()
        db.close()
        return self.resp(200, {'code':0,'message':'OK','data':{'points':row['points'] if row else 0,'logs':[]}})

if __name__ == '__main__':
    init_db()
    server = HTTPServer(('0.0.0.0', PORT), APIHandler)
    print(f'API server: http://localhost:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Stopped')
