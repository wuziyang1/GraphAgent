/**
 * config.js —— 全局配置入口（全项目唯一允许出现后端地址的地方）
 *
 * 【重要约定】任何其它文件都不允许出现 http://localhost:xxxx 之类的硬编码地址。
 *
 * API_MODE（Mock / 真实后端切换，默认 'mock'）：
 *   'mock'  使用内置 Mock 数据，后端未就绪时前端可独立运行与演示
 *   'real'  请求真实后端，地址由 API_BASE_URL 决定（'' = 同源相对路径）
 *
 * 覆盖优先级（高 → 低）：
 *   1. URL 查询参数    ?mode=real&api=<地址>  （兼容旧写法 ?mock=0）
 *   2. localStorage    KG_API_MODE / KG_API_BASE_URL（兼容旧键 KG_USE_MOCK）
 *   3. config.local.js window.KG_LOCAL_CONFIG（本机私有文件，已 gitignore）
 *   4. 本文件 defaults
 */
(function (global) {
  'use strict';

  var defaults = {
    // 'mock' = 本地 Mock 数据；'real' = 真实后端（默认 Mock，后端就绪后无需改代码即可切换）
    API_MODE: 'mock',
    // 后端服务地址：'' = 同源；联调时可覆盖为 'http://192.168.1.20:8000' 等
    API_BASE_URL: '',
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
    // 兼容旧布尔写法 USE_MOCK: true→mock / false→real（API_MODE 优先）
    if (local.API_MODE == null && local.USE_MOCK != null) {
      merged.API_MODE = local.USE_MOCK ? 'mock' : 'real';
    }
  }

  // 优先级 2：localStorage 持久覆盖
  try {
    var lsBase = global.localStorage.getItem('KG_API_BASE_URL');
    var lsMode = global.localStorage.getItem('KG_API_MODE');
    var lsMock = global.localStorage.getItem('KG_USE_MOCK'); // 旧键，兼容
    if (lsBase) merged.API_BASE_URL = lsBase;
    if (lsMode) merged.API_MODE = lsMode;
    else if (lsMock !== null) merged.API_MODE = (lsMock === '1' || lsMock === 'true') ? 'mock' : 'real';
  } catch (e) { /* 浏览器禁用 localStorage 时忽略 */ }

  // 优先级 1：URL 查询参数（最高，方便演示时临时切换）
  try {
    var q = new URLSearchParams(global.location.search);
    var api = q.get('api');
    var mode = q.get('mode');
    var mock = q.get('mock'); // 旧参数，兼容
    if (api !== null) merged.API_BASE_URL = (api === 'same' || api === '') ? '' : api;
    if (mode !== null) merged.API_MODE = mode;
    else if (mock !== null) merged.API_MODE = (mock === '1' || mock === 'true') ? 'mock' : 'real';
  } catch (e) { /* 忽略非法查询串 */ }

  // 规整：API_MODE 只认 'mock' / 'real'，其余值一律回退 Mock（安全默认，后端没接好时不会白屏）
  merged.API_MODE = (merged.API_MODE === 'real') ? 'real' : 'mock';
  // 规整：去掉末尾斜杠，避免拼出 //api 之类的路径
  merged.API_BASE_URL = String(merged.API_BASE_URL || '').replace(/\/+$/, '');
  // 派生布尔（控制台判断用）：USE_MOCK === (API_MODE !== 'real')；运行时改模式请改 API_MODE
  merged.USE_MOCK = merged.API_MODE !== 'real';

  global.KG = global.KG || {};
  global.KG.config = merged;
})(window);
