/* ============================================================
 * api.js —— 统一请求封装 + 全部后端接口
 * 前端与后端同源（后端把 frontend 目录挂载为静态目录），
 * 因此这里直接使用相对路径 /api/... 即可。
 * 统一响应体：{code:200, message:"success", data:...}
 * ============================================================ */
(function (global) {
  'use strict';

  var BASE = ''; // 与后端同源

  /** 把对象拼成查询字符串，自动忽略空值 */
  function buildQuery(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /** 核心请求方法：自动 JSON 序列化、统一错误处理 */
  async function request(path, options) {
    options = options || {};
    var opts = {
      method: options.method || 'GET',
      headers: Object.assign({}, options.headers)
    };
    if (options.body !== undefined && options.body !== null) {
      if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
        opts.body = options.body; // 文件上传交给浏览器自动设置 Content-Type
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(options.body);
      }
    }

    var res;
    try {
      res = await fetch(BASE + path, opts);
    } catch (e) {
      throw new Error('网络请求失败，请确认后端服务已在 8000 端口启动');
    }

    var json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('响应解析失败（HTTP ' + res.status + '）');
    }

    if (json.code !== 200) {
      var err = new Error(json.message || '请求失败');
      err.code = json.code;
      throw err;
    }
    return json.data;
  }

  var API = {
    request: request,
    buildQuery: buildQuery,

    /* 系统 */
    health: function () { return request('/api/health'); },

    /* 系统日志 */
    logs: {
      list: function (limit) { return request('/api/logs' + buildQuery({ limit: limit || 100 })); }
    },

    /* 数据分析 */
    analytics: {
      overview: function () { return request('/api/analytics/overview'); },
      trend: function (days) { return request('/api/analytics/sales/trend' + buildQuery({ days: days || 7 })); },
      category: function () { return request('/api/analytics/sales/category'); },
      topProducts: function (limit) { return request('/api/analytics/top-products' + buildQuery({ limit: limit || 5 })); },
      inventory: function () { return request('/api/analytics/inventory'); }
    },

    /* 商品 */
    products: {
      list: function (params) { return request('/api/products' + buildQuery(params)); },
      get: function (id) { return request('/api/products/' + id); },
      create: function (body) { return request('/api/products', { method: 'POST', body: body }); },
      update: function (id, body) { return request('/api/products/' + id, { method: 'PUT', body: body }); },
      remove: function (id) { return request('/api/products/' + id, { method: 'DELETE' }); },
      setStatus: function (id, status) {
        return request('/api/products/' + id + '/status', { method: 'PUT', body: { status: status } });
      }
    },

    /* 分类 */
    categories: {
      list: function (tree) {
        return request('/api/categories' + buildQuery({ tree: tree === undefined ? true : tree }));
      },
      create: function (body) { return request('/api/categories', { method: 'POST', body: body }); },
      update: function (id, body) { return request('/api/categories/' + id, { method: 'PUT', body: body }); },
      remove: function (id) { return request('/api/categories/' + id, { method: 'DELETE' }); }
    },

    /* 库存 */
    inventory: {
      list: function (params) { return request('/api/inventory' + buildQuery(params)); },
      warning: function () { return request('/api/inventory/warning'); },
      stockIn: function (body) { return request('/api/inventory/in', { method: 'POST', body: body }); },
      stockOut: function (body) { return request('/api/inventory/out', { method: 'POST', body: body }); }
    },

    /* 订单 */
    orders: {
      list: function (params) { return request('/api/orders' + buildQuery(params)); },
      get: function (id) { return request('/api/orders/' + id); },
      create: function (body) { return request('/api/orders', { method: 'POST', body: body }); },
      update: function (id, body) { return request('/api/orders/' + id, { method: 'PUT', body: body }); },
      cancel: function (id) { return request('/api/orders/' + id + '/cancel', { method: 'POST' }); }
    },

    /* 客户 */
    customers: {
      list: function (params) { return request('/api/customers' + buildQuery(params)); },
      get: function (id) { return request('/api/customers/' + id); },
      create: function (body) { return request('/api/customers', { method: 'POST', body: body }); },
      update: function (id, body) { return request('/api/customers/' + id, { method: 'PUT', body: body }); },
      remove: function (id) { return request('/api/customers/' + id, { method: 'DELETE' }); }
    },

    /* AI 助手 */
    ai: {
      chat: function (body) { return request('/api/ai/chat', { method: 'POST', body: body }); },
      trace: function (limit) { return request('/api/ai/trace' + buildQuery({ limit: limit || 20 })); },
      history: function (sessionId, limit) {
        return request('/api/ai/history' + buildQuery({ session_id: sessionId || 'default', limit: limit || 20 }));
      }
    },

    /* RAG 知识库 */
    rag: {
      search: function (body) { return request('/api/ai/rag/search', { method: 'POST', body: body }); },
      overview: function () { return request('/api/ai/rag/overview'); },
      upload: function (formData) { return request('/api/ai/rag/upload', { method: 'POST', body: formData }); },
      reindex: function () { return request('/api/ai/rag/reindex', { method: 'POST' }); },
      ask: function (body) { return request('/api/ai/rag/ask', { method: 'POST', body: body }); }
    },

    /* 商品 Agent */
    agent: {
      chat: function (body) { return request('/api/ai/agent/chat', { method: 'POST', body: body }); }
    },

    /* MCP 工具中心 */
    mcp: {
      tools: function () { return request('/api/ai/mcp/tools'); },
      call: function (body) { return request('/api/ai/mcp/call', { method: 'POST', body: body }); }
    }
  };

  global.API = API;
})(window);
