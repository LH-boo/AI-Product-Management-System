/* ============================================================
 * rag.js —— RAG 知识库：概览 / 上传 / 文档列表 / 检索测试 / 重建索引
 * ============================================================ */
(function () {
  'use strict';

  var docTbody = document.getElementById('docTbody');

  var CATEGORY_TEXT = {
    products: '商品资料',
    after_sale: '售后政策',
    inventory: '库存规则',
    system: '系统说明'
  };
  var DOC_STATUS = {
    indexed: { text: '已索引', tag: 'success' },
    pending: { text: '待索引', tag: 'warning' },
    failed: { text: '索引失败', tag: 'danger' }
  };

  /* ---------------- 概览 + 文档列表 ---------------- */
  async function loadOverview() {
    try {
      var data = await API.rag.overview();
      var statusMeta = data.status === 'indexed'
        ? { text: '已建立索引', cls: 'green', icon: '✅' }
        : { text: '索引为空', cls: 'orange', icon: '⚠️' };

      var cards = [
        { icon: '📄', cls: 'blue', label: '文档数量', value: formatNumber(data.doc_count) },
        { icon: '🧩', cls: 'purple', label: '文本块数量', value: formatNumber(data.chunk_count) },
        { icon: '🧠', cls: 'cyan', label: '向量数量', value: formatNumber(data.vector_count) },
        { icon: statusMeta.icon, cls: statusMeta.cls, label: '索引状态', value: statusMeta.text }
      ];
      document.getElementById('statGrid').innerHTML = cards.map(function (c) {
        return '<div class="stat-card"><div class="stat-icon ' + c.cls + '">' + c.icon + '</div>' +
          '<div class="stat-info"><div class="stat-value">' + c.value + '</div>' +
          '<div class="stat-label">' + c.label + '</div></div></div>';
      }).join('');

      var docs = data.documents || [];
      document.getElementById('docCount').textContent = '共 ' + docs.length + ' 个文档';
      if (!docs.length) {
        docTbody.innerHTML = tableEmptyHTML(6, '暂无知识文档，请先上传 .txt / .md 文件');
        return;
      }
      docTbody.innerHTML = docs.map(function (d) {
        var meta = DOC_STATUS[d.status] || { text: d.status, tag: 'gray' };
        return '<tr>' +
          '<td class="fw-600">' + escapeHtml(d.doc_name) + '</td>' +
          '<td>' + tag(CATEGORY_TEXT[d.category] || d.category, 'info') + '</td>' +
          '<td>' + formatNumber(d.chunk_count) + '</td>' +
          '<td>' + formatNumber(d.vector_count) + '</td>' +
          '<td>' + tag(meta.text, meta.tag) + '</td>' +
          '<td class="text-light fs-12">' + formatDate(d.created_at) + '</td>' +
          '</tr>';
      }).join('');
    } catch (e) {
      docTbody.innerHTML = tableEmptyHTML(6, '加载失败：' + e.message);
      toast(e.message, 'error');
    }
  }

  /* ---------------- 上传 ---------------- */
  async function upload() {
    var fileInput = document.getElementById('uploadFile');
    var file = fileInput.files && fileInput.files[0];
    if (!file) { toast('请先选择 .txt / .md 文件', 'warning'); return; }
    var name = (file.name || '').toLowerCase();
    if (!(name.endsWith('.txt') || name.endsWith('.md'))) {
      toast('仅支持 .txt / .md 文件', 'warning');
      return;
    }

    var btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.textContent = '上传中…';
    var form = new FormData();
    form.append('file', file);
    form.append('category', document.getElementById('uploadCategory').value);
    try {
      var info = await API.rag.upload(form);
      toast('上传并索引成功（文本块 ' + (info.chunk_count || 0) + ' 个）', 'success');
      fileInput.value = '';
      loadOverview();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '上传并索引';
    }
  }

  /* ---------------- 重建索引 ---------------- */
  async function reindex() {
    var ok = await confirmDialog('确定重建索引吗？会清空向量库并重新加载 knowledge 目录下的全部文档。');
    if (!ok) return;
    var btn = document.getElementById('reindexBtn');
    btn.disabled = true;
    btn.textContent = '重建中…';
    try {
      var info = await API.rag.reindex();
      toast('重建完成：文档 ' + (info.doc_count || 0) + ' 个 / 向量 ' + (info.vector_count || 0) + ' 条', 'success');
      loadOverview();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 重建索引';
    }
  }

  /* ---------------- 检索测试 ---------------- */
  function renderSearch(data) {
    var results = data.results || [];
    var answerBox = document.getElementById('answerBox');
    var answerText = document.getElementById('answerText');
    var resultsBox = document.getElementById('resultsBox');

    answerBox.style.display = '';
    answerText.innerHTML = renderMarkdown(data.answer || '（无答案）');

    if (!results.length) {
      resultsBox.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div>' +
        '<div class="empty-text">未检索到相关内容，可尝试上传相关资料或重建索引</div></div>';
      return;
    }
    resultsBox.innerHTML = '<div class="side-section-title">检索结果（' + results.length + ' 条）</div>' +
      results.map(function (r) {
        return '<div class="result-card">' +
          '<div class="rc-head">' +
          '<span class="rc-source">📄 ' + escapeHtml(r.source || '-') + '</span>' +
          tag(CATEGORY_TEXT[r.category] || r.category || '-', 'info') +
          '<span class="score-badge">相似度 ' + (Number(r.score || 0)).toFixed(3) + '</span>' +
          '</div>' +
          '<div class="rc-content">' + escapeHtml(r.content || '') + '</div>' +
          '</div>';
      }).join('');
  }

  async function doSearch() {
    var question = document.getElementById('qInput').value.trim();
    if (!question) { toast('请输入测试问题', 'warning'); return; }
    var btn = document.getElementById('searchBtn');
    btn.disabled = true;
    btn.textContent = '检索中…';
    try {
      var data = await API.rag.search({
        question: question,
        top_k: Number(document.getElementById('topK').value || 4)
      });
      renderSearch(data);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '检索';
    }
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    document.getElementById('uploadBtn').addEventListener('click', upload);
    document.getElementById('reindexBtn').addEventListener('click', reindex);
    document.getElementById('searchBtn').addEventListener('click', doSearch);
    document.getElementById('qInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });
    loadOverview();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
