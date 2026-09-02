/**
 * tooltip.js —— 图谱悬浮信息卡（KG.graph.tooltip）
 *
 * 节点 / 关系 hover 时在鼠标附近显示简要信息：
 *   - 单个 DOM 节点复用（#graph-tooltip），不随 hover 频繁创建销毁
 *   - pointer-events: none（见 base.css），不拦截画布鼠标事件
 *
 * 由 app.js 挂到 renderer 的 onNodeHover / onEdgeHover / onInteract 上，
 * 画布缩放、平移、点击时由 onInteract 统一收起，避免位置失真。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  var NAMES = KG.graph.styles.TYPE_NAMES;
  var tip = null;          // #graph-tooltip（单个复用）
  var wrap = null;         // .graph-wrap，边界翻转计算用
  var getNodeData = null;  // 画布节点数据读取器（边悬浮显示端点名称用）

  /**
   * @param {HTMLElement} tipEl   #graph-tooltip
   * @param {HTMLElement} wrapEl  .graph-wrap
   * @param {Function} nodeDataAccessor  (id) => 节点 data | null
   */
  function init(tipEl, wrapEl, nodeDataAccessor) {
    tip = tipEl;
    wrap = wrapEl;
    getNodeData = nodeDataAccessor;
  }

  function hide() {
    if (tip && !tip.hidden) tip.hidden = true;
  }

  /** 悬浮卡定位在鼠标右下方，超出画布时向左/上翻转 */
  function place(e) {
    var x = e.renderedPosition.x + 16;
    var y = e.renderedPosition.y + 18;
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > wrap.clientWidth - 8) x = Math.max(8, x - w - 32);
    if (y + h > wrap.clientHeight - 8) y = Math.max(8, y - h - 36);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  /** 节点悬浮：handler(nodeData, event) 形态，与 renderer.onNodeHover 对齐 */
  function showNode(data, e) {
    tip.innerHTML =
      '<div class="tt-title">' + KG.utils.escapeHtml(data.name) + '</div>' +
      '<div class="tt-meta">' + KG.utils.escapeHtml(NAMES[data.type] || data.type || '未知') +
      ' · 关联 ' + (data.degree || 0) + ' 条关系</div>' +
      '<div class="tt-hint">单击查看详情 · 双击展开相邻节点</div>';
    place(e);
  }

  /** 关系悬浮：端点名称优先取画布节点数据，取不到时回退显示 id */
  function showEdge(data, e) {
    var s = getNodeData ? getNodeData(data.source) : null;
    var t = getNodeData ? getNodeData(data.target) : null;
    tip.innerHTML =
      '<div class="tt-title">' +
        KG.utils.escapeHtml((s ? s.name : data.source) + ' → ' + (t ? t.name : data.target)) +
      '</div>' +
      '<div class="tt-meta">关系：' + KG.utils.escapeHtml(data.relation) +
      ' · 置信度 ' + (data.weight == null ? '—' : Math.round(data.weight * 100) + '%') + '</div>' +
      '<div class="tt-hint">单击查看关系详情</div>';
    place(e);
  }

  KG.graph.tooltip = { init: init, hide: hide, showNode: showNode, showEdge: showEdge };
})(window);
