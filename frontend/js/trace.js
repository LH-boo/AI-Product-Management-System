/* ============================================================
 * trace.js —— Agent 调用链：列表 + 展开时间线
 * 对应接口：GET /api/ai/trace?limit=20
 * 记录结构：{id, session_id, question, agent, tool_name,
 *           tool_params(JSON字符串), tool_result(JSON字符串),
 *           answer, status, elapsed_ms, created_at}
 * ============================================================ */
(function () {
  'use strict';

  var traceListEl = document.getElementById('traceList');

  function safeParse(text, fallback) {
    if (!text) return fallback;
    try {
      return JSON.parse(text);
    } catch (e) {
      return fallback;
    }
  }

  function statusTag(status) {
    return status === 'failed' ? tag('失败', 'danger') : tag('成功', 'success');
  }

  /** 组装单条记录的详情时间线 */
  function detailHtml(log) {
    var params = safeParse(log.tool_params, []);
    var results = safeParse(log.tool_result, []);
    if (!Array.isArray(params)) params = [];
    if (!Array.isArray(results)) results = [];

    var toolNames = String(log.tool_name || '').split(',').filter(Boolean);
    var count = Math.max(params.length, results.length, toolNames.length);

    var html = '<div class="timeline">';
    html += '<div class="timeline-item">' +
      '<div class="tl-title">👤 用户问题</div>' +
      '<div class="pre-wrap">' + escapeHtml(log.question || '-') + '</div>' +
      '</div>';

    html += '<div class="timeline-item">' +
      '<div class="tl-title">🤖 Agent<span class="tl-badge">' +
      escapeHtml(log.agent || 'ProductAgent') + ' · 会话 ' + escapeHtml(log.session_id || 'default') +
      '</span></div>' +
      '<div class="pre-wrap text-muted">负责理解问题、选择工具并汇总结果</div>' +
      '</div>';

    for (var i = 0; i < count; i++) {
      var paramItem = params[i] || {};
      var name = paramItem.tool || toolNames[i] || '-';
      var args = (paramItem.arguments !== undefined) ? paramItem.arguments : {};
      var result = results[i];
      html += '<div class="timeline-item tool">' +
        '<div class="tl-title">🔧 工具调用：' + escapeHtml(name) + '</div>' +
        '<div class="tc-label">工具入参</div>' +
        '<pre class="code-block">' + escapeHtml(JSON.stringify(args, null, 2)) + '</pre>' +
        '<div class="tc-label">工具结果</div>' +
        '<pre class="code-block">' + escapeHtml(JSON.stringify(result, null, 2)) + '</pre>' +
        '</div>';
    }

    html += '<div class="timeline-item answer">' +
      '<div class="tl-title">✅ 最终回答<span class="tl-badge">耗时 ' + (log.elapsed_ms || 0) + ' ms</span></div>' +
      '<div class="pre-wrap">' + escapeHtml(log.answer || '（无回答）') + '</div>' +
      '</div>';

    html += '</div>';
    return html;
  }

  function render(list) {
    if (!list || !list.length) {
      traceListEl.innerHTML = '<div class="empty"><div class="empty-icon">🔗</div>' +
        '<div class="empty-text">暂无调用记录，去「商品Agent」页面提问后即可生成调用链</div></div>';
      return;
    }
    traceListEl.innerHTML = list.map(function (log, index) {
      var tools = String(log.tool_name || '').split(',').filter(Boolean).join(', ') || '-';
      return '<div class="trace-item" data-index="' + index + '">' +
        '<div class="trace-head">' +
        '<div class="t-time">' + escapeHtml(formatDate(log.created_at)) + '</div>' +
        '<div class="t-question" title="' + escapeHtml(log.question || '') + '">' +
        escapeHtml(log.question || '-') + '</div>' +
        '<div class="t-agent">' + escapeHtml(log.agent || '-') + '</div>' +
        '<div class="t-tool">' + escapeHtml(tools) + '</div>' +
        '<div class="t-duration">' + (log.elapsed_ms || 0) + ' ms</div>' +
        '<div>' + statusTag(log.status) + '</div>' +
        '</div>' +
        '<div class="trace-detail">' + detailHtml(log) + '</div>' +
        '</div>';
    }).join('');

    traceListEl.querySelectorAll('.trace-item').forEach(function (item) {
      var head = item.querySelector('.trace-head');
      head.addEventListener('click', function () {
        item.classList.toggle('open');
      });
    });
  }

  async function load() {
    traceListEl.innerHTML = '<div class="loading"><span class="spinner"></span>加载中...</div>';
    try {
      var list = await API.ai.trace(Number(document.getElementById('limitSel').value || 20));
      render(list);
    } catch (e) {
      traceListEl.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>' +
        '<div class="empty-text text-danger">' + escapeHtml(e.message) + '</div></div>';
      toast(e.message, 'error');
    }
  }

  function init() {
    document.getElementById('refreshBtn').addEventListener('click', load);
    document.getElementById('limitSel').addEventListener('change', load);
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
