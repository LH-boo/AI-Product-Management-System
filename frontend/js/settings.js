/* ============================================================
 * settings.js —— 系统设置（只读展示后端 .env 配置）
 *
 * 说明：后端目前没有提供配置查询 / 保存接口，
 *       下方配置值直接取自项目根目录 .env（只读展示）；
 *       「保存设置」按钮仅做前端提示（保存接口待后端补充）。
 * ============================================================ */
(function () {
  'use strict';

  /* 与后端根目录 .env 保持一致（只读展示，密码 / Key 不回显） */
  var ENV_CONFIG = {
    APP_NAME: 'AI智能商品管理系统',
    MYSQL_HOST: '127.0.0.1',
    MYSQL_PORT: 3306,
    MYSQL_USER: 'root',
    MYSQL_DB: 'ai_product',
    LLM_BASE_URL: 'https://api.openai.com/v1',
    LLM_MODEL: 'gpt-4o-mini',
    LLM_TEMPERATURE: 0.3,
    EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
    EMBEDDING_MODEL: 'text-embedding-3-small',
    TOP_K: 4,
    CHUNK_SIZE: 500,
    CHUNK_OVERLAP: 80,
    CHROMA_COLLECTION: 'product_knowledge'
  };

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = (value === null || value === undefined || value === '') ? '-' : String(value);
  }

  function fillConfig() {
    setText('sAppName', ENV_CONFIG.APP_NAME);
    setText('dbHost', ENV_CONFIG.MYSQL_HOST);
    setText('dbPort', ENV_CONFIG.MYSQL_PORT);
    setText('dbUser', ENV_CONFIG.MYSQL_USER);
    setText('dbPwd', '••••••（不回显）');
    setText('dbName', ENV_CONFIG.MYSQL_DB);

    setText('llmBase', ENV_CONFIG.LLM_BASE_URL);
    setText('llmModel', ENV_CONFIG.LLM_MODEL);
    setText('llmTemp', ENV_CONFIG.LLM_TEMPERATURE);
    setText('llmKey', '已配置（出于安全不回显）');
    setText('embBase', ENV_CONFIG.EMBEDDING_BASE_URL);
    setText('embModel', ENV_CONFIG.EMBEDDING_MODEL);

    setText('ragTopK', ENV_CONFIG.TOP_K);
    setText('ragChunk', ENV_CONFIG.CHUNK_SIZE);
    setText('ragOverlap', ENV_CONFIG.CHUNK_OVERLAP);
    setText('ragCollection', ENV_CONFIG.CHROMA_COLLECTION);
  }

  /* ---------------- 健康检查：动态展示服务状态与系统名称 ---------------- */
  async function checkHealth() {
    var healthTag = document.getElementById('healthTag');
    try {
      var data = await API.health();
      healthTag.className = 'tag tag-success';
      healthTag.textContent = '服务正常 · ' + (data.status || 'ok');
      if (data.app) setText('sAppName', data.app);
    } catch (e) {
      healthTag.className = 'tag tag-danger';
      healthTag.textContent = '服务不可用';
    }
  }

  /* ---------------- 测试 LLM 连接：向 /api/ai/chat 发送「你好」 ---------------- */
  async function testLlm() {
    var btn = document.getElementById('testLlmBtn');
    var box = document.getElementById('llmTestBox');
    var text = document.getElementById('llmTestText');
    btn.disabled = true;
    btn.textContent = '测试中…';
    box.style.display = '';
    text.innerHTML = '<span class="placeholder">正在向 /api/ai/chat 发送测试消息…</span>';
    try {
      var data = await API.ai.chat({ question: '你好', session_id: 'settings-test' });
      var html = renderMarkdown(data.answer || '（无返回内容）');
      html += '<div class="ai-meta">耗时 ' + (data.elapsed_ms || 0) + ' ms' +
        ((data.refs && data.refs.length) ? ' · 引用来源 ' + data.refs.length + ' 条' : '') + '</div>';
      text.innerHTML = html;
      toast('LLM 连接测试完成', 'success');
    } catch (e) {
      text.innerHTML = '<span class="text-danger">测试失败：' + escapeHtml(e.message) + '</span>';
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '测试 LLM 连接';
    }
  }

  /* ---------------- 保存设置：后端接口待补充 ---------------- */
  function save() {
    // TODO（后端接口待补充）：配置保存接口 /api/settings 尚未提供，
    // 目前仅做前端提示，实际修改请编辑项目根目录的 .env 文件并重启服务。
    toast('配置保存接口待后端补充，请直接修改 .env 后重启服务', 'warning');
  }

  function init() {
    fillConfig();
    checkHealth();
    document.getElementById('testLlmBtn').addEventListener('click', testLlm);
    document.getElementById('saveBtn').addEventListener('click', save);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
