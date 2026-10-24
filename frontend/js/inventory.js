/* ============================================================
 * inventory.js —— 库存管理：列表 / 筛选 / 入库 / 出库 / 预警专区
 * ============================================================ */
(function () {
  'use strict';

  var state = { page: 1, page_size: 10, keyword: '', status: '' };
  var tbody = document.getElementById('tbody');
  var currentList = [];

  function statusTag(status) {
    var meta = APP_ENUMS.INVENTORY_STATUS[status] || { text: status, tag: 'gray' };
    return tag(meta.text, meta.tag);
  }

  /* ---------------- 库存列表 ---------------- */
  function renderTable(list) {
    if (!list || !list.length) {
      tbody.innerHTML = tableEmptyHTML(8, '暂无库存数据');
      return;
    }
    tbody.innerHTML = list.map(function (item) {
      var outOfStock = Number(item.current_stock) <= 0;
      return '<tr>' +
        '<td><div class="product-cell">' + avatarBlock(item.product_name) +
        '<div><div class="p-name">' + escapeHtml(item.product_name) + '</div>' +
        '<div class="p-sub">ID: ' + item.product_id + '</div></div></div></td>' +
        '<td>' + escapeHtml(item.sku || '-') + '</td>' +
        '<td class="' + (outOfStock ? 'text-danger fw-600' : 'fw-600') + '">' + formatNumber(item.current_stock) + '</td>' +
        '<td>' + formatNumber(item.safe_stock) + '</td>' +
        '<td>' + formatNumber(item.max_stock) + '</td>' +
        '<td>' + escapeHtml(item.warehouse || '-') + '</td>' +
        '<td>' + statusTag(item.status) + '</td>' +
        '<td class="text-light fs-12">' + formatDate(item.updated_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  async function load() {
    tbody.innerHTML = tableLoadingHTML(8);
    try {
      var data = await API.inventory.list({
        keyword: state.keyword,
        status: state.status,
        page: state.page,
        page_size: state.page_size
      });
      currentList = data.list || [];
      document.getElementById('invCount').textContent = '共 ' + data.total + ' 条';
      renderTable(currentList);
      renderPagination('#pagination', data, function (p) { state.page = p; load(); });
    } catch (e) {
      tbody.innerHTML = tableEmptyHTML(8, '加载失败：' + e.message);
      toast(e.message, 'error');
    }
  }

  /* ---------------- 预警专区 ---------------- */
  async function loadWarning() {
    var box = document.getElementById('warnList');
    box.innerHTML = '<div class="loading"><span class="spinner"></span>加载中...</div>';
    try {
      var list = await API.inventory.warning();
      if (!list || !list.length) {
        box.innerHTML = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">库存状态良好，暂无预警</div></div>';
        return;
      }
      box.innerHTML = list.map(function (item) {
        var danger = Number(item.current_stock) <= 0;
        return '<div class="warn-item' + (danger ? ' danger' : '') + '">' +
          '<span>' + (danger ? '🚨' : '⚠️') + '</span>' +
          '<span class="warn-name" title="' + escapeHtml(item.product_name) + '">' + escapeHtml(item.product_name) + '</span>' +
          '<span class="warn-stock">' + item.current_stock + ' / ' + item.safe_stock + '</span>' +
          statusTag(item.status) +
          '</div>';
      }).join('');
    } catch (e) {
      box.innerHTML = '<div class="empty"><div class="empty-text text-danger">加载失败：' + escapeHtml(e.message) + '</div></div>';
    }
  }

  /* ---------------- 入库 / 出库 ---------------- */
  async function openStockModal(direction) {
    var isIn = direction === 'in';
    var data;
    try {
      data = await API.inventory.list({ page: 1, page_size: 200 });
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
    var items = (data && data.list) || [];
    if (!items.length) {
      toast('暂无可操作的商品库存，请先创建商品', 'warning');
      return;
    }

    var options = items.map(function (i) {
      return '<option value="' + i.product_id + '" data-stock="' + i.current_stock + '">' +
        escapeHtml(i.product_name) + '（' + escapeHtml(i.sku || '-') + '）· 现有 ' + i.current_stock + '</option>';
    }).join('');

    var html = '' +
      '<div class="form-item"><label>选择商品 <span class="req">*</span></label>' +
      '<select class="form-control" id="s_product">' + options + '</select></div>' +
      '<div class="form-item"><label>' + (isIn ? '入库' : '出库') + '数量 <span class="req">*</span></label>' +
      '<input type="number" min="1" class="form-control" id="s_qty" value="1"></div>' +
      '<div class="form-item"><label>备注</label>' +
      '<input class="form-control" id="s_remark" maxlength="200" placeholder="可选，例如：采购到货 / 客户发货"></div>' +
      '<div class="form-hint" id="s_hint"></div>';

    openModal(isIn ? '商品入库' : '商品出库', html, async function () {
      var productId = Number(document.getElementById('s_product').value || 0);
      var quantity = Number(document.getElementById('s_qty').value || 0);
      if (!productId) { toast('请选择商品', 'warning'); return false; }
      if (!quantity || quantity <= 0) { toast('数量必须大于 0', 'warning'); return false; }

      var body = {
        product_id: productId,
        quantity: quantity,
        remark: document.getElementById('s_remark').value.trim()
      };
      try {
        if (isIn) await API.inventory.stockIn(body);
        else await API.inventory.stockOut(body);
        toast(isIn ? '入库成功' : '出库成功', 'success');
        load();
        loadWarning();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }, { width: '480px' });

    var select = document.getElementById('s_product');
    var hint = document.getElementById('s_hint');
    function updateHint() {
      var opt = select.options[select.selectedIndex];
      hint.textContent = '当前库存：' + (opt ? opt.getAttribute('data-stock') : 0);
    }
    select.addEventListener('change', updateHint);
    updateHint();
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('keyword').value.trim();
      state.status = document.getElementById('filterStatus').value;
      state.page = 1;
      load();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      document.getElementById('keyword').value = '';
      document.getElementById('filterStatus').value = '';
      state = { page: 1, page_size: 10, keyword: '', status: '' };
      load();
    });
    document.getElementById('keyword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('searchBtn').click();
    });
    document.getElementById('inBtn').addEventListener('click', function () { openStockModal('in'); });
    document.getElementById('outBtn').addEventListener('click', function () { openStockModal('out'); });
    document.getElementById('warnRefreshBtn').addEventListener('click', loadWarning);

    load();
    loadWarning();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
