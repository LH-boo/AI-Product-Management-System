/* ============================================================
 * category.js —— 商品分类：两级树形表格 / 新增 / 编辑 / 删除
 * 说明：接口 tree=false 返回扁平列表（带 product_count），前端自行组装树形展示
 * ============================================================ */
(function () {
  'use strict';

  var all = [];
  var roots = [];
  var childrenMap = {};
  var expanded = {};
  var tbody = document.getElementById('tbody');

  function load() {
    tbody.innerHTML = tableLoadingHTML(6);
    API.categories.list(false).then(function (list) {
      all = list || [];
      document.getElementById('totalCount').textContent = all.length;
      buildTree();
      render();
    }).catch(function (e) {
      tbody.innerHTML = tableEmptyHTML(6, '加载失败：' + e.message);
      toast(e.message, 'error');
    });
  }

  function buildTree() {
    roots = all.filter(function (c) { return !c.parent_id; });
    childrenMap = {};
    all.forEach(function (c) {
      if (c.parent_id) {
        if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = [];
        childrenMap[c.parent_id].push(c);
      }
    });
    roots.forEach(function (r) {
      if (expanded[r.id] === undefined) expanded[r.id] = true; // 默认展开
    });
  }

  /** 一级分类显示自身 + 子分类商品总数 */
  function countOf(category) {
    var total = Number(category.product_count || 0);
    (childrenMap[category.id] || []).forEach(function (ch) { total += Number(ch.product_count || 0); });
    return total;
  }

  function statusTag(status) {
    return Number(status) === 1 ? tag('启用', 'success') : tag('停用', 'gray');
  }

  function render() {
    if (!roots.length) {
      tbody.innerHTML = tableEmptyHTML(6, '暂无分类，点击「新增一级分类」开始创建');
      return;
    }
    var html = '';
    roots.forEach(function (root) {
      var kids = childrenMap[root.id] || [];
      var toggle = kids.length
        ? '<span class="tree-toggle" data-toggle="' + root.id + '">' + (expanded[root.id] ? '▾' : '▸') + '</span>'
        : '<span class="tree-toggle placeholder"></span>';
      html += '<tr class="tree-row-parent">' +
        '<td><div class="tree-name">' + toggle + '<span class="fw-600">📁 ' + escapeHtml(root.name) + '</span></div></td>' +
        '<td>' + Number(root.sort || 0) + '</td>' +
        '<td>' + countOf(root) + '</td>' +
        '<td>' + statusTag(root.status) + '</td>' +
        '<td class="text-muted">' + escapeHtml(root.description || '-') + '</td>' +
        '<td class="actions">' +
        '<button class="btn-text" data-act="addChild" data-id="' + root.id + '" type="button">新增子分类</button>' +
        '<button class="btn-text" data-act="edit" data-id="' + root.id + '" type="button">编辑</button>' +
        '<button class="btn-text danger" data-act="del" data-id="' + root.id + '" type="button">删除</button>' +
        '</td></tr>';

      if (expanded[root.id] && kids.length) {
        kids.forEach(function (child) {
          html += '<tr>' +
            '<td><div class="tree-name"><span class="indent"></span><span class="text-muted">└</span>' +
            '<span>' + escapeHtml(child.name) + '</span></div></td>' +
            '<td>' + Number(child.sort || 0) + '</td>' +
            '<td>' + Number(child.product_count || 0) + '</td>' +
            '<td>' + statusTag(child.status) + '</td>' +
            '<td class="text-muted">' + escapeHtml(child.description || '-') + '</td>' +
            '<td class="actions">' +
            '<button class="btn-text" data-act="edit" data-id="' + child.id + '" type="button">编辑</button>' +
            '<button class="btn-text danger" data-act="del" data-id="' + child.id + '" type="button">删除</button>' +
            '</td></tr>';
        });
      }
    });
    tbody.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    tbody.querySelectorAll('.tree-toggle[data-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = Number(el.getAttribute('data-toggle'));
        expanded[id] = !expanded[id];
        render();
      });
    });

    tbody.querySelectorAll('button[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = Number(btn.getAttribute('data-id'));
        var act = btn.getAttribute('data-act');
        var category = all.filter(function (c) { return c.id === id; })[0];
        if (!category) return;
        if (act === 'addChild') openCategoryForm(null, category);
        else if (act === 'edit') openCategoryForm(category, null);
        else removeCategory(category);
      });
    });
  }

  /* ---------------- 新增 / 编辑 ---------------- */
  function parentOptions(selectedParentId, isEdit) {
    var html = '<option value="0">无（一级分类）</option>';
    roots.forEach(function (r) {
      // 编辑时不允许把自己作为父级
      if (isEdit) return;
      html += '<option value="' + r.id + '"' + (String(selectedParentId) === String(r.id) ? ' selected' : '') +
        '>' + escapeHtml(r.name) + '</option>';
    });
    return html;
  }

  function openCategoryForm(category, parentForNew) {
    var isEdit = !!category;
    var data = category || {};
    var presetParent = parentForNew ? parentForNew.id : 0;
    // 父级：编辑时保持原父级并且不可改（避免层级错乱）
    var parentSelectHtml = isEdit
      ? '<div class="form-static">' + (data.parent_id
        ? escapeHtml((all.filter(function (c) { return c.id === data.parent_id; })[0] || {}).name || '父级分类')
        : '无（一级分类）') + '</div>'
      : '<select class="form-control" id="c_parent">' + parentOptions(presetParent, false) + '</select>';

    var html = '' +
      '<div class="form-item"><label>分类名称 <span class="req">*</span></label>' +
      '<input class="form-control" id="c_name" maxlength="50" value="' + escapeHtml(data.name || '') + '"></div>' +
      '<div class="form-item"><label>上级分类</label>' + parentSelectHtml + '</div>' +
      '<div class="form-row">' +
      '<div class="form-item"><label>排序（越小越靠前）</label>' +
      '<input type="number" class="form-control" id="c_sort" value="' + Number(data.sort || 0) + '"></div>' +
      '<div class="form-item"><label>状态</label><select class="form-control" id="c_status">' +
      '<option value="1"' + (Number(data.status) !== 0 ? ' selected' : '') + '>启用</option>' +
      '<option value="0"' + (Number(data.status) === 0 ? ' selected' : '') + '>停用</option>' +
      '</select></div>' +
      '</div>' +
      '<div class="form-item"><label>描述</label>' +
      '<input class="form-control" id="c_desc" maxlength="255" value="' + escapeHtml(data.description || '') + '"></div>';

    openModal(isEdit ? '编辑分类' : '新增分类', html, async function () {
      var name = document.getElementById('c_name').value.trim();
      if (!name) { toast('请输入分类名称', 'warning'); return false; }

      var body = {
        name: name,
        sort: Number(document.getElementById('c_sort').value || 0),
        status: Number(document.getElementById('c_status').value),
        description: document.getElementById('c_desc').value.trim()
      };
      if (isEdit) body.parent_id = Number(data.parent_id || 0);
      else body.parent_id = Number(document.getElementById('c_parent').value || 0);

      try {
        if (isEdit) await API.categories.update(category.id, body);
        else await API.categories.create(body);
        toast(isEdit ? '修改成功' : '创建成功', 'success');
        load();
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }, { width: '500px' });
  }

  async function removeCategory(category) {
    var ok = await confirmDialog('确定删除分类「' + category.name + '」吗？若该分类下存在子分类或商品，将无法删除。');
    if (!ok) return;
    try {
      await API.categories.remove(category.id);
      toast('删除成功', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function init() {
    document.getElementById('addRootBtn').addEventListener('click', function () { openCategoryForm(null, null); });
    document.getElementById('refreshBtn').addEventListener('click', load);
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
