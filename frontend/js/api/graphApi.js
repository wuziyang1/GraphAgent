/**
 * graphApi.js —— 图谱业务接口层（页面只调用这里的函数，不直接碰 fetch / Mock）
 *
 * 每个函数内部自动分流：
 *   - Mock 模式（KG.config.USE_MOCK === true）→ 转发给 KG.mock.adapter
 *   - 真实模式                              → 走 KG.api.request 发起 REST 请求
 * 两条路径的 Promise 都 resolve 为 envelope 的 data 部分，页面无感知切换。
 *
 * 接口契约详见仓库根目录 docs/api.md；任何改动必须先改文档、再改代码。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  function callApi(method, path, params) {
    if (KG.config.USE_MOCK) {
      return KG.mock.adapter.handle(method, path, params || {});
    }
    return KG.api.request(path, { method: method, params: params });
  }

  /** 对象浅合并（避免引入更多依赖） */
  function merge(a, b) {
    var out = {};
    Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) { out[k] = b[k]; });
    return out;
  }

  var graphApi = {
    /** 连通性检查：GET /api/v1/health */
    health: function () {
      return callApi('GET', 'health');
    },

    /** 图谱全局统计：GET /api/v1/graph/stats */
    stats: function () {
      return callApi('GET', 'graph/stats');
    },

    /**
     * 图谱概览子图（首页初始视图）：GET /api/v1/graph/overview
     * @param {object} [params] { limit=50, entity_type }
     */
    overview: function (params) {
      return callApi('GET', 'graph/overview', params);
    },

    /**
     * 邻居展开（按需加载，支撑 3000+ 节点规模）：GET /api/v1/graph/expand
     * @param {string} entityId 中心实体 id
     * @param {object} [params] { depth=1, limit=50 }
     */
    expand: function (entityId, params) {
      return callApi('GET', 'graph/expand', merge({ entity_id: entityId }, params));
    },

    /** 实体详情：GET /api/v1/entities/{entityId} */
    getEntity: function (entityId) {
      return callApi('GET', 'entities/' + encodeURIComponent(entityId));
    },

    /**
     * 实体的关系列表（分页）：GET /api/v1/entities/{entityId}/relations
     * @param {object} [params] { direction='both', page=1, page_size=20 }
     */
    getEntityRelations: function (entityId, params) {
      return callApi('GET', 'entities/' + encodeURIComponent(entityId) + '/relations', params);
    },

    /**
     * 实体搜索（分页）：GET /api/v1/search
     * @param {object} params { keyword(必填), entity_type, page=1, page_size=20 }
     */
    search: function (params) {
      return callApi('GET', 'search', params);
    }
  };

  KG.api.graph = graphApi;
})(window);
