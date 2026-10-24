-- ============================================================
-- AI 智能商品管理系统 - 测试数据
-- 执行：mysql -uroot -p ai_product < sql/data.sql
-- ============================================================

USE `ai_product`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `categories`;
TRUNCATE TABLE `products`;
TRUNCATE TABLE `inventory`;
TRUNCATE TABLE `customers`;
TRUNCATE TABLE `orders`;
TRUNCATE TABLE `order_items`;
TRUNCATE TABLE `knowledge_documents`;
TRUNCATE TABLE `chat_history`;
TRUNCATE TABLE `agent_logs`;
TRUNCATE TABLE `system_logs`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- 用户（密码都是 123456 的 sha256） ----------
INSERT INTO `users` (`id`, `username`, `password`, `nickname`, `role`, `phone`, `email`) VALUES
(1, 'admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', '管理员', 'admin', '13800000000', 'admin@example.com');

-- ---------- 商品分类（一级 + 二级） ----------
INSERT INTO `categories` (`id`, `name`, `parent_id`, `sort`, `description`) VALUES
(1,  '手机',   0, 1, '智能手机'),
(2,  '电脑',   0, 2, '笔记本电脑与台式机'),
(3,  '耳机',   0, 3, '蓝牙耳机与头戴耳机'),
(4,  '配件',   0, 4, '数据线、充电器等'),
(11, 'iPhone', 1, 1, '苹果手机'),
(12, '小米',   1, 2, '小米手机'),
(13, '华为',   1, 3, '华为手机'),
(21, 'MacBook', 2, 1, '苹果笔记本'),
(22, 'ThinkPad', 2, 2, '联想商务本'),
(23, '戴尔',   2, 3, '戴尔笔记本'),
(31, 'AirPods', 3, 1, '苹果耳机'),
(32, '索尼',   3, 2, '索尼耳机');

-- ---------- 商品 ----------
INSERT INTO `products` (`id`, `name`, `sku`, `category_id`, `brand`, `price`, `cost`, `description`, `status`, `sales`) VALUES
(1,  'iPhone 15 128G 蓝色',  'IP15-128-BL', 11, 'Apple',  5999.00, 4800.00, 'A16 芯片，6.1 英寸超视网膜 XDR 显示屏，支持灵动岛。', 1, 320),
(2,  'iPhone 16 Pro 256G',  'IP16P-256',   11, 'Apple',  8999.00, 7200.00, 'A18 Pro 芯片，钛金属边框，4800 万像素融合式摄像头。',  1, 186),
(3,  '小米 14 12+256',      'MI14-256',    12, '小米',   3999.00, 3200.00, '骁龙 8 Gen3，徕卡光学镜头，支持 90W 快充。',          1, 245),
(4,  '小米 15 Pro',         'MI15P-512',   12, '小米',   5299.00, 4300.00, '骁龙 8 至尊版，2K 屏幕，6100mAh 大电池。',            1, 98),
(5,  '华为 Mate 60 Pro',    'HW60P-512',   13, '华为',   7499.00, 6200.00, '麒麟 9000S，卫星通话，昆仑玻璃二代。',                1, 152),
(6,  '华为 Mate X5 折叠屏', 'HWX5-256',    13, '华为',  12999.00, 11000.00, '超轻薄四曲折叠，昆仑玻璃，双向北斗卫星消息。',        1, 36),
(7,  'MacBook Air M3 13寸', 'MBA-M3-13',   21, 'Apple',  8999.00, 7600.00, 'M3 芯片，18 小时续航，1.24kg 轻薄机身。',             1, 210),
(8,  'MacBook Pro 14 M4',   'MBP-M4-14',   21, 'Apple', 14999.00, 12800.00, 'M4 Pro 芯片，Liquid 视网膜 XDR 显示屏。',             1, 88),
(9,  'ThinkPad X1 Carbon',  'TPX1C-14',    22, '联想',  11999.00, 10200.00, '14 英寸碳纤维机身，Intel Ultra 7，军标可靠性。',      1, 64),
(10, '戴尔 XPS 13 Plus',    'DELLXPS13P',  23, '戴尔',   9699.00, 8300.00, '13.4 英寸 3.5K OLED 屏，全隐藏式触控板。',            1, 42),
(11, 'AirPods Pro 2',       'APP2-USB-C',  31, 'Apple',  1899.00, 1450.00, '主动降噪，自适应通透模式，支持 USB-C 充电盒。',       1, 520),
(12, 'AirPods 4',           'AP4-2024',    31, 'Apple',   1299.00, 980.00,  '全新人体工学设计，个性化空间音频。',                  1, 340),
(13, '索尼 WH-1000XM5',     'SONYXM5',     32, '索尼',   2899.00, 2300.00, '业界领先降噪，30 小时续航，LDAC 高解析音质。',        1, 128),
(14, '小米无线充电器 80W',  'MI-WC-80W',   4,  '小米',    299.00, 190.00,  '80W 快充，智能温控，兼容多机型。',                     0, 76),
(15, 'Apple 20W 充电头',    'AP-20W',      4,  'Apple',   149.00, 95.00,   '20W USB-C 电源适配器，支持快充。',                     1, 610);

-- ---------- 库存（含预警、缺货样例） ----------
INSERT INTO `inventory` (`product_id`, `current_stock`, `safe_stock`, `max_stock`, `warehouse`) VALUES
(1,  120, 30, 500,  '主仓库'),
(2,  18,  20, 300,  '主仓库'),   -- 预警
(3,  260, 40, 800,  '主仓库'),
(4,  0,   15, 200,  '主仓库'),   -- 缺货
(5,  85,  25, 400,  '主仓库'),
(6,  12,  10, 100,  '主仓库'),
(7,  140, 30, 500,  '主仓库'),
(8,  7,   15, 150,  '主仓库'),   -- 预警
(9,  33,  20, 200,  '主仓库'),
(10, 9,   12, 150,  '主仓库'),   -- 预警
(11, 480, 60, 1200, '主仓库'),
(12, 305, 50, 1000, '主仓库'),
(13, 66,  20, 300,  '主仓库'),
(14, 0,   10, 200,  '主仓库'),   -- 缺货
(15, 900, 100, 2000, '主仓库');

-- ---------- 客户 ----------
INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `level`, `total_orders`, `total_amount`, `last_order_time`) VALUES
(1, '张伟', '13811110001', 'zhangwei@example.com', 'svip',   12, 128620.00, '2025-09-27 10:24:00'),
(2, '李娜', '13811110002', 'lina@example.com',     'vip',     8,  56400.00, '2025-09-26 15:10:00'),
(3, '王强', '13811110003', 'wangqiang@example.com', 'vip',    6,  38900.00, '2025-09-25 09:30:00'),
(4, '刘敏', '13811110004', 'liumin@example.com',   'normal',  3,   9800.00, '2025-09-23 18:45:00'),
(5, '陈杰', '13811110005', 'chenjie@example.com',  'normal',  2,   6298.00, '2025-09-21 11:05:00'),
(6, '赵雪', '13811110006', 'zhaoxue@example.com',  'normal',  1,   1899.00, '2025-09-20 16:20:00');

-- ---------- 订单 ----------
INSERT INTO `orders` (`order_no`, `customer_id`, `customer_name`, `total_amount`, `status`, `remark`, `created_at`) VALUES
('SO20250920001', 6, '赵雪',   1899.00, 'completed', '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '16:20:00')),
('SO20250921001', 5, '陈杰',   5999.00, 'completed', '尽快发货',       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '11:05:00')),
('SO20250921002', 4, '刘敏',   1299.00, 'completed', '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '14:30:00')),
('SO20250922001', 1, '张伟',  14999.00, 'completed', '公司采购',       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '09:12:00')),
('SO20250922002', 2, '李娜',   3999.00, 'completed', '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '17:40:00')),
('SO20250923001', 3, '王强',  12999.00, 'completed', '需要发票',       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY), '10:00:00')),
('SO20250923002', 4, '刘敏',   2899.00, 'completed', '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '18:45:00')),
('SO20250924001', 1, '张伟',   8999.00, 'completed', '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:55:00')),
('SO20250924002', 2, '李娜',   1899.00, 'shipped',   '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '20:10:00')),
('SO20250925001', 3, '王强',   7499.00, 'shipped',   '顺丰',           TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:30:00')),
('SO20250925002', 1, '张伟',   5299.00, 'to_ship',   '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '15:20:00')),
('SO20250926001', 2, '李娜',   9699.00, 'paid',      '',               TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '15:10:00')),
('SO20250926002', 5, '陈杰',   299.00,  'cancelled', '用户取消',       TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '19:00:00')),
('SO20250927001', 1, '张伟',   8999.00, 'pending',   '等待付款',       TIMESTAMP(CURDATE(), '10:24:00')),
('SO20250927002', 3, '王强',   2899.00, 'pending',   '',               TIMESTAMP(CURDATE(), '14:02:00'));

-- ---------- 订单明细 ----------
INSERT INTO `order_items` (`order_id`, `product_id`, `product_name`, `price`, `quantity`, `subtotal`) VALUES
(1,  11, 'AirPods Pro 2',        1899.00, 1,  1899.00),
(2,  1,  'iPhone 15 128G 蓝色',  5999.00, 1,  5999.00),
(3,  12, 'AirPods 4',            1299.00, 1,  1299.00),
(4,  8,  'MacBook Pro 14 M4',   14999.00, 1, 14999.00),
(5,  3,  '小米 14 12+256',       3999.00, 1,  3999.00),
(6,  6,  '华为 Mate X5 折叠屏', 12999.00, 1, 12999.00),
(7,  13, '索尼 WH-1000XM5',      2899.00, 1,  2899.00),
(8,  7,  'MacBook Air M3 13寸',  8999.00, 1,  8999.00),
(9,  11, 'AirPods Pro 2',        1899.00, 1,  1899.00),
(10, 5,  '华为 Mate 60 Pro',     7499.00, 1,  7499.00),
(11, 4,  '小米 15 Pro',          5299.00, 1,  5299.00),
(12, 10, '戴尔 XPS 13 Plus',     9699.00, 1,  9699.00),
(13, 14, '小米无线充电器 80W',    299.00, 1,   299.00),
(14, 7,  'MacBook Air M3 13寸',  8999.00, 1,  8999.00),
(15, 13, '索尼 WH-1000XM5',      2899.00, 1,  2899.00);

-- ---------- 知识库文档（首次上传后由后端回填 chunk/vector 数量） ----------
INSERT INTO `knowledge_documents` (`doc_name`, `category`, `file_path`, `chunk_count`, `vector_count`, `status`) VALUES
('iphone15.txt',            'products',   'products/iphone15.txt',            3, 3, 'indexed'),
('iphone16.txt',            'products',   'products/iphone16.txt',            3, 3, 'indexed'),
('airpods.txt',             'products',   'products/airpods.txt',             3, 3, 'indexed'),
('macbook.txt',             'products',   'products/macbook.txt',             3, 3, 'indexed'),
('return_policy.txt',       'after_sale', 'after_sale/return_policy.txt',     3, 3, 'indexed'),
('warranty.txt',            'after_sale', 'after_sale/warranty.txt',          3, 3, 'indexed'),
('refund.txt',              'after_sale', 'after_sale/refund.txt',            3, 3, 'indexed'),
('inventory_rule.txt',      'inventory',  'inventory/inventory_rule.txt',     3, 3, 'indexed'),
('product_management.txt',  'system',     'system/product_management.txt',    3, 3, 'indexed');

-- ---------- 示例会话 ----------
INSERT INTO `chat_history` (`session_id`, `question`, `answer`, `source`, `refs`, `elapsed_ms`) VALUES
('demo', 'AirPods Pro 的保修期多久？', 'AirPods Pro 2 自购买之日起提供 1 年整机保修，主要部件保修 2 年，支持 AppleCare+ 延长服务。', 'rag', 'warranty.txt,airpods.txt', 1820);

-- ---------- 示例 Agent 调用链 ----------
INSERT INTO `agent_logs` (`session_id`, `question`, `agent`, `tool_name`, `tool_params`, `tool_result`, `answer`, `status`, `elapsed_ms`) VALUES
('demo', '帮我看看库存不足的商品，并告诉我应该优先补哪个。', 'ProductAgent', 'get_low_stock_products', '{}',
 '[{"name":"小米 15 Pro","current_stock":0,"safe_stock":15},{"name":"iPhone 16 Pro 256G","current_stock":18,"safe_stock":20},{"name":"MacBook Pro 14 M4","current_stock":7,"safe_stock":15}]',
 '当前有 2 个商品已缺货、3 个商品低于安全库存。建议优先补货「小米 15 Pro」（已缺货，且近期销量增长明显）。', 'success', 4360);

-- ---------- 系统日志 ----------
INSERT INTO `system_logs` (`level`, `module`, `message`) VALUES
('INFO',    'system',  '系统启动成功'),
('INFO',    'rag',     '知识库加载完成，共 9 个文档 / 27 个文本块'),
('WARNING', 'inventory', '检测到 2 个商品库存为 0：小米 15 Pro、小米无线充电器 80W');
