/* ============================================================
 * product.js —— 商品管理：搜索 / 分页 / 新增编辑 / 上下架 / 删除
 * ============================================================ */
(function () {
  'use strict';

  var state = { page: 1, page_size: 10, keyword: '', category_id: '', status: '' };
  var categoryList = [];
  var currentList = [];

  var tbody = document.getElementById('tbody');

  /* ---------------- 分类下拉 ---------------- */
  function categoryOptions(selected, withEmpty) {
    var html = withEmpty ? '<option value="0">未分类</option>' : '';
    categoryList.forEach(function (c) {
      var prefix = c.parent_id ? '　└ ' : '';
      var sel = String(selected) === String(c.id) ? ' selected' : '';
      html += '<option value="' + c.id + '"' + sel + '>' + prefix + escapeHtml(c.name) + '</option>';
    });
    return html;
  }

  function loadCategories() {
    return API.categories.list(false).then(function (list) {
      categoryList = list || [];
      var filter = document.getElementById('filterCategory');
      filter.innerHTML = '<option value="">全部分类</option>' +
        categoryList.map(function (c) {
          return '<option value="' + c.id + '">' + (c.parent_id ? '　└ ' : '') + escapeHtml(c.name) + '</option>';
        }).join('');
      filter.value = state.category_id;
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  /* ---------------- 列表 ---------------- */
  function renderTable(list) {
    if (!list || !list.length) {
      tbody.innerHTML = tableEmptyHTML(9, '暂无商品数据，点击「新增商品」创建第一条');
      return;
    }
    tbody.innerHTML = list.map(function (p) {
      var sub = p.description ? escapeHtml(String(p.description).slice(0, 18)) : ('ID: ' + p.id);
      var stockHtml = Number(p.stock) <= 0
        ? '<span class="text-danger fw-600">' + formatNumber(p.stock) + '</span>'
        : formatNumber(p.stock);
      return '<tr>' +
        '<td><div class="product-cell">' + avatarBlock(p.name) +
        '<div><div class="p-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="p-sub">' + sub + '</div></div></div></td>' +
        '<td>' + escapeHtml(p.sku || '-') + '</td>' +
        '<td>' + (p.category ? escapeHtml(p.category) : '<span class="text-light">未分类</span>') + '</td>' +
        '<td>' + escapeHtml(p.brand || '-') + '</td>' +
        '<td class="money">' + formatMoney(p.price) + '</td>' +
        '<td>' + stockHtml + '</td>' +
        '<td>' + formatNumber(p.sales) + '</td>' +
        '<td><label class="switch" title="点击上下架"><input type="checkbox" data-id="' + p.id + '"' +
        (Number(p.status) === 1 ? ' checked' : '') + '><span class="slider"></span></label></td>' +
        '<td class="actions">' +
        '<button class="btn-text" data-act="edit" data-id="' + p.id + '" type="button">编辑</button>' +
        '<button class="btn-text danger" data-act="del" data-id="' + p.id + '" type="button">删除</button>' +
        '</td></tr>';
    }).join('');
    bindRowEvents();
  }

  function bindRowEvents() {
    tbody.querySelectorAll('.switch input[data-id]').forEach(function (cb) {
      cb.addEventListener('change', async function () {
        var id = Number(cb.getAttribute('data-id'));
        var newStatus = cb.checked ? 1 : 0;
        cb.disabled = true;
        try {
          await API.products.setStatus(id, newStatus);
          toast(newStatus === 1 ? '商品已上架' : '商品已下架', 'success');
        } catch (e) {
          toast(e.message, 'error');
          cb.checked = !cb.checked; // 回滚
        } finally {
          cb.disabled = false;
        }
      });
    });

    tbody.querySelectorAll('button[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-id'));
        var product = currentList.filter(function (p) { return p.id === id; })[0];
        if (!product) return;
        if (btn.getAttribute('data-act') === 'edit') openProductForm(product);
        else removeProduct(product);
      });
    });
  }

  async function load() {
    tbody.innerHTML = tableLoadingHTML(9);
    try {
      var data = await API.products.list({
        keyword: state.keyword,
        category_id: state.category_id,
        status: state.status,
        page: state.page,
        page_size: state.page_size
      });
      currentList = data.list || [];
      renderTable(currentList);
      renderPagination('#pagination', data, function (p) { state.page = p; load(); });
    } catch (e) {
      tbody.innerHTML = tableEmptyHTML(9, '加载失败：' + e.message);
      toast(e.message, 'error');
    }
  }

  /* ---------------- 新增 / 编辑 ---------------- */
  function formHtml(p) {
    var isEdit = !!p;
    p = p || {};
    return '' +
      '<div class="form-item"><label>商品名称 <span class="req">*</span></label>' +
      '<input class="form-control" id="f_name" maxlength="120" value="' + escapeHtml(p.name || '') + '"></div>' +
      '<div class="form-row">' +
      '<div class="form-item"><label>SKU 编码</label><input class="form-control" id="f_sku" value="' + escapeHtml(p.sku || '') + '"></div>' +
      '<div class="form-item"><label>品牌</label><input class="form-control" id="f_brand" value="' + escapeHtml(p.brand || '') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-item"><label>商品分类</label><select class="form-control" id="f_category">' +
      categoryOptions(p.category_id, true) + '</select></div>' +
      '<div class="form-item"><label>状态</label><select class="form-control" id="f_status">' +
      '<option value="1"' + (Number(p.status) !== 0 ? ' selected' : '') + '>上架</option>' +
      '<option value="0"' + (Number(p.status) === 0 && isEdit ? ' selected' : '') + '>下架</option>' +
      '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-item"><label>售价 (¥)</label><input type="number" min="0" step="0.01" class="form-control" id="f_price" value="' + (p.price || 0) + '"></div>' +
      '<div class="form-item"><label>成本价 (¥)</label><input type="number" min="0" step="0.01" class="form-control" id="f_cost" value="' + (p.cost || 0) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-item"><label>库存数量</label><input type="number" min="0" class="form-control" id="f_stock" value="' + (p.stock || 0) + '"></div>' +
      '<div class="form-item"><label>安全库存</label><input type="number" min="0" class="form-control" id="f_safe" placeholder="' +
      (isEdit ? '留空则不修改' : '默认 20') + '" value="' + (isEdit ? '' : 20) + '"></div>' +
      '</div>' +
      '<div class="form-item"><label>商品描述</label><textarea class="form-control" id="f_desc">' +
      escapeHtml(p.description || '') + '</textarea></div>' +
      '<div class="form-hint">提示：编辑时「安全库存」留空表示不修改该值。</div>';
  }

  function openProductForm(product) {
    var isEdit = !!product;
    openModal(isEdit ? '编辑商品' : '新增商品', formHtml(product), async function () {
      var name = document.getElementById('f_name').value.trim();
      if (!name) { toast('请输入商品名称', 'warning'); return false; }

      var body = {
        name: name,
        sku: document.getElementById('f_sku').value.trim(),
        category_id: Number(document.getElementById('f_category').value || 0),
        brand: document.getElementById('f_brand').value.trim(),
        price: Number(document.getElementById('f_price').value || 0),
        cost: Number(document.getElementById('f_cost').value || 0),
        status: Number(document.getElementById('f_status').value),
        stock: Number(document.getElementById('f_stock').value || 0),
        description: document.getElementById('f_desc').value.trim()
      };
      var safe = document.getElementById('f_safe').value;
      if (safe !== '' && safe !== null) body.safe_stock = Number(safe);

      try {
        if (isEdit) await API.products.update(product.id, body);
        else await API.products.create(body);
        toast(isEdit ? '修改成功' : '创建成功', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
        return false; // 保持弹窗打开
      }
    }, { width: '580px' });
  }

  async function removeProduct(product) {
    var ok = await confirmDialog('确定删除商品「' + product.name + '」吗？删除后其库存记录会一并删除。');
    if (!ok) return;
    try {
      await API.products.remove(product.id);
      toast('删除成功', 'success');
      if (currentList.length === 1 && state.page > 1) state.page -= 1;
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    var kw = getQuery('keyword');
    if (kw) { state.keyword = kw; document.getElementById('keyword').value = kw; }

    document.getElementById('searchBtn').addEventListener('click', function () {
      state.keyword = document.getElementById('keyword').value.trim();
      state.category_id = document.getElementById('filterCategory').value;
      state.status = document.getElementById('filterStatus').value;
      state.page = 1;
      load();
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
      document.getElementById('keyword').value = '';
      document.getElementById('filterCategory').value = '';
      document.getElementById('filterStatus').value = '';
      state = { page: 1, page_size: 10, keyword: '', category_id: '', status: '' };
      load();
    });

    document.getElementById('keyword').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('searchBtn').click();
    });

    document.getElementById('addBtn').addEventListener('click', function () { openProductForm(null); });

    loadCategories().then(load).catch(load);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
