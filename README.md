# AI 智能商品管理系统

前后端分离 + 商品业务管理 + RAG 知识库 + 商品 Agent + MCP 工具 + AI 数据分析

一个「能跑起来、能答辩」的完整项目：既能做传统的商品/库存/订单/客户 CRUD 与数据可视化，
又能演示 **RAG 检索增强问答 → MCP 工具调用 → Agent 自主决策** 的完整 AI 链路。

---

## 一、技术栈

| 层次 | 技术 |
| --- | --- |
| 前端 | 原生 HTML + CSS + JavaScript（ES6，无框架无打包）+ ECharts |
| 后端 | FastAPI + Uvicorn |
| 数据库 | MySQL 8 + SQLAlchemy ORM |
| 大模型 | OpenAI 兼容接口（可换 DeepSeek / 通义千问 / 智谱 GLM / Kimi） |
| 向量库 | Chroma（持久化到 `chroma_db/`） |
| Agent | Function Calling + MCP（stdio 协议） |

---

## 二、项目结构

```
ai商品管理系统/
├── backend/                        # 后端
│   ├── main.py                     # FastAPI 主入口（挂载 API + 前端静态目录）
│   ├── config.py                   # 全局配置（读取 .env）
│   ├── database.py                 # MySQL 连接 / 会话 / 建表
│   ├── models/                     # 数据模型（11 张表）
│   ├── api/                        # 接口层：product / category / inventory / order
│   │                               #        / customer / analytics / ai / rag / agent / mcp
│   ├── services/                   # 业务逻辑层
│   ├── rag/                        # RAG 子系统
│   │   ├── document_loader.py      #   文档加载 + 中文分块
│   │   ├── embedding.py            #   文本向量化
│   │   ├── vector_store.py         #   Chroma 封装
│   │   └── rag_search.py           #   建索引 / 检索 / RAG 问答（核心）
│   ├── agent/                      # Agent 子系统
│   │   ├── agent_prompt.py         #   系统提示词
│   │   ├── agent_tools.py          #   工具 Schema + 工具调用
│   │   └── agentclient.py          #   商品 Agent Client（核心）
│   ├── mcp/                        # MCP 子系统
│   │   ├── agentserver.py          #   MCP Server（FastMCP）
│   │   └── tools/                  #   商品 / 库存 / 订单 / 统计 工具
│   ├── knowledge/                  # RAG 知识库原始资料
│   └── utils/                      # 统一响应 + LLM 客户端
│
├── frontend/                       # 前端（14 个页面）
│   ├── index.html                  # 入口，自动跳转工作台
│   ├── pages/                      # 各功能页面
│   ├── components/                 # 侧边栏 / 顶栏 / AI悬浮窗 / AI聊天窗 / 弹窗
│   ├── css/                        # common / layout / dashboard / product / ai
│   └── js/                         # api + 各页面脚本
│
├── sql/
│   ├── init.sql                    # 建库建表
│   └── data.sql                    # 测试数据
│
├── chroma_db/                      # Chroma 向量库（首次运行自动生成）
├── requirements.txt
├── .env
└── README.md
```

---

## 三、快速开始

### 1. 建库 + 导入测试数据

```bash
mysql -uroot -p < sql/init.sql
mysql -uroot -p ai_product < sql/data.sql
```

> 也可以只用 `init.sql` 建表，然后启动后端由 SQLAlchemy 自动建表；
> `data.sql` 里有 15 个商品、15 笔订单、6 个客户等测试数据，方便立刻看到图表效果。

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置 `.env`

至少要改这三处：

```ini
MYSQL_PASSWORD=你的MySQL密码

LLM_BASE_URL=https://api.deepseek.com/v1     # 或 OpenAI / 通义 / 智谱 / Kimi
LLM_API_KEY=sk-你的key
LLM_MODEL=deepseek-chat

EMBEDDING_BASE_URL=https://api.deepseek.com/v1   # 也可用别的服务商的 embedding
EMBEDDING_API_KEY=sk-你的key
EMBEDDING_MODEL=text-embedding-3-small
```

> **不填 Key 也能跑**：系统会自动降级——RAG 返回检索到的原文片段，
> Agent 改用关键词规则匹配工具查库，业务 CRUD 与图表完全不受影响。

### 4. 启动

```bash
cd backend
uvicorn main:app --reload --port 8000
```

浏览器打开：<http://127.0.0.1:8000/>（前端）
接口文档：<http://127.0.0.1:8000/docs>

### 5. 初始化知识库

首次使用进入「AI知识库」页面，点击 **重建索引**，系统会把 `backend/knowledge/`
下的文档切分、向量化并写入 Chroma。

---

## 四、页面与模块对应关系

| 页面 | 后端模块 | AI 能力 |
| --- | --- | --- |
| 工作台 dashboard | analytics | AI 经营分析 |
| 商品管理 product | product | AI 查询 |
| 商品分类 category | category | — |
| 库存管理 inventory | inventory | AI 库存分析 |
| 订单管理 order | order | AI 订单查询 |
| 客户管理 customer | customer | AI 客户分析 |
| 数据分析 analytics | analytics | AI 经营分析 |
| AI助手 ai | ai | RAG + Agent |
| AI知识库 rag | rag | RAG |
| 商品Agent agent | agent | Agent |
| MCP工具 mcp | mcp | MCP |
| Agent调用链 trace | agent + mcp | Trace |
| 系统日志 logs | — | — |
| 系统设置 settings | config | — |

---

## 五、接口清单

### 业务接口

```
GET    /api/products              商品列表（keyword/category_id/status/page/page_size）
GET    /api/products/{id}         商品详情
POST   /api/products              新增商品
PUT    /api/products/{id}         修改商品
DELETE /api/products/{id}         删除商品
PUT    /api/products/{id}/status  上下架

GET    /api/categories            分类（tree=true 返回树形）
POST   /api/categories            新增分类
PUT    /api/categories/{id}       修改分类
DELETE /api/categories/{id}       删除分类

GET    /api/inventory             库存列表
POST   /api/inventory/in          入库
POST   /api/inventory/out         出库
GET    /api/inventory/warning     库存预警

GET    /api/orders                订单列表
GET    /api/orders/{id}           订单详情
POST   /api/orders                创建订单
PUT    /api/orders/{id}           修改订单状态
POST   /api/orders/{id}/cancel    取消订单

GET    /api/customers             客户列表
GET    /api/customers/{id}        客户详情（含最近订单）
POST   /api/customers             新增客户
PUT    /api/customers/{id}        修改客户
DELETE /api/customers/{id}        删除客户

GET    /api/analytics/overview        核心指标
GET    /api/analytics/sales/trend     销售趋势
GET    /api/analytics/sales/category  分类销售占比
GET    /api/analytics/top-products    热销商品
GET    /api/analytics/inventory       库存分析
```

### AI 接口

```
POST   /api/ai/chat               AI 普通问答（RAG + LLM）
GET    /api/ai/trace              Agent 调用链
GET    /api/ai/history            会话历史

POST   /api/ai/rag/search         知识库检索
POST   /api/ai/rag/ask            知识库问答
GET    /api/ai/rag/overview       知识库概览
POST   /api/ai/rag/upload         上传文档并索引
POST   /api/ai/rag/reindex        重建索引

POST   /api/ai/agent/chat         商品 Agent 对话

GET    /api/ai/mcp/tools          MCP 工具列表
POST   /api/ai/mcp/call           调用 MCP 工具
```

所有接口统一返回：`{"code": 200, "message": "success", "data": ...}`

---

## 六、三条 AI 链路是怎么串起来的

### 1. RAG 链路

```
用户问题 → FastAPI → rag_search → 文本 Embedding → Chroma
        → 相似度检索 Top K → 拼接上下文 → LLM → 带引用的答案
```

### 2. Agent 链路

```
用户问题 → Agent Client → LLM 判断意图 → 选择工具
        → MCP Client/本地工具 → MySQL → 返回数据
        → LLM 分析 → 最终答案（全过程写入 agent_logs）
```

### 3. MCP 链路

```
agentserver.py（FastMCP 注册 9 个工具）
    ↕ stdio 协议
agent_tools.call_tool_via_mcp()  →  演示真实 MCP 调用
agent_tools.call_tool()          →  本地直调（性能优先，默认）
```

MCP Server 可单独启动验证：

```bash
cd backend
python -m mcp.agentserver
```

---

## 七、数据库表

| 表名 | 说明 |
| --- | --- |
| users | 系统用户 |
| categories | 商品分类（两级） |
| products | 商品 |
| inventory | 库存（与商品 1:1） |
| customers | 客户 |
| orders | 订单 |
| order_items | 订单明细 |
| chat_history | AI 会话历史 |
| knowledge_documents | 知识库文档 |
| agent_logs | Agent 调用链日志 |
| system_logs | 系统日志 |

关系：`categories 1:N products`、`products 1:1 inventory`、
`customers 1:N orders 1:N order_items N:1 products`

---

## 八、建议开发顺序（对应文档的 7 个阶段）

1. **第一阶段**：MySQL + 商品 CRUD + 分类 CRUD + 库存 CRUD
2. **第二阶段**：订单 + 客户 + 数据统计
3. **第三阶段**：AI Chat + ai_service + AI 悬浮窗口
4. **第四阶段**：RAG + Chroma + 商品知识库 + 知识库页面
5. **第五阶段**：MCP Server + 商品工具 + MCP 页面
6. **第六阶段**：Agent Client + 商品 Agent + Agent 调用链
7. **第七阶段**：AI 销售分析 + AI 库存分析 + AI 经营助手

---

## 九、常见问题

**Q：启动报 `No module named 'fastapi'`？**
A：依赖没装，执行 `pip install -r requirements.txt`。

**Q：连接 MySQL 报错？**
A：检查 `.env` 里的账号密码，以及数据库 `ai_product` 是否已创建（`sql/init.sql`）。

**Q：前端页面空白 / 图表不显示？**
A：确认后端已启动在 8000 端口；图表依赖 ECharts CDN，需要能访问外网。

**Q：AI 回答是「未配置 API Key」？**
A：在 `.env` 中填入真实的 `LLM_API_KEY` 与 `EMBEDDING_API_KEY` 后重启。

**Q：知识库检索不到内容？**
A：先在「AI知识库」页面点「重建索引」，并把资料放到 `backend/knowledge/` 对应目录下。

**Q：`backend/mcp` 和官方 `mcp` 包同名会不会冲突？**
A：代码内已处理（`agentserver.py` 的 `third_party_mcp_env()` 会临时屏蔽本地包再导入官方包），
保证 MCP Server 与本地工具注册都能正常工作。
