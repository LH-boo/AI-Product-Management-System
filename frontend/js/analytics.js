/* ============================================================
 * analytics.js —— 数据分析：4 张图表 + 时间范围切换 + AI 经营分析
 * ============================================================ */
(function () {
  'use strict';

  var charts = {};
  var currentDays = 7;

  function getChart(id) {
    if (typeof echarts === 'undefined') return null;
    var el = document.getElementById(id);
    if (!el) return null;
    if (!charts[id]) charts[id] = echarts.init(el);
    return charts[id];
  }

  function noDataOption(text) {
    return {
      title: {
        text: text || '暂无数据', left: 'center', top: 'middle',
        textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 'normal' }
      }
    };
  }

  /* ---------------- 统计卡片 ---------------- */
  function renderStats(d) {
    var cards = [
      { icon: '📦', cls: 'blue', label: '商品总数', value: formatNumber(d.product_count) },
      { icon: '🗂️', cls: 'purple', label: '分类数量', value: formatNumber(d.category_count) },
      { icon: '🧾', cls: 'cyan', label: '订单总数', value: formatNumber(d.order_count) },
      { icon: '💰', cls: 'green', label: '销售总额', value: formatMoney(d.sales_amount) },
      { icon: '🏬', cls: 'blue', label: '库存总量', value: formatNumber(d.stock_total) },
      { icon: '👥', cls: 'orange', label: '客户数量', value: formatNumber(d.customer_count) },
      { icon: '⏳', cls: 'orange', label: '待处理订单', value: formatNumber(d.pending_order_count) },
      { icon: '⚠️', cls: 'red', label: '库存预警数', value: formatNumber(d.low_stock_count) }
    ];
    document.getElementById('statGrid').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><div class="stat-icon ' + c.cls + '">' + c.icon + '</div>' +
        '<div class="stat-info"><div class="stat-value">' + c.value + '</div>' +
        '<div class="stat-label">' + c.label + '</div></div></div>';
    }).join('');
  }

  /* ---------------- 销售趋势 ---------------- */
  function loadTrend(days) {
    currentDays = days;
    document.querySelectorAll('.range-btn').forEach(function (b) {
      b.classList.toggle('active', Number(b.getAttribute('data-days')) === days);
    });
    API.analytics.trend(days).then(function (list) {
      var chart = getChart('trendChart');
      if (!chart) return;
      if (!list || !list.length) { chart.setOption(noDataOption(), true); return; }
      chart.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: function (params) {
            var p = params[0];
            var item = list[p.dataIndex] || {};
            return p.axisValue + '<br/>销售额：' + formatMoney(p.data) + '<br/>订单数：' + (item.count || 0);
          }
        },
        grid: { left: 8, right: 18, top: 24, bottom: 6, containLabel: true },
        xAxis: {
          type: 'category', boundaryGap: false, data: list.map(function (i) { return i.date; }),
          axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#94a3b8' }
        },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8' } },
        series: [{
          name: '销售额', type: 'line', smooth: true, symbolSize: 6,
          data: list.map(function (i) { return i.amount; }),
          itemStyle: { color: '#2f6bff' }, lineStyle: { width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(47,107,255,.28)' },
              { offset: 1, color: 'rgba(47,107,255,.02)' }
            ])
          }
        }]
      }, true);
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function loadCategory() {
    API.analytics.category().then(function (list) {
      var chart = getChart('categoryChart');
      if (!chart) return;
      if (!list || !list.length) { chart.setOption(noDataOption(), true); return; }
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}<br/>金额：¥{c}（{d}%）' },
        legend: { bottom: 0, type: 'scroll', textStyle: { color: '#64748b', fontSize: 12 } },
        series: [{
          type: 'pie', radius: ['42%', '66%'], center: ['50%', '44%'], avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}\n{d}%', fontSize: 11, color: '#64748b' },
          data: list.map(function (i) { return { name: i.name, value: i.amount }; })
        }]
      }, true);
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function loadTop() {
    API.analytics.topProducts(5).then(function (list) {
      var chart = getChart('topChart');
      if (!chart) return;
      if (!list || !list.length) { chart.setOption(noDataOption(), true); return; }
      chart.setOption({
        tooltip: {
          trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: function (params) {
            var p = params[0];
            var item = list[p.dataIndex] || {};
            return p.name + '<br/>销量：' + (item.sales || 0) + '<br/>销售额：' + formatMoney(item.amount);
          }
        },
        grid: { left: 8, right: 34, top: 16, bottom: 6, containLabel: true },
        xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8' } },
        yAxis: {
          type: 'category', inverse: true, data: list.map(function (i) { return i.name; }),
          axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#64748b' }
        },
        series: [{
          type: 'bar', barWidth: 14, data: list.map(function (i) { return i.sales; }),
          itemStyle: { color: '#2f6bff', borderRadius: [0, 6, 6, 0] },
          label: { show: true, position: 'right', color: '#64748b', fontSize: 11 }
        }]
      }, true);
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  function loadInventory() {
    API.analytics.inventory().then(function (list) {
      var chart = getChart('inventoryChart');
      if (!chart) return;
      if (!list || !list.length) { chart.setOption(noDataOption(), true); return; }
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: { color: '#64748b' } },
        grid: { left: 8, right: 16, top: 34, bottom: 6, containLabel: true },
        xAxis: {
          type: 'category', data: list.map(function (i) { return i.name; }),
          axisLabel: { color: '#94a3b8', interval: 0, rotate: 26, fontSize: 11 },
          axisLine: { lineStyle: { color: '#e5e7eb' } }
        },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8' } },
        series: [
          {
            name: '当前库存', type: 'bar', barMaxWidth: 20,
            data: list.map(function (i) { return i.current_stock; }),
            itemStyle: { color: '#2f6bff', borderRadius: [4, 4, 0, 0] }
          },
          {
            name: '安全库存', type: 'bar', barMaxWidth: 20,
            data: list.map(function (i) { return i.safe_stock; }),
            itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] }
          }
        ]
      }, true);
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  /* ---------------- AI 经营分析 ---------------- */
  function initAiAnalysis() {
    var btn = document.getElementById('aiAnalysisBtn');
    var box = document.getElementById('aiAnalysisBody');
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      btn.textContent = '分析中…';
      box.innerHTML = '<span class="spinner"></span>Agent 正在读取实时经营数据并生成分析结论…';
      try {
        var data = await API.agent.chat({
          question: '帮我分析近 ' + currentDays + ' 天的销售情况，并给出补货和运营建议',
          session_id: 'analytics'
        });
        box.innerHTML = renderMarkdown(data.answer || '（无分析结果）') +
          '<div class="ai-meta">耗时 ' + (data.elapsed_ms || 0) + ' ms</div>';
      } catch (e) {
        box.innerHTML = '<span class="text-danger">' + escapeHtml(e.message) + '</span>';
      } finally {
        btn.disabled = false;
        btn.textContent = '生成分析结论';
      }
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    document.querySelectorAll('.range-btn').forEach(function (b) {
      b.addEventListener('click', function () { loadTrend(Number(b.getAttribute('data-days'))); });
    });

    API.analytics.overview().then(renderStats).catch(function (e) { toast(e.message, 'error'); });
    loadTrend(7);
    loadCategory();
    loadTop();
    loadInventory();
    initAiAnalysis();

    window.addEventListener('resize', function () {
      Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].resize(); });
    });

    if (typeof echarts === 'undefined') {
      document.querySelectorAll('.chart-box').forEach(function (el) {
        el.innerHTML = '<div class="empty"><div class="empty-icon">📉</div>' +
          '<div class="empty-text">ECharts 未加载（请检查网络 / CDN）</div></div>';
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
