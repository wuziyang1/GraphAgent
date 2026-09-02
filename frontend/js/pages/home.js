/**
 * home.js —— 图谱主页入口
 *
 * 页面五区（见 index.html）：
 *   顶部：标题 / 说明 / 全图统计（stats 接口）
 *   左侧：实体搜索 + 类型筛选 + 结果列表 + 类型图例（search 接口）
 *   中间：Cytoscape 图谱画布（overview 接口；拖拽 / 缩放 / 点选）
 *   右侧：实体详情 + 相关实体与关系（entities/{id} + relations 接口）；
 *         单击关系边时切换为关系详情卡片
 *   底部：API 状态 / 数据来源 / 当前加载节点数与关系数
 *
 * 全部走 KG.api.graph（Mock 模式下自动使用本地数据，字段与 docs/api.md 一致）。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  /* ---------- DOM 引用 ---------- */
  var dom = {};

  function cacheDom() {
    ['stat-entities', 'stat-relations', 'stat-types',
     'search-input', 'search-btn', 'type-filter', 'clear-filter-btn',
     'search-results', 'result-count', 'legend',
     'graph-container', 'graph-mask', 'graph-mask-text',
     'zoom-in-btn', 'zoom-out-btn', 'fit-btn',
     'entity-detail', 'entity-name', 'entity-type-badge', 'entity-id', 'entity-desc',
     'entity-props-body', 'entity-prop-count', 'entity-rel-list', 'entity-rel-count',
     'relation-detail', 'rel-source', 'rel-name', 'rel-target', 'rel-id', 'rel-type', 'rel-confidence',
     'detail-empty', 'api-dot', 'api-status-text', 'source-text',
     'loaded-nodes', 'loaded-edges', 'graph-scope'
    ].forEach(function (id) { dom[id] = KG.utils.$('#' + id); });
  }

  /* ---------- 状态 ---------- */
  var renderer = null;
  var currentEntityId = null; // 当前右侧展示的实体 id

  /* ---------- 小工具 ---------- */

  var COLORS = KG.graph.styles.TYPE_COLORS;
  var NAMES = KG.graph.styles.TYPE_NAMES;

  function typeLabel(type) { return NAMES[type] || type || '未知'; }

  function typeBadgeHtml(type) {
    var color = COLORS[type] || '#64748b';
    return '<span class="type-badge" style="background:' + color + '">' +
           KG.utils.escapeHtml(typeLabel(type)) + '</span>';
  }

  /** 就地更新详情卡上的类型徽标（textContent + 配色，不替换 DOM 节点） */
  function setBadge(el, type) {
    el.textContent = type ? typeLabel(type) : '—';
    el.style.background = type ? (COLORS[type] || '#64748b') : '#64748b';
  }

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  /* ================================================================
   * 初始化
   * ================================================================ */

  document.addEventListener('DOMContentLoaded', function () {
    cacheDom();
    bindEvents();
    initGraph();
    checkApi();
    loadStats();
    loadOverview();
  });

  function bindEvents() {
    dom['search-btn'].addEventListener('click', doSearch);
    dom['search-input'].addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });
    dom['search-input'].addEventListener('input',
      KG.utils.debounce(function () {
        if (dom['search-input'].value.trim() === '') clearResults();
      }, 250));

    dom['type-filter'].addEventListener('change', function () {
      applyTypeFilter(dom['type-filter'].value);
      // 已有关键词时，切换类型立即刷新搜索结果
      if (dom['search-input'].value.trim() !== '') doSearch();
    });
    dom['clear-filter-btn'].addEventListener('click', clearFilter);

    dom['zoom-in-btn'].addEventListener('click', function () { renderer && renderer.zoomIn(); });
    dom['zoom-out-btn'].addEventListener('click', function () { renderer && renderer.zoomOut(); });
    dom['fit-btn'].addEventListener('click', function () { renderer && renderer.fit(); });

    // 关系详情卡片里的实体名可点击跳转
    dom['rel-source'].addEventListener('click', function () { selectEntity(dom['rel-source'].dataset.id); });
    dom['rel-target'].addEventListener('click', function () { selectEntity(dom['rel-target'].dataset.id); });
  }

  function initGraph() {
    try {
      renderer = new KG.graph.GraphRenderer(dom['graph-container']);
      renderer.onNodeClick(function (nodeData) { selectEntity(nodeData.id); });
      renderer.onEdgeClick(function (edgeData) { showRelationDetail(edgeData); });
      renderer.onBackgroundClick(function () { renderer.clearSelection(); });
    } catch (err) {
      console.error('[home] 图谱初始化失败：', err);
      dom['graph-mask-text'].textContent = '图谱初始化失败：' + err.message;
    }
  }

  /* ================================================================
   * 顶部：全图统计
   * ================================================================ */

  async function loadStats() {
    try {
      var stats = await KG.api.graph.stats();
      dom['stat-entities'].textContent = KG.utils.formatNumber(stats.entity_count);
      dom['stat-relations'].textContent = KG.utils.formatNumber(stats.relation_count);
      dom['stat-types'].textContent = KG.utils.formatNumber(Object.keys(stats.entity_type_distribution).length);

      initTypeFilter(stats.entity_type_distribution);
      renderLegend(stats.entity_type_distribution);
    } catch (err) {
      console.error('[home] 获取统计失败：', err);
      dom['stat-entities'].textContent = dom['stat-relations'].textContent = dom['stat-types'].textContent = '获取失败';
    }
  }

  /** 类型筛选下拉：按数量降序 */
  function initTypeFilter(distribution) {
    var select = dom['type-filter'];
    var kept = select.value;
    select.innerHTML = '<option value="">全部类型</option>';
    Object.keys(distribution)
      .sort(function (a, b) { return distribution[b] - distribution[a]; })
      .forEach(function (type) {
        var opt = document.createElement('option');
        opt.value = type;
        opt.textContent = typeLabel(type) + '（' + distribution[type] + '）';
        select.appendChild(opt);
      });
    select.value = kept;
  }

  function renderLegend(distribution) {
    dom['legend'].innerHTML = Object.keys(distribution)
      .sort(function (a, b) { return distribution[b] - distribution[a]; })
      .map(function (type) {
        var color = COLORS[type] || '#64748b';
        return '<li><span class="swatch" style="background:' + color + '"></span>' +
               KG.utils.escapeHtml(typeLabel(type)) + ' ' + distribution[type] + '</li>';
      }).join('');
  }

  /* ================================================================
   * 中间：图谱加载
   * ================================================================ */

  async function loadOverview() {
    try {
      var payload = await KG.api.graph.overview({ limit: 200 });
      if (!renderer) return;
      renderer.setData(payload);
      renderer.applyTypeDim(dom['type-filter'].value); // 恢复可能已存在的类型筛选

      dom['loaded-nodes'].textContent = KG.utils.formatNumber(payload.nodes.length);
      dom['loaded-edges'].textContent = KG.utils.formatNumber(payload.edges.length);
      dom['graph-scope'].textContent = payload.truncated
        ? '全图 ' + KG.utils.formatNumber(payload.total_nodes) + ' 实体 / ' +
          KG.utils.formatNumber(payload.total_edges) + ' 关系（已采样展示）'
        : '已全量展示';
      hide(dom['graph-mask']);
    } catch (err) {
      console.error('[home] 图谱加载失败：', err);
      dom['graph-mask-text'].textContent = '图谱加载失败：' + err.message;
    }
  }

  /* ================================================================
   * 左侧：搜索与筛选
   * ================================================================ */

  async function doSearch() {
    var keyword = dom['search-input'].value.trim();
    if (!keyword) {
      clearResults();
      return;
    }
    var params = { keyword: keyword, page_size: 20 };
    var type = dom['type-filter'].value;
    if (type) params.entity_type = type;

    dom['search-results'].innerHTML = '<li class="result-empty">搜索中…</li>';
    try {
      var result = await KG.api.graph.search(params);
      renderResults(result);
    } catch (err) {
      dom['search-results'].innerHTML =
        '<li class="result-empty">搜索失败：' + KG.utils.escapeHtml(err.message) + '</li>';
    }
  }

  function renderResults(result) {
    var list = dom['search-results'];
    dom['result-count'].textContent = '共 ' + result.pagination.total + ' 条';

    if (!result.items.length) {
      list.innerHTML = '<li class="result-empty">未找到匹配的实体</li>';
      return;
    }
    list.innerHTML = result.items.map(function (item) {
      var e = item.entity;
      return '<li class="result-item" data-id="' + KG.utils.escapeHtml(e.id) + '">' +
               '<div class="result-item-top">' +
                 '<span class="result-name" title="' + KG.utils.escapeHtml(e.name) + '">' +
                   KG.utils.escapeHtml(e.name) + '</span>' + typeBadgeHtml(e.type) +
               '</div>' +
               (e.description
                 ? '<div class="result-desc">' + KG.utils.escapeHtml(e.description) + '</div>'
                 : '') +
             '</li>';
    }).join('');

    KG.utils.$$('.result-item', list).forEach(function (li) {
      li.addEventListener('click', function () { selectEntity(li.dataset.id); });
    });
  }

  function clearResults() {
    dom['search-results'].innerHTML =
      '<li class="result-empty" id="result-placeholder">输入关键词并点击「搜索」</li>';
    dom['result-count'].textContent = '';
  }

  /** 类型筛选：作用画布（弱化其它类型）+ 搜索结果（作为 entity_type 参数） */
  function applyTypeFilter(type) {
    if (renderer) renderer.applyTypeDim(type);
  }

  function clearFilter() {
    dom['type-filter'].value = '';
    dom['search-input'].value = '';
    applyTypeFilter('');
    clearResults();
  }

  /* ================================================================
   * 右侧：实体详情 / 关系详情
   * ================================================================ */

  /** 选中实体：加载数据并渲染右侧卡片；同时在画布上高亮对应节点 */
  async function selectEntity(entityId) {
    if (!entityId) return;
    currentEntityId = entityId;

    // 画布高亮（节点可能不在当前子图中，此时只更新面板）
    if (renderer) renderer.selectNode(entityId);
    markActiveResult(entityId);

    // 先展示骨架，避免网络延迟期间右侧空白
    hide(dom['relation-detail']);
    hide(dom['detail-empty']);
    show(dom['entity-detail']);
    dom['entity-name'].textContent = '加载中…';
    setBadge(dom['entity-type-badge'], null);
    dom['entity-id'].textContent = entityId;
    dom['entity-desc'].textContent = '';
    dom['entity-props-body'].innerHTML = '';
    dom['entity-rel-list'].innerHTML = '<li class="result-empty">加载中…</li>';

    try {
      var detail = await KG.api.graph.getEntity(entityId);
      if (currentEntityId !== entityId) return; // 期间用户又点了别的实体
      renderEntityDetail(detail.entity);
    } catch (err) {
      dom['entity-name'].textContent = '加载失败';
      dom['entity-desc'].textContent = err.message;
    }

    try {
      var rels = await KG.api.graph.getEntityRelations(entityId, { direction: 'both', page_size: 50 });
      if (currentEntityId !== entityId) return;
      renderEntityRelations(entityId, rels.items);
    } catch (err) {
      dom['entity-rel-list'].innerHTML =
        '<li class="result-empty">关系加载失败：' + KG.utils.escapeHtml(err.message) + '</li>';
    }
  }

  function renderEntityDetail(entity) {
    dom['entity-name'].textContent = entity.name;
    setBadge(dom['entity-type-badge'], entity.type);
    dom['entity-id'].textContent = entity.id;
    dom['entity-desc'].textContent = entity.description || '（暂无描述）';

    var props = entity.properties || [];
    dom['entity-prop-count'].textContent = props.length;
    dom['entity-props-body'].innerHTML = props.length
      ? props.map(function (p) {
          return '<tr><th>' + KG.utils.escapeHtml(p.key) + '</th><td>' +
                 KG.utils.escapeHtml(p.value) + '</td></tr>';
        }).join('')
      : '<tr><td>（暂无属性）</td></tr>';
  }

  /** 相关实体列表：每行 = 方向 + 关系类型 + 对端实体（可点击跳转） */
  function renderEntityRelations(entityId, items) {
    dom['entity-rel-count'].textContent = items.length;
    if (!items.length) {
      dom['entity-rel-list'].innerHTML = '<li class="result-empty">（暂无相关关系）</li>';
      return;
    }
    dom['entity-rel-list'].innerHTML = items.map(function (r) {
      var outgoing = r.source.id === entityId;
      var other = outgoing ? r.target : r.source;
      return '<li class="rel-item" data-id="' + KG.utils.escapeHtml(other.id) + '">' +
               '<span class="rel-dir" title="' + (outgoing ? '该实体发出的关系' : '指向该实体的关系') + '">' +
                 (outgoing ? '→' : '←') + '</span>' +
               '<span class="rel-label">' + KG.utils.escapeHtml(r.relation) + '</span>' +
               '<span class="rel-other" title="' + KG.utils.escapeHtml(other.name) + '">' +
                 KG.utils.escapeHtml(other.name) + '</span>' +
               '<span class="rel-other-type">' + KG.utils.escapeHtml(typeLabel(other.type)) + '</span>' +
             '</li>';
    }).join('');

    KG.utils.$$('.rel-item', dom['entity-rel-list']).forEach(function (li) {
      li.addEventListener('click', function () { selectEntity(li.dataset.id); });
    });
  }

  /** 单击关系边：右侧切换为关系详情卡片（source —relation→ target） */
  function showRelationDetail(edgeData) {
    hide(dom['entity-detail']);
    hide(dom['detail-empty']);
    show(dom['relation-detail']);

    var source = renderer ? renderer.getNodeData(edgeData.source) : null;
    var target = renderer ? renderer.getNodeData(edgeData.target) : null;

    fillRelNode(dom['rel-source'], source, edgeData.source);
    fillRelNode(dom['rel-target'], target, edgeData.target);
    dom['rel-name'].textContent = edgeData.relation;
    dom['rel-id'].textContent = edgeData.id;
    dom['rel-type'].textContent = edgeData.relation;
    dom['rel-confidence'].textContent =
      edgeData.weight == null ? '—' : (Math.round(edgeData.weight * 100) + '%');
  }

  function fillRelNode(el, nodeData, fallbackId) {
    el.textContent = nodeData ? nodeData.name : fallbackId;
    el.dataset.id = nodeData ? nodeData.id : fallbackId;
    el.title = nodeData ? (typeLabel(nodeData.type) + ' · ' + nodeData.id) : fallbackId;
  }

  /** 搜索结果列表中高亮当前选中项 */
  function markActiveResult(entityId) {
    KG.utils.$$('.result-item').forEach(function (li) {
      li.classList.toggle('active', li.dataset.id === entityId);
    });
  }

  /* ================================================================
   * 底部：系统状态
   * ================================================================ */

  async function checkApi() {
    dom['source-text'].textContent = KG.config.USE_MOCK
      ? 'Mock 数据（后端未接入）'
      : '真实后端（' + (KG.config.API_BASE_URL || '同源') + '）';
    try {
      await KG.api.graph.health();
      dom['api-dot'].className = 'dot ok';
      dom['api-status-text'].textContent = '正常（/api/v1/health）';
    } catch (err) {
      dom['api-dot'].className = 'dot err';
      dom['api-status-text'].textContent = err.message;
    }
  }

  /**
   * 控制台调试出口（答辩演示 / 自测时可在 Console 中直接调用）：
   *   KG.page.selectEntity('ent_00001')
   *   KG.page.doSearch()
   *   KG.page.showRelationDetail({ id:'rel_00001', source:'ent_00001', target:'ent_00009', relation:'出生于', weight:0.98 })
   */
  KG.page = {
    selectEntity: selectEntity,
    doSearch: doSearch,
    showRelationDetail: showRelationDetail
  };
})(window);
