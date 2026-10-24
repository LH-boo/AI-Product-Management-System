/* ============================================================
 * order.js —— 订单管理：列表 / 详情 / 新建（动态明细）/ 状态流转 / 取消
 * ============================================================ */
(function () {
  'use strict';

  var state = { page: 1, page_size: 10, keyword: '', status: '' };
  var tbody = document.getElementById('tbody');
  var currentList = [];

  var productList = [];
  var productIndex = {};

  /* ---------------- 列表 ---------------- */
  function renderTable(list) {
    if (!list || !list.length) {
      tbody.innerHTML = tableEmptyHTML(6, '暂无订单数据');
      return;
    }
    tbody.innerHTML = list.map(function (o) {
      var tagType = APP_ENUMS.ORDER_STATUS_TAG[o.status] || 'gray';
      return '<tr>' +
        '<td class="fw-600">' + escapeHtml(o.order_no) + '</td>' +
        '<td>' + escapeHtml(o.customer_name || '-') + '</td>' +
        '<td class="money big">' + formatMoney(o.total_amount) + '</td>' +
        '<td>' + tag(o.status_text || o.status, tagType) + '</td>' +
        '<td class="text-light fs-12">' + formatDate(o.created_at) + '</td>' +
        '<td class="actions">' +
        '<button class="btn-text" data-act="detail" data-id="' + o.id + '" type="button">详情</button>' +
        '<button class="btn-text" data-act="status" data-id="' + o.id + '" type="button">改状态</button>' +
        '<button class="btn-text danger" data-act="cancel" data-id="' + o.id + '" type="button">取消</button>' +
        '</td></tr>';
    }).join('');
    bindRowEvents();
  }

  function bindRowEvents() {
    tbody.querySelectorAll('button[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-id'));
        var order = currentList.filter(function (o) { return o.id === id; })[0];
        if (!order) return;
        var act = btn.getAttribute('data-act');
        if (act === 'detail') showDetail(order);
        else if (act === 'status') changeStatus(order);
        else cancelOrder(order);
      });
    });
  }

  async function load() {
    tbody.innerHTML = tableLoadingHTML(6);
    try {
      var data = await API.orders.list({
        keyword: state.keyword,
        status: state.status,
        page: state.page,
        page_size: state.page_size
      });
      currentList = data.list || [];
      renderTable(currentList);
      renderPagination('#pagination', data, function (p) { state.page = p; load(); });
    } catch (e) {
      tbody.innerHTML = tableEmptyHTML(6, '加载失败：' + e.message);
      toast(e.message, 'error');
    }
  }

  /* ---------------- 订单详情 ---------------- */
  async function showDetail(order) {
    openModal('订单详情', '<div class="loading"><span class="spinner"></span>加载中...</div>', null,
      { hideCancel: true, confirmText: '关闭', width: '640px' });
    try {
      var d = await API.orders.get(order.id);
      var items = d.items || [];
      var itemsHtml = items.length
        ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>商品名称</th><th>单价</th><th>数量</th><th class="text-right">小计</th></tr></thead><tbody>' +
          items.map(function (it) {
            return '<tr><td>' + escapeHtml(it.product_name) + '</td>' +
              '<td>' + formatMoney(it.price) + '</td>' +
              '<td>' + it.quantity + '</td>' +
              '<td class="text-right money">' + formatMoney(it.subtotal) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty"><div class="empty-text">无订单明细</div></div>';

      var html = '' +
        '<div class="detail-grid">' +
        '<div class="detail-row"><span class="dt">订单号</span><span class="dd fw-600">' + escapeHtml(d.order_no) + '</span></div>' +
        '<div class="detail-row"><span class="dt">客户</span><span class="dd">' + escapeHtml(d.customer_name || '-') + '</span></div>' +
        '<div class="detail-row"><span class="dt">状态</span><span class="dd">' +
        tag(d.status_text || d.status, APP_ENUMS.ORDER_STATUS_TAG[d.status] || 'gray') + '</span></div>' +
        '<div class="detail-row"><span class="dt">订单金额</span><span class="dd money big">' + formatMoney(d.total_amount) + '</span></div>' +
        '<div class="detail-row"><span class="dt">下单时间</span><span class="dd">' + formatDate(d.created_at) + '</span></div>' +
        '<div class="detail-row"><span class="dt">更新时间</span><span class="dd">' + formatDate(d.updated_at) + '</span></div>' +
        '<div class="detail-row full"><span class="dt">备注</span><span class="dd">' + escapeHtml(d.remark || '-') + '</span></div>' +
        '</div>' +
        '<div class="modal-section-title mt-16" style="font-weight:600;margin-bottom:8px;">商品明细</div>' +
        itemsHtml;
      document.getElementById('modalBody').innerHTML = html;
    } catch (e) {
      document.getElementById('modalBody').innerHTML = '<div class="empty"><div class="empty-text text-danger">' +
        escapeHtml(e.message) + '</div></div>';
    }
  }

  /* ---------------- 修改状态 ---------------- */
  function changeStatus(order) {
    var allowed = (APP_ENUMS.ORDER_STATUS_FLOW[order.status] || []).filter(function (s) { return s !== 'cancelled'; });
    if (!allowed.length) {
      toast('当前订单状态（' + (order.status_text || order.status) + '）不可再流转', 'warning');
      return;
    }
    var options = allowed.map(function (s) {
      return '<option value="' + s + '">' + APP_ENUMS.ORDER_STATUS[s] + '</option>';
    }).join('');

    var html = '' +
      '<div class="form-item"><label>当前状态</label><div class="form-static">' +
      escapeHtml(order.status_text || order.status) + '</div></div>' +
      '<div class="form-item"><label>变更为 <span class="req">*</span></label>' +
      '<select class="form-control" id="o_status">' + options + '</select></div>' +
      '<div class="form-item"><label>备注</label>' +
      '<input class="form-control" id="o_remark" maxlength="200" value="' + escapeHtml(order.remark || '') + '"></div>';

    openModal('修改订单状态', html, async function () {
      var status = document.getElementById('o_status').value;
      var remark = document.getElementById('o_remark').value.trim();
      try {
        await API.orders.update(order.id, { status: status, remark: remark });
        toast('状态已更新为「' + APP_ENUMS.ORDER_STATUS[status] + '」', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }, { width: '460px' });
  }

  async function cancelOrder(order) {
    if (order.status === 'cancelled') { toast('该订单已取消', 'warning'); return; }
    var ok = await confirmDialog('确定取消订单「' + order.order_no + '」吗？取消后库存会自动归还。');
    if (!ok) return;
    try {
      await API.orders.cancel(order.id);
      toast('订单已取消', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* ---------------- 新建订单 ---------------- */
  function itemRowHtml() {
    var options = productList.map(function (p) {
      return '<option value="' + p.id + '" data-price="' + p.price + '">' +
        escapeHtml(p.name) + '（库存 ' + p.stock + '）</option>';
    }).join('');
    return '<div class="order-item-row">' +
      '<select class="form-control item-product"><option value="">请选择商品</option>' + options + '</select>' +
      '<input type="text" class="form-control item-price" placeholder="单价" readonly>' +
      '<input type="number" class="form-control item-qty" min="1" value="1">' +
      '<div class="item-sub">¥0.00</div>' +
      '<button class="order-item-remove" type="button" title="删除该明细">×</button>' +
      '</div>';
  }

  function bindItemsEditor() {
    var container = document.getElementById('orderItems');
    var totalEl = document.getElementById('orderTotal');

    function recompute() {
      var total = 0;
      container.querySelectorAll('.order-item-row').forEach(function (row) {
        var price = Number(row.querySelector('.item-price').value || 0);
        var qty = Number(row.querySelector('.item-qty').value || 0);
        var sub = price * qty;
        row.querySelector('.item-sub').textContent = formatMoney(sub);
        total += sub;
      });
      totalEl.textContent = formatMoney(total);
    }

    function bindRow(row) {
      var select = row.querySelector('.item-product');
      var qty = row.querySelector('.item-qty');
      select.addEventListener('change', function () {
        var opt = select.options[select.selectedIndex];
        row.querySelector('.item-price').value = opt && opt.getAttribute('data-price') ? opt.getAttribute('data-price') : '';
        recompute();
      });
      qty.addEventListener('input', recompute);
      row.querySelector('.order-item-remove').addEventListener('click', function () {
        row.parentNode.removeChild(row);
        if (!container.querySelector('.order-item-row')) container.insertAdjacentHTML('beforeend', itemRowHtml());
        bindRow(container.querySelector('.order-item-row'));
        recompute();
      });
    }

    container.insertAdjacentHTML('beforeend', itemRowHtml());
    container.querySelectorAll('.order-item-row').forEach(bindRow);
    recompute();

    document.getElementById('addItemBtn').addEventListener('click', function () {
      container.insertAdjacentHTML('beforeend', itemRowHtml());
      bindRow(container.querySelectorAll('.order-item-row')[container.querySelectorAll('.order-item-row').length - 1]);
      recompute();
    });

    // 暴露给提交逻辑
    container.__recompute = recompute;
  }

  async function openCreateOrder() {
    var customers = [];
    try {
      var data = await API.customers.list({ page: 1, page_size: 200 });
      customers = data.list || [];
    } catch (e) { /* 客户拉取失败不阻塞下单 */ }
    try {
      var pdata = await API.products.list({ page: 1, page_size: 200 });
      productList = pdata.list || [];
      productIndex = {};
      productList.forEach(function (p) { productIndex[p.id] = p; });
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
    if (!productList.length) { toast('暂无可下单的商品，请先创建商品', 'warning'); return; }

    var customerOptions = customers.map(function (c) {
      return '<option value="' + c.id + '" data-name="' + escapeHtml(c.name) + '">' +
        escapeHtml(c.name) + (c.phone ? '（' + escapeHtml(c.phone) + '）' : '') + '</option>';
    }).join('');

    var html = '' +
      '<div class="form-row">' +
      '<div class="form-item"><label>选择客户</label>' +
      '<select class="form-control" id="o_customer"><option value="">（散客 / 手动填写姓名）</option>' +
      customerOptions + '</select></div>' +
      '<div class="form-item"><label>客户名称</label>' +
      '<input class="form-control" id="o_customer_name" maxlength="50" placeholder="散客可直接填写"></div>' +
      '</div>' +
      '<div class="form-item"><label>商品明细 <span class="req">*</span></label>' +
      '<div class="order-items">' +
      '<div class="order-items-head"><span>商品</span><span>单价</span><span>数量</span><span style="text-align:right;">小计</span><span></span></div>' +
      '<div id="orderItems"></div>' +
      '</div>' +
      '<button class="btn btn-default btn-sm mt-8" id="addItemBtn" type="button">+ 添加明细</button>' +
      '</div>' +
      '<div class="order-total">合计：<span class="total-value" id="orderTotal">¥0.00</span></div>' +
      '<div class="form-item mt-12"><label>订单备注</label>' +
      '<input class="form-control" id="o_remark_new" maxlength="200" placeholder="可选"></div>';

    openModal('新建订单', html, async function () {
      var container = document.getElementById('orderItems');
      var items = [];
      container.querySelectorAll('.order-item-row').forEach(function (row) {
        var pid = Number(row.querySelector('.item-product').value || 0);
        var qty = Number(row.querySelector('.item-qty').value || 0);
        if (!pid || qty <= 0) return;
        items.push({ product_id: pid, quantity: qty });
      });
      if (!items.length) { toast('请至少添加一条有效的商品明细', 'warning'); return false; }

      var customerSelect = document.getElementById('o_customer');
      var customerId = Number(customerSelect.value || 0);
      var customerName = document.getElementById('o_customer_name').value.trim();
      if (customerId && !customerName) {
        var opt = customerSelect.options[customerSelect.selectedIndex];
        customerName = opt ? opt.getAttribute('data-name') : '';
      }

      var body = {
        customer_id: customerId,
        customer_name: customerName,
        remark: document.getElementById('o_remark_new').value.trim(),
        items: items
      };
      try {
        var created = await API.orders.create(body);
        toast('下单成功，订单号：' + created.order_no, 'success');
        state.page = 1;
        load();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }, { width: '720px' });

    bindItemsEditor();

    var select = document.getElementById('o_customer');
    select.addEventListener('change', function () {
      var opt = select.options[select.selectedIndex];
      document.getElementById('o_customer_name').value = opt && opt.getAttribute('data-name') ? opt.getAttribute('data-name') : '';
    });
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
    document.getElementById('addBtn').addEventListener('click', openCreateOrder);

    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
