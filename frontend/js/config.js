/**
 * config.js —— 全局配置入口（全项目唯一允许出现后端地址的地方）
 *
 * 【重要约定】任何其它文件都不允许出现 http://localhost:xxxx 之类的硬编码地址。
 *
 * API_BASE_URL 解析优先级（高 → 低）：
 *   1. URL 查询参数    ?api=<地址>&mock=0      临时演示用，不改代码、刷新即生效
 *   2. localStorage    KG_API_BASE_URL / KG_USE_MOCK    浏览器持久覆盖，便于联调
 *   3. config.local.js window.KG_LOCAL_CONFIG           本机私有文件（已 gitignore）
 *   4. 本文件 defaults                                        兜底默认值
 *
 * 默认 API_BASE_URL = ''（空字符串）表示“同源相对路径”：
 *   前端与后端部署在同一域名/端口（或同一反向代理之后）时，无需任何配置即可工作。
 */
(function (global) {
  'use strict';

  var defaults = {
    // 后端服务地址：'' = 同源；联调时可覆盖为 'http://127.0.0.1:8000' 等
    API_BASE_URL: '',
    // 是否使用本地 Mock 数据（后端未就绪时前端可独立运行）
    USE_MOCK: true,
    // REST 接口版本前缀，与仓库根目录 docs/api.md 保持一致
    API_PREFIX: '/api/v1',
    // 请求超时（毫秒）
    REQUEST_TIMEOUT_MS: 10000,
    // 图谱单次渲染节点规模保护（与后端约定的 limit 上限保持一致）
    GRAPH_MAX_NODES: 500,
    // Mock 压测开关：设为 3000 可模拟 3000+ 节点的大规模图（仅 Mock 模式生效）
    MOCK_SCALE_NODES: 0
  };

  var merged = {};
  Object.keys(defaults).forEach(function (k) { merged[k] = defaults[k]; });

  // 优先级 3：config.local.js（本机私有文件，不入库）
  var local = global.KG_LOCAL_CONFIG;
  if (local && typeof local === 'object') {
    Object.keys(local).forEach(function (k) {
      if (k in defaults && local[k] != null) merged[k] = local[k];
    });
  }

  // 优先级 2：localStorage 持久覆盖
  try {
    var lsBase = global.localStorage.getItem('KG_API_BASE_URL');
    var lsMock = global.localStorage.getItem('KG_USE_MOCK');
    if (lsBase) merged.API_BASE_URL = lsBase;
    if (lsMock !== null) merged.USE_MOCK = (lsMock === '1' || lsMock === 'true');
  } catch (e) { /* 浏览器禁用 localStorage 时忽略 */ }

  // 优先级 1：URL 查询参数（最高，方便演示时临时切换）
  try {
    var q = new URLSearchParams(global.location.search);
    var api = q.get('api');
    var mock = q.get('mock');
    if (api !== null) merged.API_BASE_URL = (api === 'same' || api === '') ? '' : api;
    if (mock !== null) merged.USE_MOCK = (mock === '1' || mock === 'true');
  } catch (e) { /* 忽略非法查询串 */ }

  // 规整：去掉末尾斜杠，避免拼出 //api 之类的路径
  merged.API_BASE_URL = String(merged.API_BASE_URL || '').replace(/\/+$/, '');

  global.KG = global.KG || {};
  global.KG.config = merged;
})(window);
