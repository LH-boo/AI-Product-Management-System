-- ============================================================
-- AI 智能商品管理系统 - 建库建表脚本
-- 执行：mysql -uroot -p < sql/init.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `ai_product`
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;

USE `ai_product`;

-- ---------- 1. 系统用户 ----------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `username`   VARCHAR(50)  NOT NULL COMMENT '登录名',
    `password`   VARCHAR(128) NOT NULL COMMENT '密码(sha256)',
    `nickname`   VARCHAR(50)  DEFAULT '' COMMENT '昵称',
    `role`       VARCHAR(20)  DEFAULT 'admin' COMMENT '角色',
    `phone`      VARCHAR(20)  DEFAULT '',
    `email`      VARCHAR(100) DEFAULT '',
    `status`     TINYINT      DEFAULT 1 COMMENT '1正常 0禁用',
    `created_at` DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户';

-- ---------- 2. 商品分类 ----------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `name`        VARCHAR(50) NOT NULL COMMENT '分类名称',
    `parent_id`   INT         DEFAULT 0 COMMENT '父分类id，0为一级',
    `sort`        INT         DEFAULT 0 COMMENT '排序',
    `description` VARCHAR(255) DEFAULT '',
    `status`      TINYINT     DEFAULT 1 COMMENT '1启用 0停用',
    `created_at`  DATETIME    DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类';

-- ---------- 3. 商品 ----------
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `name`        VARCHAR(120) NOT NULL COMMENT '商品名称',
    `sku`         VARCHAR(50)  DEFAULT '' COMMENT '商品编码',
    `category_id` INT          DEFAULT 0 COMMENT '分类id',
    `brand`       VARCHAR(50)  DEFAULT '' COMMENT '品牌',
    `price`       DECIMAL(10,2) DEFAULT 0 COMMENT '售价',
    `cost`        DECIMAL(10,2) DEFAULT 0 COMMENT '成本价',
    `image`       VARCHAR(255) DEFAULT '' COMMENT '主图',
    `description` TEXT COMMENT '商品描述',
    `status`      TINYINT      DEFAULT 1 COMMENT '1上架 0下架',
    `sales`       INT          DEFAULT 0 COMMENT '累计销量',
    `created_at`  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_category` (`category_id`),
    KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品';

-- ---------- 4. 库存（与商品 1:1） ----------
DROP TABLE IF EXISTS `inventory`;
CREATE TABLE `inventory` (
    `id`            INT AUTO_INCREMENT PRIMARY KEY,
    `product_id`    INT NOT NULL COMMENT '商品id',
    `current_stock` INT DEFAULT 0 COMMENT '当前库存',
    `safe_stock`    INT DEFAULT 20 COMMENT '安全库存(预警线)',
    `max_stock`     INT DEFAULT 1000 COMMENT '库存上限',
    `warehouse`     VARCHAR(50) DEFAULT '主仓库',
    `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存';

-- ---------- 5. 客户 ----------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
    `id`              INT AUTO_INCREMENT PRIMARY KEY,
    `name`            VARCHAR(50) NOT NULL COMMENT '客户姓名',
    `phone`           VARCHAR(20) DEFAULT '',
    `email`           VARCHAR(100) DEFAULT '',
    `level`           VARCHAR(20) DEFAULT 'normal' COMMENT '客户等级',
    `total_orders`    INT DEFAULT 0 COMMENT '消费次数',
    `total_amount`    DECIMAL(12,2) DEFAULT 0 COMMENT '累计消费',
    `last_order_time` DATETIME NULL COMMENT '最近购买时间',
    `status`          TINYINT DEFAULT 1 COMMENT '1正常 0流失',
    `created_at`      DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户';

-- ---------- 6. 订单 ----------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
    `id`            INT AUTO_INCREMENT PRIMARY KEY,
    `order_no`      VARCHAR(32) NOT NULL COMMENT '订单号',
    `customer_id`   INT DEFAULT 0 COMMENT '客户id',
    `customer_name` VARCHAR(50) DEFAULT '' COMMENT '下单人',
    `total_amount`  DECIMAL(12,2) DEFAULT 0 COMMENT '订单总额',
    `status`        VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/paid/to_ship/shipped/completed/cancelled',
    `remark`        TEXT,
    `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_order_no` (`order_no`),
    KEY `idx_status` (`status`),
    KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单';

-- ---------- 7. 订单明细 ----------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `order_id`     INT NOT NULL COMMENT '订单id',
    `product_id`   INT NOT NULL COMMENT '商品id',
    `product_name` VARCHAR(120) DEFAULT '' COMMENT '商品名称快照',
    `price`        DECIMAL(10,2) DEFAULT 0 COMMENT '成交单价',
    `quantity`     INT DEFAULT 1 COMMENT '数量',
    `subtotal`     DECIMAL(12,2) DEFAULT 0 COMMENT '小计',
    KEY `idx_order` (`order_id`),
    KEY `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细';

-- ---------- 8. AI 会话历史 ----------
DROP TABLE IF EXISTS `chat_history`;
CREATE TABLE `chat_history` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `session_id` VARCHAR(64) DEFAULT 'default',
    `user_id`    INT DEFAULT 0,
    `question`   TEXT COMMENT '用户问题',
    `answer`     TEXT COMMENT 'AI回答',
    `source`     VARCHAR(20) DEFAULT 'chat' COMMENT 'chat/rag/agent',
    `refs`       TEXT COMMENT '引用文档',
    `elapsed_ms` INT DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI会话历史';

-- ---------- 9. 知识库文档 ----------
DROP TABLE IF EXISTS `knowledge_documents`;
CREATE TABLE `knowledge_documents` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `doc_name`     VARCHAR(150) NOT NULL COMMENT '文档名称',
    `category`     VARCHAR(30) DEFAULT 'products',
    `file_path`    VARCHAR(255) DEFAULT '',
    `chunk_count`  INT DEFAULT 0,
    `vector_count` INT DEFAULT 0,
    `status`       VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/indexed/failed',
    `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库文档';

-- ---------- 10. Agent 调用链日志 ----------
DROP TABLE IF EXISTS `agent_logs`;
CREATE TABLE `agent_logs` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `session_id`  VARCHAR(64) DEFAULT 'default',
    `question`    TEXT COMMENT '用户问题',
    `agent`       VARCHAR(50) DEFAULT 'ProductAgent',
    `tool_name`   VARCHAR(80) DEFAULT '' COMMENT '调用的工具',
    `tool_params` TEXT COMMENT '工具入参',
    `tool_result` TEXT COMMENT '工具结果',
    `answer`      TEXT COMMENT '最终回答',
    `status`      VARCHAR(20) DEFAULT 'success',
    `elapsed_ms`  INT DEFAULT 0,
    `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent调用链日志';

-- ---------- 11. 系统日志 ----------
DROP TABLE IF EXISTS `system_logs`;
CREATE TABLE `system_logs` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `level`      VARCHAR(10) DEFAULT 'INFO',
    `module`     VARCHAR(50) DEFAULT 'system',
    `message`    TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_level` (`level`),
    KEY `idx_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统日志';
