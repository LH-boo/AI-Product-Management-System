/* ============================================================
 * dashboard.js —— 工作台：统计卡片 + 4 张图表 + AI 经营分析
 * ============================================================ */
(function () {
  'use strict';

  var charts = {};
  var latestTrendDays = 7;

  /* ---------------- 统计卡片 ---------------- */
  function renderStats(d) {
    var cards = [
      { icon: '📦', cls: 'blue', label: '商品总数', value: formatNumber(d.product_count) },
      { icon: '🧾', cls: 'cyan', label: '订单总数', value: formatNumber(d.order_count) },
      { icon: '💰', cls: 'green', label: '销售总额', value: formatMoney(d.sales_amount) },
      { icon: '🏬', cls: 'purple', label: '库存总量', value: formatNumber(d.stock_total) },
      { icon: '👥', cls: 'orange', label: '客户数量', value: formatNumber(d.customer_count) },
      { icon: '⏳', cls: 'orange', label: '待处理订单', value: formatNumber(d.pending_order_count) },
      { icon: '⚠️', cls: 'red', label: '库存预警数', value: formatNumber(d.low_stock_count) },
      { icon: '📅', cls: 'blue', label: '今日订单', value: formatNumber(d.today_order_count) }
    ];
    document.getElementById('statGrid').innerHTML = cards.map(function (c) {
      return '<div class="stat-card">' +
        '<div class="stat-icon ' + c.cls + '">' + c.icon + '</div>' +
        '<div class="stat-info"><div class="stat-value">' + c.value + '</div>' +
        '<div class="stat-label">' + c.label + '</div></div></div>';
    }).join('');
  }

  function loadStats() {
    return API.analytics.overview().then(renderStats).catch(function (e) {
      toast(e.message, 'error');
    });
  }

  /* ---------------- 图表工具 ---------------- */
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

  /* ---------------- 销售趋势 ---------------- */
  function renderTrend(list, days) {
    var chart = getChart('trendChart');
    if (!chart) return;
    if (!list || !list.length) { chart.setOption(noDataOption(), true); return; }
    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var p = params[0];
          return p.axisValue + '<br/>销售额：' + formatMoney(p.data);
        }
      },
      grid: { left: 8, right: 18, top: 24, bottom: 6, containLabel: true },
      xAxis: {
        type: 'category', boundaryGap: false, data: list.map(function (i) { return i.date; }),
        axisLine: { lineStyle: { color: '#e5e7eb' } }, axisLabel: { color: '#94a3b8' }
      },
      yAxis: {
        type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { color: '#94a3b8' }
      },
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
  }

  function loadTrend(days) {
    latestTrendDays = days || latestTrendDays;
    var sub = document.getElementById('trendSub');
    if (sub) sub.textContent = '近 ' + latestTrendDays + ' 天';
    return API.analytics.trend(latestTrendDays).then(function (list) {
      renderTrend(list, latestTrendDays);
    }).catch(function (e) { toast(e.message, 'error'); });
  }

  /* ---------------- 分类销售饼图 ---------------- */
  function renderCategory(list) {
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
        labelLine: { length: 8, length2: 8 },
        data: list.map(function (i) { return { name: i.name, value: i.amount }; })
      }]
    }, true);
  }

  /* ---------------- 热销商品排行 ---------------- */
  function renderTop(list) {
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
        type: 'bar', data: list.map(function (i) { return i.sales; }),
        barWidth: 14, itemStyle: { color: '#2f6bff', borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', color: '#64748b', fontSize: 11 }
      }]
    }, true);
  }

  /* ---------------- 库存分析 ---------------- */
  function renderInventory(list) {
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
  }

  function loadCharts() {
    API.analytics.category().then(renderCategory).catch(function (e) { toast(e.message, 'error'); });
    API.analytics.topProducts(5).then(renderTop).catch(function (e) { toast(e.message, 'error'); });
    API.analytics.inventory().then(renderInventory).catch(function (e) { toast(e.message, 'error'); });
    loadTrend(7);
  }

  /* ---------------- AI 经营分析 ---------------- */
  function initAiAnalysis() {
    var btn = document.getElementById('aiAnalysisBtn');
    var box = document.getElementById('aiAnalysisBody');
    if (!btn || !box) return;
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      btn.textContent = '分析中…';
      box.innerHTML = '<span class="spinner"></span>Agent 正在读取实时经营数据并生成分析…';
      try {
        var data = await API.agent.chat({ question: '帮我分析本月销售情况', session_id: 'dashboard' });
        box.innerHTML = renderMarkdown(data.answer || '（无分析结果）') +
          '<div class="ai-meta">耗时 ' + (data.elapsed_ms || 0) + ' ms · Agent：' +
          escapeHtml(data.agent || 'ProductAgent') + '</div>';
      } catch (e) {
        box.innerHTML = '<span class="text-danger">' + escapeHtml(e.message) + '</span>';
      } finally {
        btn.disabled = false;
        btn.textContent = '生成分析';
      }
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    loadStats();
    loadCharts();
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
