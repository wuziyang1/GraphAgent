/**
 * mockAdapter.js —— Mock 适配器：在本地模拟 docs/api.md 中的全部接口
 *
 * graphApi.js 在 API_MODE='mock'（默认）时把请求转发到这里。
 * 这里返回的 Promise 与真实后端行为一致：成功 resolve envelope.data，失败 reject ApiError。
 * 自带 ~150ms 延迟，让加载态表现与真实网络接近。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});
  var MOCK_LATENCY_MS = 150;

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ---------- 通用工具 ---------- */

  function indexById(entities) {
    var map = {};
    entities.forEach(function (e) { map[e.id] = e; });
    return map;
  }

  /** 全图度数表：entityId -> 关系数 */
  function degreeMap(relations) {
    var deg = {};
    relations.forEach(function (r) {
      deg[r.source_id] = (deg[r.source_id] || 0) + 1;
      deg[r.target_id] = (deg[r.target_id] || 0) + 1;
    });
    return deg;
  }

  /** 分页：返回 { slice, pagination }，pagination 结构与 docs/api.md 一致 */
  function paginate(items, params) {
    var pageSize = Math.min(Number(params.page_size) || 20, 100);
    var page = Math.max(1, Number(params.page) || 1);
    var total = items.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    return {
      slice: items.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page: page, page_size: pageSize, total: total, total_pages: totalPages }
    };
  }

  function throwNotFound(entityId) {
    throw new KG.api.ApiError(40401, '实体不存在', 404, { entity_id: entityId });
  }

  function throwInvalid(message) {
    throw new KG.api.ApiError(40001, message || '参数错误', 400, null);
  }

  /* ---------- 结构转换（与 docs/api.md 字段一一对应） ---------- */

  function toGraphNode(e, deg) {
    return { id: e.id, name: e.name, type: e.type, degree: deg[e.id] || 0 };
  }

  function toGraphEdge(r) {
    return { id: r.id, source: r.source_id, target: r.target_id, relation: r.relation, weight: r.confidence };
  }

  /** Relation 业务视图：source/target 内嵌摘要，前端无需二次查表 */
  function toRelationView(r, byId) {
    var s = byId[r.source_id];
    var t = byId[r.target_id];
    return {
      id: r.id,
      source: { id: r.source_id, name: s ? s.name : r.source_id, type: s ? s.type : 'unknown' },
      target: { id: r.target_id, name: t ? t.name : r.target_id, type: t ? t.type : 'unknown' },
      relation: r.relation,
      confidence: r.confidence
    };
  }

  /**
   * 组装 GraphPayload：
   *   - 节点集合 entityList（degree 用全图度数，保证与排序口径一致）
   *   - 边只保留两端都在集合内的关系
   */
  function buildGraphPayload(entityList, all, globalDeg) {
    var ids = {};
    entityList.forEach(function (e) { ids[e.id] = true; });
    var edges = all.relations.filter(function (r) { return ids[r.source_id] && ids[r.target_id]; });
    return {
      nodes: entityList.map(function (e) { return toGraphNode(e, globalDeg); }),
      edges: edges.map(toGraphEdge),
      total_nodes: all.entities.length,
      total_edges: all.relations.length,
      truncated: entityList.length < all.entities.length
    };
  }

  /* ---------- 各接口的 Mock 实现 ---------- */

  function handleHealth() {
    return { status: 'ok', time: new Date().toISOString(), version: 'v1-mock' };
  }

  function handleStats(all) {
    var typeDist = {};
    var relDist = {};
    all.entities.forEach(function (e) { typeDist[e.type] = (typeDist[e.type] || 0) + 1; });
    all.relations.forEach(function (r) { relDist[r.relation] = (relDist[r.relation] || 0) + 1; });
    return {
      entity_count: all.entities.length,
      relation_count: all.relations.length,
      entity_type_distribution: typeDist,
      relation_type_distribution: relDist,
      last_updated: '2026-09-01T00:00:00Z'
    };
  }

  function handleOverview(all, params) {
    var cap = Math.min(Number(params.limit) || 50, KG.config.GRAPH_MAX_NODES);
    var deg = degreeMap(all.relations);
    var sorted = all.entities.slice().sort(function (a, b) { return (deg[b.id] || 0) - (deg[a.id] || 0); });
    if (params.entity_type) sorted = sorted.filter(function (e) { return e.type === params.entity_type; });
    return buildGraphPayload(sorted.slice(0, cap), all, deg);
  }

  function handleExpand(all, params, byId) {
    if (!params.entity_id) throwInvalid('entity_id 不能为空');
    if (!byId[params.entity_id]) throwNotFound(params.entity_id);
    var depth = Math.min(Math.max(1, Number(params.depth) || 1), 2);
    var limit = Math.min(Number(params.limit) || 50, KG.config.GRAPH_MAX_NODES);

    // BFS 从中心实体向外收集 id，受 limit 约束
    var adjacency = {};
    all.relations.forEach(function (r) {
      (adjacency[r.source_id] = adjacency[r.source_id] || []).push(r.target_id);
      (adjacency[r.target_id] = adjacency[r.target_id] || []).push(r.source_id);
    });
    var visited = {};
    visited[params.entity_id] = true;
    var frontier = [params.entity_id];
    var count = 1;
    for (var d = 0; d < depth && count < limit; d++) {
      var next = [];
      for (var i = 0; i < frontier.length && count < limit; i++) {
        var neighbors = adjacency[frontier[i]] || [];
        for (var j = 0; j < neighbors.length && count < limit; j++) {
          if (!visited[neighbors[j]]) {
            visited[neighbors[j]] = true;
            next.push(neighbors[j]);
            count++;
          }
        }
      }
      frontier = next;
    }
    var picked = Object.keys(visited).map(function (id) { return byId[id]; }).filter(Boolean);
    return buildGraphPayload(picked, all, degreeMap(all.relations));
  }

  function handleEntity(all, entityId, byId) {
    var e = byId[entityId];
    if (!e) throwNotFound(entityId);
    var out = 0;
    var inn = 0;
    all.relations.forEach(function (r) {
      if (r.source_id === entityId) out++;
      if (r.target_id === entityId) inn++;
    });
    return {
      entity: e,
      stats: { out_relation_count: out, in_relation_count: inn, total: out + inn }
    };
  }

  function handleEntityRelations(all, entityId, params, byId) {
    if (!byId[entityId]) throwNotFound(entityId);
    var dir = params.direction || 'both'; // out | in | both
    var list = all.relations
      .filter(function (r) {
        if (dir === 'out') return r.source_id === entityId;
        if (dir === 'in') return r.target_id === entityId;
        return r.source_id === entityId || r.target_id === entityId;
      })
      .map(function (r) { return toRelationView(r, byId); });
    var p = paginate(list, params);
    return { pagination: p.pagination, items: p.slice };
  }

  function handleSearch(all, params) {
    var keyword = (params.keyword || '').trim();
    if (!keyword) throwInvalid('keyword 不能为空');
    var lower = keyword.toLowerCase();

    function matchField(e) {
      if (e.name.toLowerCase().indexOf(lower) !== -1) return 'name';
      if ((e.description || '').toLowerCase().indexOf(lower) !== -1) return 'description';
      for (var i = 0; i < (e.properties || []).length; i++) {
        if (String(e.properties[i].value).toLowerCase().indexOf(lower) !== -1) return 'properties';
      }
      return null;
    }

    var scored = [];
    all.entities.forEach(function (e) {
      if (params.entity_type && e.type !== params.entity_type) return;
      var field = matchField(e);
      if (!field) return;
      var nameLower = e.name.toLowerCase();
      var score = field === 'name'
        ? (nameLower === lower ? 1 : (nameLower.indexOf(lower) === 0 ? 0.9 : 0.8))
        : (field === 'description' ? 0.6 : 0.5);
      scored.push({
        entity: { id: e.id, name: e.name, type: e.type, description: e.description },
        matched_field: field,
        score: score
      });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var p = paginate(scored, params);
    return { pagination: p.pagination, items: p.slice };
  }

  /* ---------- 路由 ---------- */

  var routes = [
    { test: /^health$/,                        handler: function (all, byId, p) { return handleHealth(); } },
    { test: /^graph\/stats$/,                  handler: function (all, byId, p) { return handleStats(all); } },
    { test: /^graph\/overview$/,               handler: function (all, byId, p) { return handleOverview(all, p); } },
    { test: /^graph\/expand$/,                 handler: function (all, byId, p) { return handleExpand(all, p, byId); } },
    { test: /^entities\/([^\/]+)$/,            handler: function (all, byId, p, m) { return handleEntity(all, m[1], byId); } },
    { test: /^entities\/([^\/]+)\/relations$/, handler: function (all, byId, p, m) { return handleEntityRelations(all, m[1], p, byId); } },
    { test: /^search$/,                        handler: function (all, byId, p) { return handleSearch(all, p); } }
  ];

  async function handle(method, path, params) {
    await delay(MOCK_LATENCY_MS);
    var all = KG.mock.data.getAll();
    var byId = indexById(all.entities);
    for (var i = 0; i < routes.length; i++) {
      var m = String(path).match(routes[i].test);
      if (m) {
        try {
          return routes[i].handler(all, byId, params || {}, m);
        } catch (err) {
          if (err instanceof KG.api.ApiError) throw err;
          throw new KG.api.ApiError(50000, 'Mock 处理出错：' + (err && err.message), 500, null);
        }
      }
    }
    throw new KG.api.ApiError(40400, 'Mock 未实现该接口：' + path, 404, null);
  }

  KG.mock.adapter = { handle: handle };
})(window);
