/**
 * styles.js —— Cytoscape.js 视觉样式（纯配置，统一调整图谱观感只需改这里）
 *
 * 颜色按实体类型（node.type）区分；未识别的类型走 node 的默认色，不会报错
 * （项目要求支持 100+ 数据类别，type 是开放字符串，前端必须容忍未知类型）。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  /** 实体类型 → 颜色（后端新增类型时在此追加一行即可） */
  var TYPE_COLORS = {
    person: '#3b82f6',        // 人物：蓝
    organization: '#10b981',  // 机构：绿
    location: '#f59e0b',      // 地点：橙
    concept: '#8b5cf6',       // 概念：紫
    event: '#14b8a6',         // 事件：青
    work: '#ec4899'           // 作品/文献：粉
  };

  /** 实体类型 → 中文名（筛选下拉、图例、详情徽标共用；未知类型原样显示英文） */
  var TYPE_NAMES = {
    person: '人物',
    organization: '机构',
    location: '地点',
    concept: '概念',
    event: '事件',
    work: '作品'
  };

  var defaultStyle = [
    {
      selector: 'node',
      style: {
        'background-color': '#64748b',                 // 未知类型的兜底色
        'width': 'mapData(degree, 0, 20, 26, 64)',     // 度数越大节点越大
        'height': 'mapData(degree, 0, 20, 26, 64)',
        'label': 'data(name)',
        'font-size': 12,
        'color': '#334155',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 6,
        'text-background-color': '#fbfcfe',   // 与画布同色衬底，标签压线时仍可读
        'text-background-opacity': 1,
        'text-background-padding': 2,
        'text-background-shape': 'roundrectangle',
        'border-width': 2,
        'border-color': '#ffffff'
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 'mapData(weight, 0, 1, 1.5, 3)',      // 置信度越高边越粗
        'line-color': '#b6c2d1',
        'target-arrow-color': '#b6c2d1',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(relation)',
        'font-size': 10,
        'color': '#7d8b9d',
        'text-background-color': '#f8fafc',
        'text-background-opacity': 1,
        'text-background-padding': 2
      }
    },
    {
      selector: 'node:selected',
      style: { 'border-color': '#2563eb', 'border-width': 3 }
    },
    {
      selector: 'edge:selected',
      style: { 'line-color': '#2563eb', 'target-arrow-color': '#2563eb', 'color': '#2563eb' }
    },
    {
      // 类型筛选时弱化不匹配的元素
      selector: '.dim',
      style: { 'opacity': 0.12 }
    }
  ];

  // 为每个已知类型追加着色规则
  Object.keys(TYPE_COLORS).forEach(function (type) {
    defaultStyle.push({
      selector: 'node[type = "' + type + '"]',
      style: { 'background-color': TYPE_COLORS[type] }
    });
  });

  KG.graph = KG.graph || {};
  KG.graph.styles = { default: defaultStyle, TYPE_COLORS: TYPE_COLORS, TYPE_NAMES: TYPE_NAMES };
})(window);
