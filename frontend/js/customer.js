/* ============================================================
 * customer.js —— 客户管理：列表 / 搜索 / 新增编辑 / 删除 / 详情
 * ============================================================ */
(function () {
  'use strict';

  var state = { page: 1, page_size: 10, keyword: '', level: '' };
  var tbody = document.getElementById('tbody');
  var currentList = [];

  function levelTag(c) {
    var type = APP_ENUMS.CUSTOMER_LEVEL_TAG[c.level] || 'gray';
    return tag(c.level_text || APP_ENUMS.CUSTOMER_LEVEL[c.level] || c.level, type);
  }

  function renderTable(list) {
    if (!list || !list.length) {
      tbody.innerHTML = tableEmptyHTML(8, '暂无客户数据');
      return;
    }
    tbody.innerHTML = list.map(function (c) {
      return '<tr>' +
        '<td><div class="product-cell">' + avatarBlock(c.name) +
        '<div><div class="p-name">' + escapeHtml(c.name) + '</div>' +
        '<div class="p-sub">ID: ' + c.id + (Number(c.status) === 0 ? ' · 已流失' : '') + '</div></div></div></td>' +
        '<td>' + escapeHtml(c.phone || '-') + '</td>' +
        '<td>' + escapeHtml(c.email || '-') + '</td>' +
        '<td>' + levelTag(c) + '</td>' +
        '<td>' + formatNumber(c.total_orders) + '</td>' +
        '<td class="money">' + formatMoney(c.total_amount) + '</td>' +
        '<td class="text-light fs-12">' + formatDate(c.last_order_time) + '</td>' +
        '<td class="actions">' +
        '<button class="btn-text" data-act="detail" data-id="' + c.id + '" type="button">详情</button>' +
        '<button class="btn-text" data-act="edit" data-id="' + c.id + '" type="button">编辑</button>' +
        '<button class="btn-text danger" data-act="del" data-id="' + c.id + '" type="button">删除</button>' +
        '</td></tr>';
    }).join('');
    bindRowEvents();
  }

  function bindRowEvents() {
    tbody.querySelectorAll('button[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-id'));
        var customer = currentList.filter(function (c) { return c.id === id; })[0];
        if (!customer) return;
        var act = btn.getAttribute('data-act');
        if (act === 'detail') showDetail(customer);
        else if (act === 'edit') openCustomerForm(customer);
        else removeCustomer(customer);
      });
    });
  }

  async function load() {
    tbody.innerHTML = tableLoadingHTML(8);
    try {
      var data = await API.customers.list({
        keyword: state.keyword,
        level: state.level,
        page: state.page,
        page_size: state.page_size
      });
      currentList = data.list || [];
      renderTable(currentList);
      renderPagination('#pagination', data, function (p) { state.page = p; load(); });
    } catch (e) {
      tbody.innerHTML = tableEmptyHTML(8, '加载失败：' + e.message);
      toast(e.message, 'error');
    }
  }

  /* ---------------- 客户详情 ---------------- */
  async function showDetail(customer) {
    openModal('客户详情', '<div class="loading"><span class="spinner"></span>加载中...</div>', null,
      { hideCancel: true, confirmText: '关闭', width: '680px' });
    try {
      var d = await API.customers.get(customer.id);
      var orders = d.orders || [];
      var ordersHtml = orders.length
        ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>订单号</th><th>金额</th><th>状态</th><th>下单时间</th></tr></thead><tbody>' +
          orders.map(function (o) {
            return '<tr><td>' + escapeHtml(o.order_no) + '</td>' +
              '<td class="money">' + formatMoney(o.total_amount) + '</td>' +
              '<td>' + tag(o.status_text || o.status, APP_ENUMS.ORDER_STATUS_TAG[o.status] || 'gray') + '</td>' +
              '<td class="text-light fs-12">' + formatDate(o.created_at) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty"><div class="empty-text">暂无订单记录</div></div>';

      document.getElementById('modalBody').innerHTML = '' +
        '<div class="detail-grid">' +
        '<div class="detail-row"><span class="dt">姓名</span><span class="dd fw-600">' + escapeHtml(d.name) + '</span></div>' +
        '<div class="detail-row"><span class="dt">等级</span><span class="dd">' + levelTag(d) + '</span></div>' +
        '<div class="detail-row"><span class="dt">手机号</span><span class="dd">' + escapeHtml(d.phone || '-') + '</span></div>' +
        '<div class="detail-row"><span class="dt">邮箱</span><span class="dd">' + escapeHtml(d.email || '-') + '</span></div>' +
        '<div class="detail-row"><span class="dt">消费次数</span><span class="dd">' + formatNumber(d.total_orders) + '</span></div>' +
        '<div class="detail-row"><span class="dt">累计消费</span><span class="dd money big">' + formatMoney(d.total_amount) + '</span></div>' +
        '<div class="detail-row"><span class="dt">最近购买</span><span class="dd">' + formatDate(d.last_order_time) + '</span></div>' +
        '<div class="detail-row"><span class="dt">创建时间</span><span class="dd">' + formatDate(d.created_at) + '</span></div>' +
        '</div>' +
        '<div style="font-weight:600;margin:16px 0 8px;">最近订单（最多 10 条）</div>' + ordersHtml;
    } catch (e) {
      document.getElementById('modalBody').innerHTML = '<div class="empty"><div class="empty-text text-danger">' +
        escapeHtml(e.message) + '</div></div>';
    }
  }

  /* ---------------- 新增 / 编辑 ---------------- */
  function openCustomerForm(customer) {
    var isEdit = !!customer;
    var d = customer || {};
    var html = '' +
      '<div class="form-item"><label>客户姓名 <span class="req">*</span></label>' +
      '<input class="form-control" id="u_name" maxlength="50" value="' + escapeHtml(d.name || '') + '"></div>' +
      '<div class="form-row">' +
      '<div class="form-item"><label>手机号</label>' +
      '<input class="form-control" id="u_phone" maxlength="20" value="' + escapeHtml(d.phone || '') + '"></div>' +
      '<div class="form-item"><label>客户等级</label><select class="form-control" id="u_level">' +
      Object.keys(APP_ENUMS.CUSTOMER_LEVEL).map(function (k) {
        return '<option value="' + k + '"' + (d.level === k ? ' selected' : '') + '>' +
          APP_ENUMS.CUSTOMER_LEVEL[k] + '</option>';
      }).join('') + '</select></div>' +
      '</div>' +
      '<div class="form-item"><label>邮箱</label>' +
      '<input class="form-control" id="u_email" maxlength="100" value="' + escapeHtml(d.email || '') + '"></div>' +
      '<div class="form-item"><label>状态</label><select class="form-control" id="u_status">' +
      '<option value="1"' + (Number(d.status) !== 0 ? ' selected' : '') + '>正常</option>' +
      '<option value="0"' + (Number(d.status) === 0 ? ' selected' : '') + '>流失</option>' +
      '</select></div>';

    openModal(isEdit ? '编辑客户' : '新增客户', html, async function () {
      var name = document.getElementById('u_name').value.trim();
      if (!name) { toast('请输入客户姓名', 'warning'); return false; }
      var body = {
        name: name,
        phone: document.getElementById('u_phone').value.trim(),
        email: document.getElementById('u_email').value.trim(),
        level: document.getElementById('u_level').value,
        status: Number(document.getElementById('u_status').value)
      };
      try {
        if (isEdit) await API.customers.update(customer.id, body);
        else await API.customers.create(body);
        toast(isEdit ? '修改成功' : '创建成功', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }, { width: '520px' });
  }

  async function removeCustomer(customer) {
    var ok = await confirmDialog('确定删除客户「' + customer.name + '」吗？该操作不可恢复。');
    if (!ok) return;
    try {
      await API.customers.remove(customer.id);
      toast('删除成功', 'success');
      if (currentList.length === 1 && state.page > 1) state.page -= 1;
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('keyword').value.trim();
      state.level = document.getElementById('filterLevel').value;
      state.page = 1;
      load();
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      document.getElementById('keyword').value = '';
      document.getElementById('filterLevel').value = '';
      state = { page: 1, page_size: 10, keyword: '', level: '' };
      load();
    });
    document.getElementById('keyword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('searchBtn').click();
    });
    document.getElementById('addBtn').addEventListener('click', function () { openCustomerForm(null); });
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
