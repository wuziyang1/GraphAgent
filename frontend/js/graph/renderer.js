/**
 * renderer.js —— Cytoscape.js 渲染封装
 *
 * 页面不直接操作 cytoscape 实例，统一通过 GraphRenderer：
 *   var renderer = new KG.graph.GraphRenderer(document.getElementById('graph-container'));
 *   renderer.setData(graphPayload);      // graphPayload 为 /graph/overview 或 /graph/expand 的 data
 *   renderer.onNodeClick(function (data) { ... });
 *
 * 内建能力：拖拽节点、框选、滚轮缩放、画布平移（Cytoscape 默认交互）。
 *
 * 设计要点（面向 3000+ 节点规模）：
 *   - 单次渲染节点数受 KG.config.GRAPH_MAX_NODES 保护，超限自动截断并告警
 *   - 图谱浏览采用“概览 + 按需展开”：overview 先展示重要节点，
 *     用户交互时调用 /graph/expand 增量并入画布，而不是一次性拉全图
 *
 * TODO（后续迭代，见 README 开发顺序）：
 *   - 双击节点 → 调用 /graph/expand 增量并入画布（增量 merge）
 *   - 布局切换（cose / concentric / breadthfirst）
 *   - 超大规模时的采样与聚合展示策略
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  function assertCytoscape() {
    if (!global.cytoscape) {
      throw new Error('Cytoscape.js 未加载：请检查 vendor/cytoscape.min.js 或 CDN 是否可用');
    }
  }

  function GraphRenderer(container, options) {
    assertCytoscape();
    options = options || {};
    this.cy = global.cytoscape({
      container: container,
      elements: [],
      style: options.style || (KG.graph.styles && KG.graph.styles.default),
      layout: { name: 'grid' } // 初始为空图，setData 后切换为力学布局
    });
  }

  /** 整体替换图数据并重排布局 */
  GraphRenderer.prototype.setData = function (payload) {
    var cap = KG.config.GRAPH_MAX_NODES;
    var nodes = (payload && payload.nodes) || [];
    var edges = (payload && payload.edges) || [];

    if (nodes.length > cap) {
      console.warn('[GraphRenderer] 节点数 ' + nodes.length + ' 超过上限 ' + cap + '，已截断');
      var keep = {};
      nodes = nodes.slice(0, cap);
      nodes.forEach(function (n) { keep[n.id] = true; });
      edges = edges.filter(function (e) { return keep[e.source] && keep[e.target]; });
    }

    var elements = nodes.map(function (n) {
      return {
        group: 'nodes',
        data: { id: n.id, name: n.name, type: n.type, degree: n.degree || 0 }
      };
    }).concat(edges.map(function (e) {
      return {
        group: 'edges',
        data: { id: e.id, source: e.source, target: e.target, relation: e.relation, weight: e.weight }
      };
    }));

    this.cy.elements().remove();
    this.cy.add(elements);
    this.runLayout();
    var self = this;
    setTimeout(function () { self.fit(); }, 450); // 等布局动画结束后适配视口

    if (payload && payload.truncated) {
      console.info('[GraphRenderer] 当前为采样结果：全图共 ' + payload.total_nodes + ' 节点 / ' + payload.total_edges + ' 关系');
    }
    return this;
  };

  /** 重排布局（默认 cose 力导向；参数调松一些，减少节点与标签重叠） */
  GraphRenderer.prototype.runLayout = function (name) {
    this.cy.layout({
      name: name || 'cose',
      animate: true,
      animationDuration: 400,
      nodeRepulsion: 12000,
      idealEdgeLength: 90,
      edgeElasticity: 0.45,
      gravity: 80,
      numIter: 1500,
      padding: 30
    }).run();
    return this;
  };

  /* ---------- 交互事件（页面通过这些方法订阅，不直接碰 cy） ---------- */

  /** 单击节点：handler(nodeData) —— nodeData 为 { id, name, type, degree } */
  GraphRenderer.prototype.onNodeClick = function (handler) {
    this.cy.on('tap', 'node', function (e) {
      e.target.select();
      handler(e.target.data());
    });
    return this;
  };

  /** 单击关系：handler(edgeData) —— edgeData 为 { id, source, target, relation, weight } */
  GraphRenderer.prototype.onEdgeClick = function (handler) {
    this.cy.on('tap', 'edge', function (e) {
      e.target.select();
      handler(e.target.data());
    });
    return this;
  };

  /** 单击空白处：handler() —— 用于取消选中 */
  GraphRenderer.prototype.onBackgroundClick = function (handler) {
    var cy = this.cy;
    this.cy.on('tap', function (e) {
      if (e.target === cy) handler();
    });
    return this;
  };

  /* ---------- 视图操作 ---------- */

  /** 选中并高亮某节点（不存在则忽略）；不改变视口 */
  GraphRenderer.prototype.selectNode = function (id) {
    var node = this.cy.getElementById(id);
    if (node.nonempty()) {
      this.cy.elements().unselect();
      node.select();
      return true;
    }
    return false;
  };

  GraphRenderer.prototype.clearSelection = function () {
    this.cy.elements().unselect();
    return this;
  };

  GraphRenderer.prototype.zoomIn = function () {
    this.cy.zoom(this.cy.zoom() * 1.25);
    return this;
  };

  GraphRenderer.prototype.zoomOut = function () {
    this.cy.zoom(this.cy.zoom() / 1.25);
    return this;
  };

  /** 视口适配全部元素 */
  GraphRenderer.prototype.fit = function (padding) {
    this.cy.fit(undefined, padding == null ? 40 : padding);
    return this;
  };

  /** 取某节点的 data（不存在返回 null），供页面把 id 解析成名称 */
  GraphRenderer.prototype.getNodeData = function (id) {
    var node = this.cy.getElementById(id);
    return node.nonempty() ? node.data() : null;
  };

  /**
   * 类型筛选：type 为空字符串恢复全部；否则非该类型的节点及其关联边加 dim 类弱化。
   * 返回被弱化的元素数量（状态栏可显示）。
   */
  GraphRenderer.prototype.applyTypeDim = function (type) {
    var cy = this.cy;
    cy.elements().removeClass('dim');
    if (!type) return 0;
    var dimNodes = cy.nodes().filter(function (n) { return n.data('type') !== type; });
    var dimEdges = cy.edges().filter(function (e) {
      return dimNodes.contains(e.source()) || dimNodes.contains(e.target());
    });
    var all = dimNodes.union(dimEdges);
    all.addClass('dim');
    return all.length;
  };

  GraphRenderer.prototype.destroy = function () {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
  };

  KG.graph.GraphRenderer = GraphRenderer;
})(window);
