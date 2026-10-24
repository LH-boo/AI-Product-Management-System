/* ============================================================
 * mcp.js —— MCP 工具中心：工具清单 + 动态参数表单 + 调用调试
 * 对应接口：GET /api/ai/mcp/tools、POST /api/ai/mcp/call
 * 工具结构：[{name, description, parameters(JSON Schema)}]
 * ============================================================ */
(function () {
  'use strict';

  var toolListEl = document.getElementById('toolList');
  var detailTitle = document.getElementById('detailTitle');
  var detailName = document.getElementById('detailName');
  var detailBody = document.getElementById('detailBody');

  var tools = [];
  var selectedIndex = -1;

  function prettyJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  /* ---------------- 工具清单 ---------------- */
  async function loadTools() {
    toolListEl.innerHTML = '<div class="loading"><span class="spinner"></span>加载中...</div>';
    try {
      var data = await API.mcp.tools();
      tools = data || [];
      document.getElementById('toolCount').textContent = '共 ' + tools.length + ' 个工具';
      if (!tools.length) {
        toolListEl.innerHTML = '<div class="empty"><div class="empty-icon">🧰</div>' +
          '<div class="empty-text">暂无可用工具</div></div>';
        return;
      }
      toolListEl.innerHTML = tools.map(function (t, index) {
        return '<div class="tool-item" data-index="' + index + '">' +
          '<div class="t-name">' + escapeHtml(t.name) + '</div>' +
          '<div class="t-desc">' + escapeHtml(t.description || '') + '</div>' +
          '</div>';
      }).join('');
      toolListEl.querySelectorAll('.tool-item').forEach(function (el) {
        el.addEventListener('click', function () {
          selectTool(Number(el.getAttribute('data-index')));
        });
      });
      selectTool(0);
    } catch (e) {
      toolListEl.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div>' +
        '<div class="empty-text text-danger">' + escapeHtml(e.message) + '</div></div>';
      toast(e.message, 'error');
    }
  }

  function selectTool(index) {
    selectedIndex = index;
    toolListEl.querySelectorAll('.tool-item').forEach(function (el) {
      el.classList.toggle('active', Number(el.getAttribute('data-index')) === index);
    });
    renderDetail(tools[index]);
  }

  /* ---------------- 参数表单（按 JSON Schema 动态生成） ---------------- */
  function fieldHtml(name, schema, required) {
    var type = (schema && schema.type) || 'string';
    var label = '<label>' + escapeHtml(name) + (required ? '<span class="req">*</span>' : '') +
      ' <span class="text-light fs-12">(' + escapeHtml(type) + ')</span></label>';
    var input;
    if (type === 'boolean') {
      input = '<select class="form-control" data-arg="' + escapeHtml(name) + '" data-type="boolean">' +
        '<option value="">不设置</option>' +
        '<option value="true">true</option>' +
        '<option value="false">false</option>' +
        '</select>';
    } else if (type === 'integer' || type === 'number') {
      input = '<input type="number" class="form-control" data-arg="' + escapeHtml(name) +
        '" data-type="' + type + '" placeholder="请输入数字">';
    } else if (type === 'array' || type === 'object') {
      input = '<textarea class="form-control" data-arg="' + escapeHtml(name) +
        '" data-type="' + type + '" placeholder="JSON 格式，例如 ' +
        (type === 'array' ? '[1,2]' : '{&quot;key&quot;:&quot;value&quot;}') + '"></textarea>';
    } else {
      input = '<input type="text" class="form-control" data-arg="' + escapeHtml(name) +
        '" data-type="string" placeholder="请输入文本">';
    }
    return '<div class="form-item">' + label + input + '</div>';
  }

  function renderDetail(tool) {
    if (!tool) {
      detailTitle.textContent = '工具详情';
      detailName.textContent = '';
      detailBody.innerHTML = '<div class="empty"><div class="empty-icon">🧰</div>' +
        '<div class="empty-text">请选择左侧工具查看参数并调用</div></div>';
      return;
    }

    detailTitle.innerHTML = '🔧 工具详情';
    detailName.textContent = tool.name;

    var schema = tool.parameters || {};
    var properties = schema.properties || {};
    var required = schema.required || [];
    var names = Object.keys(properties);
    var fieldsHtml = names.length
      ? names.map(function (name) { return fieldHtml(name, properties[name], required.indexOf(name) >= 0); }).join('')
      : '<div class="form-hint">该工具无需参数，直接调用即可。</div>';

    detailBody.innerHTML =
      '<div class="side-section-title">功能说明</div>' +
      '<div class="fs-13" style="line-height:1.8;color:var(--text-secondary);white-space:pre-wrap;">' +
      escapeHtml(tool.description || '—') + '</div>' +

      '<div class="side-section-title mt-16">调用参数</div>' +
      '<div id="argForm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">' +
      fieldsHtml + '</div>' +

      '<div class="flex gap-8 mt-16">' +
      '<button class="btn btn-primary" id="callBtn" type="button">调用工具</button>' +
      '<button class="btn btn-default" id="resetBtn" type="button">重置</button>' +
      '</div>' +

      '<div class="mt-16">' +
      '<div class="side-section-title">调用结果</div>' +
      '<pre class="code-block" id="callResult">点击「调用工具」查看返回结果</pre>' +
      '</div>' +

      '<details class="tool-call mt-16">' +
      '<summary>查看参数定义（JSON Schema）</summary>' +
      '<div class="tc-body"><pre class="code-block">' + escapeHtml(prettyJson(schema)) + '</pre></div>' +
      '</details>';

    document.getElementById('callBtn').addEventListener('click', callTool);
    document.getElementById('resetBtn').addEventListener('click', function () {
      document.getElementById('argForm').querySelectorAll('[data-arg]').forEach(function (el) {
        el.value = '';
      });
      document.getElementById('callResult').textContent = '点击「调用工具」查看返回结果';
    });
  }

  /* ---------------- 收集参数并调用 ---------------- */
  function collectArguments(tool) {
    var schema = tool.parameters || {};
    var required = schema.required || [];
    var args = {};
    var fields = document.getElementById('argForm').querySelectorAll('[data-arg]');

    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      var name = el.getAttribute('data-arg');
      var type = el.getAttribute('data-type');
      var raw = el.value;

      if (raw === '' || raw === null || raw === undefined) {
        if (required.indexOf(name) >= 0) {
          toast('参数「' + name + '」为必填项', 'warning');
          return null;
        }
        continue;
      }
      if (type === 'integer') {
        var n = parseInt(raw, 10);
        if (isNaN(n)) { toast('参数「' + name + '」需要整数', 'warning'); return null; }
        args[name] = n;
      } else if (type === 'number') {
        var f = parseFloat(raw);
        if (isNaN(f)) { toast('参数「' + name + '」需要数字', 'warning'); return null; }
        args[name] = f;
      } else if (type === 'boolean') {
        args[name] = raw === 'true';
      } else if (type === 'array' || type === 'object') {
        try {
          args[name] = JSON.parse(raw);
        } catch (e) {
          toast('参数「' + name + '」不是合法 JSON', 'warning');
          return null;
        }
      } else {
        args[name] = raw;
      }
    }
    return args;
  }

  async function callTool() {
    var tool = tools[selectedIndex];
    if (!tool) return;
    var args = collectArguments(tool);
    if (args === null) return;

    var btn = document.getElementById('callBtn');
    var resultEl = document.getElementById('callResult');
    btn.disabled = true;
    btn.textContent = '调用中…';
    resultEl.textContent = '调用中...';
    try {
      var data = await API.mcp.call({ tool_name: tool.name, arguments: args });
      resultEl.textContent = prettyJson(data.result !== undefined ? data.result : data);
      var hasError = data.result && !Array.isArray(data.result) && data.result.error;
      toast(hasError ? ('调用返回错误：' + data.result.error) : '调用成功', hasError ? 'warning' : 'success');
    } catch (e) {
      resultEl.textContent = '调用失败：' + e.message;
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '调用工具';
    }
  }

  function init() {
    loadTools();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
