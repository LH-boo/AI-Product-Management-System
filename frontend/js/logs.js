/* ============================================================
 * logs.js —— 系统日志
 *
 * 数据来源：
 *   1. 系统运行日志 —— 真实接口 GET /api/logs（system_logs 表）
 *   2. Agent 调用日志 —— 真实接口 GET /api/ai/trace（agent_logs 表）
 * ============================================================ */
(function () {
  'use strict';

  var logListEl = document.getElementById('logList');
  var LEVEL_TAG = { INFO: 'info', WARNING: 'warning', ERROR: 'danger' };

  var allLogs = [];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /* -------- 系统运行日志：来自真实接口 /api/logs -------- */
  function systemLogs(list) {
    return (list || []).map(function (log) {
      var ts = Date.parse(String(log.created_at || '').replace(' ', 'T')) || 0;
      return {
        level: log.level || 'INFO',
        module: log.module || 'system',
        ts: ts,
        timeText: log.created_at || '-',
        msg: log.message || ''
      };
    });
  }

  /* -------- Agent 调用日志：来自真实接口 /api/ai/trace -------- */
  function traceLogs(list) {
    return (list || []).map(function (log) {
      var failed = log.status === 'failed';
      var ts = Date.parse(String(log.created_at || '').replace(' ', 'T')) || 0;
      return {
        level: failed ? 'ERROR' : 'INFO',
        module: 'Agent',
        ts: ts,
        timeText: log.created_at || '-',
        msg: '问题「' + (log.question || '') + '」→ 工具 [' + (log.tool_name || '-') +
          ']，耗时 ' + (log.elapsed_ms || 0) + ' ms，状态 ' + (failed ? '失败' : '成功')
      };
    });
  }

  function render() {
    var level = document.getElementById('levelSel').value;
    var kw = document.getElementById('kwInput').value.trim().toLowerCase();

    var list = allLogs.filter(function (item) {
      if (level && item.level !== level) return false;
      if (kw) {
        var text = (item.module + ' ' + item.msg).toLowerCase();
        if (text.indexOf(kw) < 0) return false;
      }
      return true;
    });

    if (!list.length) {
      logListEl.innerHTML = '<div class="empty"><div class="empty-icon">📭</div>' +
        '<div class="empty-text">没有符合条件的日志</div></div>';
      return;
    }

    logListEl.innerHTML = list.map(function (item) {
      return '<div class="log-item">' +
        '<div>' + tag(item.level, LEVEL_TAG[item.level] || 'gray') + '</div>' +
        '<div class="fs-12 text-muted">' + escapeHtml(item.module) + '</div>' +
        '<div class="log-time">' + escapeHtml(item.timeText) + '</div>' +
        '<div class="log-msg">' + escapeHtml(item.msg) + '</div>' +
        '</div>';
    }).join('');
  }

  async function load() {
    logListEl.innerHTML = '<div class="loading"><span class="spinner"></span>加载中...</div>';
    var sysLogs = [];
    var agentLogs = [];
    try {
      sysLogs = systemLogs(await API.logs.list(200));
    } catch (e) {
      sysLogs = [{
        level: 'ERROR', module: 'app', ts: Date.now(), timeText: fmtDate(new Date()),
        msg: '获取系统日志失败：' + e.message
      }];
    }
    try {
      agentLogs = traceLogs(await API.ai.trace(50));
    } catch (e) {
      // Agent 日志拉取失败不影响系统日志展示
      agentLogs = [{
        level: 'WARNING', module: 'Agent', ts: Date.now(), timeText: fmtDate(new Date()),
        msg: '获取 Agent 调用日志失败：' + e.message
      }];
    }
    allLogs = sysLogs.concat(agentLogs).sort(function (a, b) { return b.ts - a.ts; });
    render();
  }

  function init() {
    document.getElementById('levelSel').addEventListener('change', render);
    document.getElementById('kwInput').addEventListener('input', debounce(render, 250));
    document.getElementById('refreshBtn').addEventListener('click', function () {
      load();
      toast('日志已刷新', 'success');
    });
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
