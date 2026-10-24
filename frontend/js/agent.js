/* ============================================================
 * agent.js —— 商品 Agent：对话 + 工具调用链展示
 * 对应接口：POST /api/ai/agent/chat
 * 返回：{answer, tool_calls:[{tool,arguments,result}], elapsed_ms, session_id, agent}
 * ============================================================ */
(function () {
  'use strict';

  var sessionId = 'agent';
  var messages = null;

  var EXAMPLES = [
    '帮我看看库存不足的商品，并告诉我应该优先补哪个？',
    '本月卖了多少钱？',
    '帮我查订单 SO20250927001',
    '销量最好的商品 Top 5 是哪些？'
  ];

  var CHAT_FALLBACK =
    '<div class="chat-panel">' +
    '  <div class="chat-messages" id="aiChatMessages"></div>' +
    '  <div class="chat-input-bar">' +
    '    <textarea id="aiChatInput" rows="1" placeholder="输入你的问题，回车发送，Shift + Enter 换行"></textarea>' +
    '    <button class="btn btn-primary" id="aiChatSend" type="button">发送</button>' +
    '  </div>' +
    '</div>';

  /** 安全地把任意值格式化成 JSON 文本用于展示 */
  function prettyJson(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  /** 渲染工具调用链（可折叠面板） */
  function renderToolCalls(toolCalls) {
    if (!toolCalls || !toolCalls.length) return '';
    return '<div class="mt-8">' + toolCalls.map(function (call, index) {
      return '<details class="tool-call"' + (index === 0 ? ' open' : '') + '>' +
        '<summary>🔧 调用工具：' + escapeHtml(call.tool || '-') + '</summary>' +
        '<div class="tc-body">' +
        '  <div class="tc-label">工具入参</div>' +
        '  <pre class="code-block">' + escapeHtml(prettyJson(call.arguments || {})) + '</pre>' +
        '  <div class="tc-label">工具结果</div>' +
        '  <pre class="code-block">' + escapeHtml(prettyJson(call.result)) + '</pre>' +
        '</div>' +
        '</details>';
    }).join('') + '</div>';
  }

  async function mountChat() {
    var host = document.getElementById('chatHost');
    var html = CHAT_FALLBACK;
    try {
      var res = await fetch('../components/ai-chat.html', { cache: 'no-store' });
      if (res.ok) {
        var text = await res.text();
        if (text && text.trim()) html = text;
      }
    } catch (e) { /* 组件拉取失败用内置兜底 */ }
    host.innerHTML = html;
    messages = document.getElementById('aiChatMessages');
    appendChatMsg(messages, 'bot',
      '你好，我是<b>商品 Agent</b> 🤖<br>我会自动调用 MCP 工具查询真实的商品 / 库存 / 订单数据后给出结论，' +
      '工具调用过程可展开查看。');
    bindChat();
  }

  function bindChat() {
    var input = document.getElementById('aiChatInput');
    var sendBtn = document.getElementById('aiChatSend');
    if (!input || !sendBtn) return;
    sendBtn.addEventListener('click', function () { send(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  async function send(text) {
    var input = document.getElementById('aiChatInput');
    var q = (text !== undefined && text !== null) ? String(text).trim() : (input ? input.value.trim() : '');
    if (!q) return;
    if (input) input.value = '';

    appendChatMsg(messages, 'user', escapeHtml(q));
    var loading = appendChatLoading(messages, 'Agent 思考中');

    try {
      var data = await API.agent.chat({ question: q, session_id: sessionId });
      if (loading) loading.remove();

      var html = renderMarkdown(data.answer || '（无回答）');
      html += renderToolCalls(data.tool_calls);
      var toolNames = (data.tool_calls || []).map(function (c) { return c.tool; }).join(', ');
      html += '<div class="ai-meta">Agent：' + escapeHtml(data.agent || 'ProductAgent') +
        ' · 调用工具：' + escapeHtml(toolNames || '无') +
        ' · 耗时 ' + (data.elapsed_ms || 0) + ' ms</div>';
      appendChatMsg(messages, 'bot', html);
    } catch (e) {
      if (loading) loading.remove();
      appendChatMsg(messages, 'bot', '<span class="text-danger">' + escapeHtml(e.message) + '</span>');
    }
  }

  function renderExamples() {
    var box = document.getElementById('examples');
    box.innerHTML = EXAMPLES.map(function (q) {
      return '<button class="example-q" type="button">' + escapeHtml(q) + '</button>';
    }).join('');
    box.querySelectorAll('.example-q').forEach(function (btn) {
      btn.addEventListener('click', function () { send(btn.textContent); });
    });
  }

  async function init() {
    renderExamples();
    await mountChat();

    document.getElementById('clearBtn').addEventListener('click', async function () {
      var ok = await confirmDialog('确定清空当前对话窗口吗？');
      if (!ok) return;
      messages.innerHTML = '';
      appendChatMsg(messages, 'bot', '对话已清空，有什么可以帮你？');
      toast('对话已清空', 'success');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
