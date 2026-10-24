/* ============================================================
 * common.js —— 布局注入 / 菜单高亮 / toast / 弹窗 / 格式化 / AI悬浮窗
 * 所有页面在页尾引入本文件，页面加载后自动注入公共组件。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ==================== 一、格式化工具 ==================== */

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(n) {
    var num = Number(n);
    if (n === null || n === undefined || n === '' || isNaN(num)) return '0';
    return num.toLocaleString('zh-CN');
  }

  /** 金额：保留 2 位、千分位、带 ¥ */
  function formatMoney(n) {
    var num = Number(n);
    if (n === null || n === undefined || n === '' || isNaN(num)) return '¥0.00';
    return '¥' + num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** 日期：去掉 T，截断到秒 */
  function formatDate(s) {
    if (!s) return '-';
    return String(s).replace('T', ' ').slice(0, 19);
  }

  function getQuery(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait || 300);
    };
  }

  /** 简易 Markdown 渲染：转义 -> **加粗** -> `代码` -> 换行 */
  function renderMarkdown(text) {
    var html = escapeHtml(text || '');
    html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function tag(text, type) {
    return '<span class="tag tag-' + (type || 'gray') + '">' + escapeHtml(text) + '</span>';
  }

  /* ==================== 二、Toast ==================== */

  function ensureToastContainer() {
    var box = document.getElementById('toast-container');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-container';
      document.body.appendChild(box);
    }
    return box;
  }

  function toast(msg, type) {
    type = type || 'info';
    var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    var box = ensureToastContainer();
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ️') + '</span><span>' +
      escapeHtml(msg) + '</span>';
    box.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3000);
  }

  /* ==================== 三、通用弹窗 ==================== */

  var MODAL_HTML =
    '<div class="modal-mask" id="modalMask">' +
    '  <div class="modal-box" id="modalBox">' +
    '    <div class="modal-header">' +
    '      <h3 id="modalTitle">提示</h3>' +
    '      <button class="modal-close" id="modalClose" type="button">&times;</button>' +
    '    </div>' +
    '    <div class="modal-body" id="modalBody"></div>' +
    '    <div class="modal-footer">' +
    '      <button class="btn btn-default" id="modalCancel" type="button">取消</button>' +
    '      <button class="btn btn-primary" id="modalConfirm" type="button">确定</button>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var modalState = { onConfirm: null, onCancel: null };

  function ensureModalDom() {
    if (document.getElementById('modalMask')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = MODAL_HTML;
    document.body.appendChild(wrap.firstElementChild);
    bindModalEvents();
  }

  function bindModalEvents() {
    var mask = document.getElementById('modalMask');
    if (!mask || mask.__bound) return;
    mask.__bound = true;

    document.getElementById('modalClose').addEventListener('click', function () { closeModal(); });
    document.getElementById('modalCancel').addEventListener('click', function () { closeModal(); });
    document.getElementById('modalConfirm').addEventListener('click', onModalConfirm);
    mask.addEventListener('click', function (e) {
      if (e.target === mask) closeModal();
    });
  }

  async function onModalConfirm() {
    var btn = document.getElementById('modalConfirm');
    var cb = modalState.onConfirm;
    if (!cb) { closeModal(); return; }
    btn.disabled = true;
    var result;
    try {
      result = await cb();
    } catch (e) {
      btn.disabled = false;
      return; // 保持弹窗打开，错误已由调用方 toast
    }
    btn.disabled = false;
    if (result === false) return; // 显式返回 false 时不关闭
    closeModal();
  }

  /**
   * 打开弹窗
   * @param {string} title 标题
   * @param {string} bodyHtml 内容 HTML
   * @param {Function} onConfirm 点击确定回调（可返回 false 阻止关闭 / 返回 Promise）
   * @param {object} options { confirmText, width, hideCancel, onCancel }
   */
  function openModal(title, bodyHtml, onConfirm, options) {
    options = options || {};
    ensureModalDom();
    bindModalEvents();
    modalState.onConfirm = onConfirm || null;
    modalState.onCancel = options.onCancel || null;

    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalBody').innerHTML = bodyHtml || '';
    var confirmBtn = document.getElementById('modalConfirm');
    confirmBtn.textContent = options.confirmText || '确定';
    confirmBtn.disabled = false;
    document.getElementById('modalCancel').style.display = options.hideCancel ? 'none' : '';
    document.getElementById('modalBox').style.maxWidth = options.width || '520px';
    document.getElementById('modalMask').classList.add('show');
  }

  function closeModal() {
    var mask = document.getElementById('modalMask');
    if (!mask) return;
    var onCancel = modalState.onCancel;
    mask.classList.remove('show');
    modalState.onConfirm = null;
    modalState.onCancel = null;
    if (typeof onCancel === 'function') {
      try { onCancel(); } catch (e) { /* ignore */ }
    }
  }

  /** 确认框，返回 Promise<boolean> */
  function confirmDialog(msg, title) {
    return new Promise(function (resolve) {
      var decided = false;
      openModal(title || '操作确认',
        '<div class="confirm-text">' + escapeHtml(msg) + '</div>',
        function () { decided = true; resolve(true); return true; },
        {
          confirmText: '确定',
          onCancel: function () { if (!decided) { decided = true; resolve(false); } }
        });
    });
  }

  /* ==================== 四、聊天消息渲染 ==================== */

  function appendChatMsg(container, role, html) {
    if (!container) return null;
    var el = document.createElement('div');
    el.className = 'ai-msg ai-msg-' + (role === 'user' ? 'user' : 'bot');
    var avatar = role === 'user' ? '🧑' : '🤖';
    el.innerHTML = '<div class="ai-avatar">' + avatar + '</div><div class="ai-bubble">' + html + '</div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  function appendChatLoading(container, text) {
    if (!container) return null;
    var el = document.createElement('div');
    el.className = 'ai-msg ai-msg-bot';
    el.innerHTML = '<div class="ai-avatar">🤖</div>' +
      '<div class="ai-bubble"><span class="ai-typing"><span></span><span></span><span></span>' +
      escapeHtml(text || '思考中') + '</span></div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  /* ==================== 五、分页渲染 ==================== */

  function pageNumbers(page, pages) {
    var arr = [];
    if (pages <= 7) {
      for (var i = 1; i <= pages; i++) arr.push(i);
      return arr;
    }
    arr.push(1);
    var start = Math.max(2, page - 1);
    var end = Math.min(pages - 1, page + 1);
    if (start > 2) arr.push('...');
    for (var j = start; j <= end; j++) arr.push(j);
    if (end < pages - 1) arr.push('...');
    arr.push(pages);
    return arr;
  }

  /**
   * 渲染分页
   * @param {string|Element} el 容器
   * @param {object} data { page, pages, total }
   * @param {Function} onChange 切换页码回调
   */
  function renderPagination(el, data, onChange) {
    var node = typeof el === 'string' ? document.querySelector(el) : el;
    if (!node) return;
    data = data || {};
    var page = Number(data.page || 1);
    var pages = Number(data.pages || 0);
    var total = Number(data.total || 0);

    if (pages <= 1) {
      node.innerHTML = '<span class="page-info">共 ' + total + ' 条</span>';
      return;
    }

    var html = '<span class="page-info">共 ' + total + ' 条 / ' + pages + ' 页</span>';
    html += '<button class="page-btn" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>上一页</button>';
    pageNumbers(page, pages).forEach(function (p) {
      if (p === '...') html += '<span class="page-ellipsis">…</span>';
      else html += '<button class="page-btn' + (p === page ? ' active' : '') + '" data-page="' + p + '">' + p + '</button>';
    });
    html += '<button class="page-btn" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>下一页</button>';
    node.innerHTML = html;

    node.querySelectorAll('.page-btn[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = Number(btn.getAttribute('data-page'));
        if (p >= 1 && p <= pages && p !== page) onChange(p);
      });
    });
  }

  function tableLoadingHTML(colspan) {
    return '<tr><td colspan="' + (colspan || 6) + '"><div class="loading"><span class="spinner"></span>加载中...</div></td></tr>';
  }

  function tableEmptyHTML(colspan, text) {
    return '<tr><td colspan="' + (colspan || 6) + '"><div class="empty">' +
      '<div class="empty-icon">📭</div><div class="empty-text">' + escapeHtml(text || '暂无数据') + '</div></div></td></tr>';
  }

  /* ==================== 六、业务枚举 ==================== */

  var ORDER_STATUS = {
    pending: '待付款', paid: '已付款', to_ship: '待发货',
    shipped: '已发货', completed: '已完成', cancelled: '已取消'
  };
  var ORDER_STATUS_FLOW = {
    pending: ['paid', 'cancelled'],
    paid: ['to_ship', 'cancelled'],
    to_ship: ['shipped', 'cancelled'],
    shipped: ['completed'],
    completed: [],
    cancelled: []
  };
  var ORDER_STATUS_TAG = {
    pending: 'warning', paid: 'info', to_ship: 'primary',
    shipped: 'info', completed: 'success', cancelled: 'gray'
  };
  var INVENTORY_STATUS = {
    normal: { text: '正常', tag: 'success' },
    warning: { text: '预警', tag: 'warning' },
    out_of_stock: { text: '缺货', tag: 'danger' },
    overstock: { text: '积压', tag: 'info' }
  };
  var CUSTOMER_LEVEL = { normal: '普通客户', vip: 'VIP客户', svip: 'SVIP客户' };
  var CUSTOMER_LEVEL_TAG = { normal: 'gray', vip: 'primary', svip: 'warning' };

  /** 按名称生成头像色块（首字） */
  function avatarColor(name) {
    var colors = ['#2f6bff', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];
    var str = String(name || '?');
    var sum = 0;
    for (var i = 0; i < str.length; i++) sum += str.charCodeAt(i);
    return colors[sum % colors.length];
  }

  function avatarBlock(name) {
    var ch = String(name || '?').trim().charAt(0) || '?';
    return '<div class="avatar-block" style="background:' + avatarColor(name) + '">' + escapeHtml(ch) + '</div>';
  }

  /* ==================== 七、组件注入 ==================== */

  var SIDEBAR_HTML =
    '<aside class="sidebar">' +
    '  <div class="sidebar-logo"><span class="logo-icon">🛍️</span><span class="logo-text">AI商品管理系统</span></div>' +
    '  <nav class="sidebar-nav">' +
    '    <a class="nav-item" data-page="dashboard.html" href="dashboard.html"><span class="nav-icon">📊</span><span>工作台</span></a>' +
    '    <div class="nav-group" data-group="product">' +
    '      <div class="nav-group-title"><span class="nav-icon">📦</span><span>商品</span><span class="nav-arrow">▸</span></div>' +
    '      <div class="nav-group-items">' +
    '        <a class="nav-item" data-page="product.html" href="product.html">商品管理</a>' +
    '        <a class="nav-item" data-page="category.html" href="category.html">商品分类</a>' +
    '        <a class="nav-item" data-page="inventory.html" href="inventory.html">库存管理</a>' +
    '      </div>' +
    '    </div>' +
    '    <div class="nav-group" data-group="trade">' +
    '      <div class="nav-group-title"><span class="nav-icon">🧾</span><span>交易</span><span class="nav-arrow">▸</span></div>' +
    '      <div class="nav-group-items">' +
    '        <a class="nav-item" data-page="order.html" href="order.html">订单管理</a>' +
    '        <a class="nav-item" data-page="customer.html" href="customer.html">客户管理</a>' +
    '      </div>' +
    '    </div>' +
    '    <div class="nav-group" data-group="data">' +
    '      <div class="nav-group-title"><span class="nav-icon">📈</span><span>数据</span><span class="nav-arrow">▸</span></div>' +
    '      <div class="nav-group-items">' +
    '        <a class="nav-item" data-page="analytics.html" href="analytics.html">数据分析</a>' +
    '      </div>' +
    '    </div>' +
    '    <div class="nav-group" data-group="ai">' +
    '      <div class="nav-group-title"><span class="nav-icon">🤖</span><span>AI</span><span class="nav-arrow">▸</span></div>' +
    '      <div class="nav-group-items">' +
    '        <a class="nav-item" data-page="ai.html" href="ai.html">AI助手</a>' +
    '        <a class="nav-item" data-page="rag.html" href="rag.html">知识库</a>' +
    '        <a class="nav-item" data-page="agent.html" href="agent.html">商品Agent</a>' +
    '        <a class="nav-item" data-page="mcp.html" href="mcp.html">MCP工具</a>' +
    '        <a class="nav-item" data-page="trace.html" href="trace.html">调用链</a>' +
    '      </div>' +
    '    </div>' +
    '    <div class="nav-group" data-group="system">' +
    '      <div class="nav-group-title"><span class="nav-icon">⚙️</span><span>系统</span><span class="nav-arrow">▸</span></div>' +
    '      <div class="nav-group-items">' +
    '        <a class="nav-item" data-page="logs.html" href="logs.html">系统日志</a>' +
    '        <a class="nav-item" data-page="settings.html" href="settings.html">系统设置</a>' +
    '      </div>' +
    '    </div>' +
    '  </nav>' +
    '</aside>';

  var HEADER_HTML =
    '<header class="header">' +
    '  <button class="hamburger" id="sidebarToggle" type="button" title="收起/展开菜单">☰</button>' +
    '  <div class="header-brand">🤖 AI智能商品管理系统</div>' +
    '  <div class="header-search">' +
    '    <span class="search-icon">🔍</span>' +
    '    <input type="text" id="globalSearch" placeholder="搜索商品名称 / SKU，回车查询">' +
    '  </div>' +
    '  <div class="header-right">' +
    '    <button class="header-icon-btn" id="headerAiBtn" type="button" title="打开 AI 助手">🤖</button>' +
    '    <a class="header-icon-btn" href="settings.html" title="系统设置">⚙️</a>' +
    '    <div class="header-user"><div class="user-avatar">管</div><span class="user-name">管理员</span></div>' +
    '  </div>' +
    '</header>';

  var AI_FLOAT_HTML =
    '<div class="ai-float" id="aiFloat">' +
    '  <div class="ai-float-panel" id="aiFloatPanel">' +
    '    <div class="ai-float-header">' +
    '      <span class="ai-float-title">🤖 AI 助手</span>' +
    '      <div class="ai-mode-switch">' +
    '        <button class="ai-mode active" data-mode="chat" type="button">普通问答</button>' +
    '        <button class="ai-mode" data-mode="agent" type="button">Agent</button>' +
    '      </div>' +
    '      <button class="ai-float-close" id="aiFloatClose" type="button">&times;</button>' +
    '    </div>' +
    '    <div class="ai-float-body" id="aiFloatBody">' +
    '      <div class="ai-msg ai-msg-bot"><div class="ai-avatar">🤖</div>' +
    '        <div class="ai-bubble">你好！我是 AI 商品管理助手，可以问我商品、库存、订单、售后等问题。</div></div>' +
    '    </div>' +
    '    <div class="ai-float-footer">' +
    '      <textarea id="aiFloatInput" rows="1" placeholder="输入问题，回车发送..."></textarea>' +
    '      <button class="btn btn-primary btn-sm" id="aiFloatSend" type="button">发送</button>' +
    '    </div>' +
    '  </div>' +
    '  <button class="ai-float-btn" id="aiFloatBtn" type="button" title="AI 助手">🤖</button>' +
    '</div>';

  async function fetchComponent(path, fallback) {
    try {
      var res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var text = await res.text();
      if (!text || !text.trim()) throw new Error('empty');
      return text;
    } catch (e) {
      return fallback; // 组件拉取失败时用内置 HTML 兜底
    }
  }

  async function loadComponents() {
    var base = '../components/';
    var results = await Promise.all([
      fetchComponent(base + 'sidebar.html', SIDEBAR_HTML),
      fetchComponent(base + 'header.html', HEADER_HTML),
      fetchComponent(base + 'ai-float.html', AI_FLOAT_HTML),
      fetchComponent(base + 'modal.html', MODAL_HTML)
    ]);

    var layout = document.getElementById('app-layout');
    var shell = results[0] + results[1];
    if (layout) layout.innerHTML = shell;
    else document.body.insertAdjacentHTML('afterbegin', shell);

    document.body.insertAdjacentHTML('beforeend', results[2]); // AI 悬浮窗
    document.body.insertAdjacentHTML('beforeend', results[3]); // 弹窗模板

    initSidebar();
    initHeader();
    initAiFloat();
  }

  function initSidebar() {
    var current = (location.pathname.split('/').pop() || '').toLowerCase();
    if (!current) current = 'dashboard.html';

    var activeGroup = null;
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
      var page = (item.getAttribute('data-page') || '').toLowerCase();
      if (page === current) {
        item.classList.add('active');
        activeGroup = item.closest('.nav-group');
      }
    });
    if (activeGroup) {
      activeGroup.classList.add('open');
      activeGroup.classList.add('has-active');
    }

    document.querySelectorAll('.sidebar-nav .nav-group-title').forEach(function (title) {
      title.addEventListener('click', function () {
        title.parentElement.classList.toggle('open');
      });
    });
  }

  function initHeader() {
    var toggle = document.getElementById('sidebarToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        if (window.innerWidth <= 900) document.body.classList.toggle('sidebar-open');
        else document.body.classList.toggle('sidebar-collapsed');
      });
    }
    var search = document.getElementById('globalSearch');
    if (search) {
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var kw = search.value.trim();
          location.href = 'product.html' + (kw ? '?keyword=' + encodeURIComponent(kw) : '');
        }
      });
    }
    var aiBtn = document.getElementById('headerAiBtn');
    if (aiBtn) {
      aiBtn.addEventListener('click', function () {
        var panel = document.getElementById('aiFloatPanel');
        if (panel) panel.classList.toggle('show');
      });
    }
  }

  function initAiFloat() {
    var panel = document.getElementById('aiFloatPanel');
    var btn = document.getElementById('aiFloatBtn');
    if (!panel || !btn) return;

    var mode = 'chat';
    var body = document.getElementById('aiFloatBody');
    var input = document.getElementById('aiFloatInput');

    btn.addEventListener('click', function () { panel.classList.toggle('show'); });
    document.getElementById('aiFloatClose').addEventListener('click', function () {
      panel.classList.remove('show');
    });

    document.querySelectorAll('.ai-float .ai-mode').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.getAttribute('data-mode');
        document.querySelectorAll('.ai-float .ai-mode').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });

    async function send() {
      var q = input.value.trim();
      if (!q) return;
      input.value = '';
      appendChatMsg(body, 'user', escapeHtml(q));
      var loading = appendChatLoading(body, mode === 'agent' ? 'Agent 执行中' : '思考中');
      try {
        var data = mode === 'agent'
          ? await API.agent.chat({ question: q, session_id: 'float' })
          : await API.ai.chat({ question: q, session_id: 'float' });
        if (loading) loading.remove();
        var html = renderMarkdown(data.answer || '（无回答）');
        if (data.refs && data.refs.length) {
          html += '<div class="ai-refs">引用：' + data.refs.map(function (r) {
            return '<span class="ref-chip">' + escapeHtml(r) + '</span>';
          }).join('') + '</div>';
        }
        html += '<div class="ai-meta">耗时 ' + (data.elapsed_ms || 0) + ' ms</div>';
        appendChatMsg(body, 'bot', html);
      } catch (err) {
        if (loading) loading.remove();
        appendChatMsg(body, 'bot', '<span class="text-danger">' + escapeHtml(err.message) + '</span>');
      }
    }

    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      });
    }
    document.getElementById('aiFloatSend').addEventListener('click', send);
  }

  /* ==================== 八、对外暴露 ==================== */

  global.escapeHtml = escapeHtml;
  global.formatNumber = formatNumber;
  global.formatMoney = formatMoney;
  global.formatDate = formatDate;
  global.getQuery = getQuery;
  global.debounce = debounce;
  global.renderMarkdown = renderMarkdown;
  global.tag = tag;
  global.toast = toast;
  global.openModal = openModal;
  global.closeModal = closeModal;
  global.confirmDialog = confirmDialog;
  global.appendChatMsg = appendChatMsg;
  global.appendChatLoading = appendChatLoading;
  global.renderPagination = renderPagination;
  global.tableLoadingHTML = tableLoadingHTML;
  global.tableEmptyHTML = tableEmptyHTML;
  global.avatarBlock = avatarBlock;
  global.avatarColor = avatarColor;
  global.loadComponents = loadComponents;

  global.APP_ENUMS = {
    ORDER_STATUS: ORDER_STATUS,
    ORDER_STATUS_FLOW: ORDER_STATUS_FLOW,
    ORDER_STATUS_TAG: ORDER_STATUS_TAG,
    INVENTORY_STATUS: INVENTORY_STATUS,
    CUSTOMER_LEVEL: CUSTOMER_LEVEL,
    CUSTOMER_LEVEL_TAG: CUSTOMER_LEVEL_TAG
  };

  /* 页面加载后自动注入共享组件 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { global.__componentsReady = loadComponents(); });
  } else {
    global.__componentsReady = loadComponents();
  }
})(window);
