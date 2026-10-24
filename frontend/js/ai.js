/* ============================================================
 * ai.js —— AI 助手：聊天面板（引用来源 / 耗时 / 历史 / 清空）
 * 对应接口：POST /api/ai/chat、GET /api/ai/history
 * ============================================================ */
(function () {
  'use strict';

  var sessionId = 'default';
  var messages = null;

  var EXAMPLES = [
    '商品上架需要准备哪些资料？',
    '库存预警线是怎么定义的？',
    '售后服务政策包含哪些内容？',
    '系统支持哪些功能模块？'
  ];

  var CHAT_FALLBACK =
    '<div class="chat-panel">' +
    '  <div class="chat-messages" id="aiChatMessages"></div>' +
    '  <div class="chat-input-bar">' +
    '    <textarea id="aiChatInput" rows="1" placeholder="输入你的问题，回车发送，Shift + Enter 换行"></textarea>' +
    '    <button class="btn btn-primary" id="aiChatSend" type="button">发送</button>' +
    '  </div>' +
    '</div>';

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
      '你好，我是基于知识库的 AI 助手 🤖<br>可以问我商品的<b>资料</b>、<b>库存规则</b>、<b>售后政策</b>、<b>系统说明</b>等问题。');
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
    var loading = appendChatLoading(messages, '思考中');

    try {
      var data = await API.ai.chat({ question: q, session_id: sessionId });
      if (loading) loading.remove();
      var html = renderMarkdown(data.answer || '（无回答）');
      if (data.refs && data.refs.length) {
        html += '<div class="ai-refs">引用来源：' + data.refs.map(function (r) {
          return '<span class="ref-chip">' + escapeHtml(r) + '</span>';
        }).join('') + '</div>';
      }
      html += '<div class="ai-meta">耗时 ' + (data.elapsed_ms || 0) + ' ms · 会话 ' +
        escapeHtml(data.session_id || sessionId) + '</div>';
      appendChatMsg(messages, 'bot', html);
      loadHistory();
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

  async function loadHistory() {
    var box = document.getElementById('history');
    try {
      var list = await API.ai.history(sessionId, 20);
      if (!list || !list.length) {
        box.innerHTML = '<div class="empty" style="padding:18px 0;"><div class="empty-text">暂无历史记录</div></div>';
        return;
      }
      box.innerHTML = list.slice().reverse().map(function (item, index) {
        return '<div class="history-item" data-index="' + index + '">' +
          '<div class="h-q" title="' + escapeHtml(item.question) + '">' + escapeHtml(item.question) + '</div>' +
          '<div class="h-t">' + formatDate(item.created_at) + ' · ' + (item.elapsed_ms || 0) + 'ms</div>' +
          '</div>';
      }).join('');

      var items = list.slice().reverse();
      box.querySelectorAll('.history-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var item = items[Number(el.getAttribute('data-index'))];
          if (!item) return;
          appendChatMsg(messages, 'user', escapeHtml(item.question));
          var html = renderMarkdown(item.answer || '（无回答）');
          if (item.refs) {
            html += '<div class="ai-refs">引用来源：' + String(item.refs).split(',').filter(Boolean).map(function (r) {
              return '<span class="ref-chip">' + escapeHtml(r) + '</span>';
            }).join('') + '</div>';
          }
          html += '<div class="ai-meta">历史记录 · ' + formatDate(item.created_at) + '</div>';
          appendChatMsg(messages, 'bot', html);
        });
      });
    } catch (e) {
      box.innerHTML = '<div class="empty" style="padding:18px 0;"><div class="empty-text text-danger">' +
        escapeHtml(e.message) + '</div></div>';
    }
  }

  async function init() {
    renderExamples();
    await mountChat();
    loadHistory();

    document.getElementById('clearBtn').addEventListener('click', async function () {
      var ok = await confirmDialog('确定清空当前会话窗口吗？（仅清空页面展示，服务端历史记录会保留）');
      if (!ok) return;
      messages.innerHTML = '';
      appendChatMsg(messages, 'bot', '会话已清空，有什么可以帮你？');
      toast('会话已清空', 'success');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
