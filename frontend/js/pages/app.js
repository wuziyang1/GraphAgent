/**
 * app.js —— 图谱主页入口与模块协调（KG.page）
 *
 * 模块分层（首页各司其职，入口脚本只做装配与协调）：
 *   js/api/graphApi.js    统一 API 请求层，页面不直接发请求
 *   js/entity/entity.js   实体搜索（四态）+ 搜索结果 + 实体/关系详情渲染（KG.entity）
 *   js/graph/renderer.js  图谱画布渲染与交互（GraphRenderer）
 *   js/graph/tooltip.js   节点/关系悬浮信息卡（KG.graph.tooltip）
 *   本文件               DOM 装配、事件接线、顶部统计、概览加载、定位/展开、重置
 *
 * 页面五区（见 index.html）：
 *   顶部：标题 / 说明 / 全图统计（stats 接口）
 *   左侧：实体搜索 + 类型筛选 + 结果列表 + 类型图例（search 接口，渲染在 KG.entity）
 *   中间：Cytoscape 图谱画布（overview 概览采样；缩放 / 拖拽 / 单击 / 双击展开 / hover）
 *   右侧：实体详情 / 关系详情（渲染在 KG.entity）
 *   底部：API 状态 / 数据来源 / 当前画布加载量
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  /* ---------- 入口脚本持有的 DOM（模块区域由各模块自行缓存） ---------- */

  var dom = {};
  var IDS = [
    'stat-entities', 'stat-relations', 'stat-types',
    'graph-wrap', 'graph-container', 'graph-mask', 'graph-mask-text', 'graph-tooltip',
    'zoom-in-btn', 'zoom-out-btn', 'fit-btn', 'reset-btn',
    'api-dot', 'api-status-text', 'source-text',
    'loaded-nodes', 'loaded-edges', 'graph-scope'
  ];

  /* ---------- 状态 ---------- */

  var renderer = null;
  var currentTypeFilter = ''; // 类型筛选当前值（KG.entity 变更时经 onFilterChange 同步）

  /* ================================================================
   * 初始化
   * ================================================================ */

  document.addEventListener('DOMContentLoaded', function () {
    IDS.forEach(function (id) { dom[id] = KG.utils.$('#' + id); });

    initGraph();
    initEntity();
    bindToolbar();
    KG.page._renderer = renderer; // 调试出口（initGraph 之后实例才存在）
    checkApi();
    loadStats();
    loadOverview();
  });

  /** 画布装配：悬浮卡 + 渲染器 + 各类交互事件接线 */
  function initGraph() {
    try {
      KG.graph.tooltip.init(dom['graph-tooltip'], dom['graph-wrap'], function (id) {
        return renderer ? renderer.getNodeData(id) : null;
      });
      renderer = new KG.graph.GraphRenderer(dom['graph-container']);
      renderer.onNodeClick(function (n) { selectEntity(n.id, { focus: false }); });
      renderer.onEdgeClick(function (e) { KG.entity.showRelationDetail(e); });
      renderer.onBackgroundClick(function () { renderer.clearSelection(); });
      renderer.onNodeDblClick(function (n) { expandEntity(n.id); });
      renderer.onNodeHover(KG.graph.tooltip.showNode, KG.graph.tooltip.hide);
      renderer.onEdgeHover(KG.graph.tooltip.showEdge, KG.graph.tooltip.hide);
      renderer.onInteract(KG.graph.tooltip.hide); // 缩放/平移/拖拽/点击时收起悬浮卡
    } catch (err) {
      console.error('[app] 图谱初始化失败：', err);
      dom['graph-mask-text'].textContent = '图谱初始化失败：' + err.message;
    }
  }

  /** 实体模块装配：类型筛选联动画布；实体跳转联动定位高亮 */
  function initEntity() {
    KG.entity.init({
      onFilterChange: function (type) {
        currentTypeFilter = type;
        if (renderer) renderer.applyTypeDim(type);
      },
      onActivate: function (id) { selectEntity(id, { focus: true }); },
      getNodeData: function (id) { return renderer ? renderer.getNodeData(id) : null; }
    });
  }

  function bindToolbar() {
    dom['zoom-in-btn'].addEventListener('click', function () { renderer && renderer.zoomIn(); });
    dom['zoom-out-btn'].addEventListener('click', function () { renderer && renderer.zoomOut(); });
    dom['fit-btn'].addEventListener('click', function () { renderer && renderer.fit(); });
    dom['reset-btn'].addEventListener('click', resetGraph);
  }

  /* ================================================================
   * 实体选中协调（entity 模块详情 + graph 模块定位高亮）
   * ================================================================ */

  /**
   * 选中实体：右侧详情交给 KG.entity，画布高亮交给 renderer。
   * opts.focus = true 时自动定位（搜索结果 / 关联实体点击场景）：
   * 节点不在画布上则先调 expand 并入再居中——概览采样下低度数实体的兜底路径。
   */
  function selectEntity(entityId, opts) {
    if (!entityId) return Promise.resolve();
    opts = opts || {};
    KG.entity.markActive(entityId);
    if (opts.focus) {
      locateEntity(entityId);
    } else if (renderer) {
      renderer.selectNode(entityId);
    }
    return KG.entity.showDetail(entityId);
  }

  /** 自动定位：已在画布则居中高亮；否则按需展开并入后居中 */
  function locateEntity(entityId) {
    if (!renderer) return;
    if (renderer.focusNode(entityId)) return;

    dom['graph-scope'].textContent = '正在定位实体…';
    KG.api.graph.expand(entityId, { depth: 1, limit: 30 })
      .then(function (payload) {
        var added = renderer.mergeData(payload, entityId);
        renderer.applyTypeDim(currentTypeFilter); // 新并入的元素同样遵循类型筛选
        renderer.focusNode(entityId);
        updateLoadStatus(added.addedNodes
          ? '已定位实体，并入 ' + added.addedNodes + ' 个相邻实体 / ' + added.addedEdges + ' 条关系'
          : '已定位实体');
      })
      .catch(function (err) {
        console.error('[app] 定位失败：', err);
        dom['graph-scope'].textContent = '定位失败：' + err.message;
      });
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

      KG.entity.renderTypeOptions(stats.entity_type_distribution);
      KG.entity.renderLegend(stats.entity_type_distribution);
    } catch (err) {
      console.error('[app] 获取统计失败：', err);
      dom['stat-entities'].textContent = dom['stat-relations'].textContent = dom['stat-types'].textContent = '获取失败';
    }
  }

  /* ================================================================
   * 中间：图谱加载（概览采样 + 按需展开）
   * ================================================================ */

  /** 概览采样：先加载高度数核心节点（几十个），其余通过双击节点/搜索定位按需展开 */
  async function loadOverview() {
    try {
      var payload = await KG.api.graph.overview({ limit: 40 });
      if (!renderer) return;
      renderer.setData(payload);
      renderer.applyTypeDim(currentTypeFilter); // 恢复可能已存在的类型筛选

      updateLoadStatus(payload.truncated
        ? '全图 ' + KG.utils.formatNumber(payload.total_nodes) + ' 实体 / ' +
          KG.utils.formatNumber(payload.total_edges) + ' 关系（已采样展示，双击节点可展开）'
        : '已全量展示');
      dom['graph-mask'].hidden = true;
    } catch (err) {
      console.error('[app] 图谱加载失败：', err);
      dom['graph-mask-text'].textContent = '图谱加载失败：' + err.message;
    }
  }

  /** 底部“当前加载”计数统一从这里更新（overview / expand / 定位后都调用） */
  function updateLoadStatus(scopeText) {
    dom['loaded-nodes'].textContent = KG.utils.formatNumber(renderer ? renderer.nodeCount() : 0);
    dom['loaded-edges'].textContent = KG.utils.formatNumber(renderer ? renderer.edgeCount() : 0);
    if (scopeText) dom['graph-scope'].textContent = scopeText;
  }

  /**
   * 双击节点：按需展开相邻子图（/graph/expand → mergeData 增量并入画布）。
   * 这是面向 3000+ 数据规模的加载策略：概览只给核心节点，其余走到哪展开到哪。
   */
  async function expandEntity(entityId) {
    if (!renderer || !entityId) return;
    dom['graph-scope'].textContent = '正在展开相邻节点…';
    try {
      var payload = await KG.api.graph.expand(entityId, { depth: 1, limit: 30 });
      var added = renderer.mergeData(payload, entityId);
      renderer.applyTypeDim(currentTypeFilter);
      updateLoadStatus(added.addedNodes
        ? '已展开 ' + added.addedNodes + ' 个相邻实体 / ' + added.addedEdges + ' 条关系'
        : '该节点的相邻实体已全部在画布中');
    } catch (err) {
      console.error('[app] 展开失败：', err);
      dom['graph-scope'].textContent = '展开失败：' + err.message;
    }
  }

  /** 重置图谱：清空筛选/选中/详情，重新加载概览 */
  function resetGraph() {
    KG.graph.tooltip.hide();
    KG.entity.reset();
    currentTypeFilter = '';
    if (renderer) {
      renderer.clearSelection();
      renderer.applyTypeDim('');
    }
    loadOverview();
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
   *   KG.page.selectEntity('ent_00001', { focus: true })   // 定位高亮 + 详情
   *   KG.page.doSearch()                                   // 读取输入框当前关键词
   *   KG.page.expandEntity('ent_00007')                    // 双击节点的按需展开
   *   KG.page.resetGraph()                                 // 工具栏“重置”
   *   KG.page.showRelationDetail({ id:'rel_00001', source:'ent_00001', target:'ent_00009', relation:'出生于', weight:0.98 })
   *   KG.page._renderer                                    // 画布实例（调试专用）
   */
  KG.page = {
    selectEntity: selectEntity,
    doSearch: function () { return KG.entity.search(); },
    expandEntity: expandEntity,
    resetGraph: resetGraph,
    showRelationDetail: function (edgeData) { KG.entity.showRelationDetail(edgeData); },
    _renderer: null // DOMContentLoaded 后指向画布实例（调试/自测专用）
  };
})(window);
