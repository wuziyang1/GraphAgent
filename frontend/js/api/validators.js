/**
 * validators.js —— 接口响应契约校验（docs/api.md 在前端侧的防线）
 *
 * 背景：真实后端返回的数据未必总符合契约（字段缺失 / 类型不对 / 悬空边…）。
 * graphApi 在把 data 交给 UI 之前统一过这里，页面渲染代码因此永远拿到
 * “形状正确”的数据，不会因为后端数据问题直接 JS 崩溃：
 *
 *   - 顶层结构不符（缺 items / nodes 数组、entity 不是对象等）
 *       → 抛 ApiError（message 以「后端数据不符合接口契约」开头，可直接展示），
 *         UI 走各自的“加载失败”分支显示友好提示
 *   - 个别条目有问题（某条搜索结果缺 name、某条边端点悬空等）
 *       → 只丢弃该条并 console.warn，不整页失败
 *   - 可选数值缺失 → 补契约默认值（degree 0 / weight 0.5 / truncated false …）
 *
 * Mock 数据同样过校验：契约回归在开发期就能暴露，而不是等到联调才发现。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  /* ---------- 小工具 ---------- */

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isArr(v) { return Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isStr(v) { return typeof v === 'string'; }
  function warn(msg) { console.warn('[validators] ' + msg); }

  /** 顶层契约失败：转为带友好信息的 ApiError（沿用 client 的 code=-1 表示前端侧异常） */
  function fail(reason) {
    throw new KG.api.ApiError(-1, '后端数据不符合接口契约：' + reason + '（对照 docs/api.md 检查字段名与类型）');
  }

  /** EntitySummary 校验：必须有字符串 id / name；type 开放，缺失给 'unknown' */
  function summary(v, what) {
    if (!isObj(v) || !isStr(v.id) || !isStr(v.name)) {
      warn(what + ' 缺 id/name，已丢弃该条');
      return null;
    }
    return { id: v.id, name: v.name, type: isStr(v.type) ? v.type : 'unknown' };
  }

  /* ---------- 各接口（schema key 与 graphApi 调用一一对应） ---------- */

  var schemas = {

    /** GET /health */
    health: function (d, path) {
      if (!isObj(d)) fail(path + ' 的 data 应为对象');
      if (!isStr(d.status)) fail('health.status 应为 string');
      return {
        status: d.status,
        time: isStr(d.time) ? d.time : '',
        version: isStr(d.version) ? d.version : ''
      };
    },

    /** GET /graph/stats */
    stats: function (d, path) {
      if (!isObj(d)) fail(path + ' 的 data 应为对象');
      if (!isNum(d.entity_count) || !isNum(d.relation_count)) {
        fail('stats.entity_count / relation_count 应为 number');
      }
      if (!isObj(d.entity_type_distribution)) {
        warn('stats.entity_type_distribution 缺失或非对象，按空处理（筛选下拉与图例将为空）');
      }
      var dist = {};
      var raw = isObj(d.entity_type_distribution) ? d.entity_type_distribution : {};
      Object.keys(raw).forEach(function (k) {
        var v = Number(raw[k]);
        if (isFinite(v) && v >= 0) dist[k] = v;
        else warn('entity_type_distribution 中 “' + k + '” 的数量不是数字，已忽略');
      });
      return {
        entity_count: d.entity_count,
        relation_count: d.relation_count,
        entity_type_distribution: dist,
        relation_type_distribution: isObj(d.relation_type_distribution) ? d.relation_type_distribution : {},
        last_updated: isStr(d.last_updated) ? d.last_updated : ''
      };
    },

    /** GET /graph/overview 与 /graph/expand：GraphPayload */
    graph: function (d, path) {
      if (!isObj(d)) fail(path + ' 的 data 应为 GraphPayload 对象');
      if (!isArr(d.nodes)) fail('GraphPayload.nodes 应为数组');
      if (!isArr(d.edges)) warn('GraphPayload.edges 缺失或非数组，按空边处理');

      var nodes = [];
      var ids = {};
      d.nodes.forEach(function (n, i) {
        if (!isObj(n) || !isStr(n.id) || !isStr(n.name)) {
          warn('nodes 第 ' + i + ' 项缺字符串 id/name，已丢弃');
          return;
        }
        if (ids[n.id]) { warn('节点 id 重复：' + n.id + '，仅保留第一个'); return; }
        ids[n.id] = true;
        nodes.push({
          id: n.id,
          name: n.name,
          type: isStr(n.type) ? n.type : 'unknown',
          degree: isNum(n.degree) && n.degree >= 0 ? n.degree : 0
        });
      });

      // 契约 2.8：边两端必须都在 nodes 内（不允许悬空边），这里主动替后端兜底
      var edges = [];
      (isArr(d.edges) ? d.edges : []).forEach(function (e, i) {
        if (!isObj(e) || !isStr(e.id) || !isStr(e.source) || !isStr(e.target) || !isStr(e.relation)) {
          warn('edges 第 ' + i + ' 项缺 id/source/target/relation，已丢弃');
          return;
        }
        if (!ids[e.source] || !ids[e.target]) {
          warn('边 ' + e.id + ' 的端点不在返回的节点中（悬空边），已丢弃');
          return;
        }
        edges.push({
          id: e.id,
          source: e.source,
          target: e.target,
          relation: e.relation,
          weight: isNum(e.weight) ? e.weight : 0.5
        });
      });

      if (!isNum(d.total_nodes) || !isNum(d.total_edges)) {
        warn('total_nodes / total_edges 缺失或非数字，按本次返回数量计');
      }
      return {
        nodes: nodes,
        edges: edges,
        total_nodes: isNum(d.total_nodes) ? d.total_nodes : nodes.length,
        total_edges: isNum(d.total_edges) ? d.total_edges : edges.length,
        truncated: d.truncated === true
      };
    },

    /** GET /entities/{entityId} */
    entity: function (d, path) {
      if (!isObj(d)) fail(path + ' 的 data 应为 { entity, stats } 对象');
      var e = d.entity;
      if (!isObj(e) || !isStr(e.id) || !isStr(e.name)) fail('entity 详情缺少字符串 id / name');

      var props = [];
      (isArr(e.properties) ? e.properties : []).forEach(function (p, i) {
        if (!isObj(p) || !isStr(p.key)) { warn('properties 第 ' + i + ' 项缺 key，已丢弃'); return; }
        props.push({ key: p.key, value: p.value == null ? '' : String(p.value) });
      });
      if (!isArr(e.properties)) warn('entity.properties 缺失或非数组，按空属性处理');

      return {
        entity: {
          id: e.id,
          name: e.name,
          type: isStr(e.type) ? e.type : 'unknown',
          description: isStr(e.description) ? e.description : '',
          properties: props
        },
        stats: isObj(d.stats) ? d.stats : null
      };
    },

    /** GET /entities/{entityId}/relations */
    relations: function (d, path) {
      return paged(d, path, function (r, i) {
        if (!isObj(r) || !isStr(r.id) || !isStr(r.relation)) {
          warn('关系列表第 ' + i + ' 项缺 id/relation，已丢弃');
          return null;
        }
        var s = summary(r.source, '关系 ' + r.id + ' 的 source');
        var t = summary(r.target, '关系 ' + r.id + ' 的 target');
        if (!s || !t) return null;
        return {
          id: r.id,
          source: s,
          target: t,
          relation: r.relation,
          confidence: isNum(r.confidence) ? r.confidence : null
        };
      });
    },

    /** GET /search */
    search: function (d, path) {
      return paged(d, path, function (it, i) {
        if (!isObj(it) || !isObj(it.entity) || !isStr(it.entity.id) || !isStr(it.entity.name)) {
          warn('搜索结果第 ' + i + ' 项的 entity 缺 id/name，已丢弃');
          return null;
        }
        var e = it.entity;
        return {
          entity: {
            id: e.id,
            name: e.name,
            type: isStr(e.type) ? e.type : 'unknown',
            description: isStr(e.description) ? e.description : ''
          },
          matched_field: isStr(it.matched_field) ? it.matched_field : '',
          score: isNum(it.score) ? it.score : 0
        };
      });
    }
  };

  /** 分页列表通用骨架：items 必须是数组；pagination 缺失时按本次条数补齐 */
  function paged(d, path, itemFn) {
    if (!isObj(d)) fail(path + ' 的 data 应为 { pagination, items } 对象');
    if (!isArr(d.items)) fail(path + ' 的 items 应为数组');

    var items = [];
    d.items.forEach(function (raw, i) {
      var it = itemFn(raw, i);
      if (it) items.push(it);
    });

    var p = isObj(d.pagination) ? d.pagination : null;
    if (!p) warn(path + ' 缺 pagination，按本次返回条数补齐（总数可能不准）');
    return {
      pagination: {
        page: p && isNum(p.page) ? p.page : 1,
        page_size: p && isNum(p.page_size) ? p.page_size : items.length,
        total: p && isNum(p.total) ? p.total : items.length,
        total_pages: p && isNum(p.total_pages) ? p.total_pages : 1
      },
      items: items
    };
  }

  /**
   * 统一入口：按 schemaKey 校验并规整 data；未登记的 key 原样放行。
   * @param {string} key  schemas 里的键（graphApi 各方法传入）
   * @param {*} data       接口 resolve 出的 data
   * @param {string} path  接口路径（报错信息定位用）
   * @returns 规整后的 data；契约不符时抛 ApiError
   */
  function check(key, data, path) {
    var fn = schemas[key];
    if (!fn) return data;
    return fn(data, path || key);
  }

  KG.api.validators = { check: check };
})(window);
