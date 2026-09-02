/**
 * client.js —— 统一 fetch 封装（前端唯一的真实网络出口）
 *
 * 职责：
 *   1. 拼接完整 URL：API_BASE_URL + API_PREFIX + path + 查询串
 *   2. 超时控制（AbortController）
 *   3. 解析统一响应 envelope：{ code, message, data }
 *        - code === 0  成功，返回 data
 *        - code !== 0  抛出 ApiError（业务层只需要捕获这一种错误）
 *   4. 网络异常 / 非 JSON 响应统一转换为 ApiError
 *
 * Mock 模式下本文件不会被调用（分流逻辑见 js/api/graphApi.js）。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  /** 统一错误对象：code 为业务错误码（见 docs/api.md），status 为 HTTP 状态码 */
  function ApiError(code, message, status, detail) {
    this.name = 'ApiError';
    this.code = code == null ? -1 : code;
    this.message = message || '未知错误';
    this.status = status == null ? 0 : status; // 0 表示请求未到达服务器（网络层失败）
    this.detail = detail || null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;
  ApiError.prototype.toString = function () {
    return 'ApiError(' + this.code + '): ' + this.message;
  };

  /** 拼接最终请求地址；也导出给控制台调试用（KG.api.buildUrl('search', {keyword:'x'})） */
  function buildUrl(path, params) {
    var cfg = KG.config;
    var url = cfg.API_BASE_URL + cfg.API_PREFIX + '/' + String(path).replace(/^\/+/, '');
    var search = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v == null || v === '') return; // 空参数直接省略
      search.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    if (search.length) url += '?' + search.join('&');
    return url;
  }

  async function request(path, options) {
    options = options || {};
    var cfg = KG.config;
    var url = buildUrl(path, options.params);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, cfg.REQUEST_TIMEOUT_MS);

    try {
      var resp = await fetch(url, {
        method: options.method || 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      var body = null;
      try { body = await resp.json(); } catch (e) { body = null; }

      if (body && typeof body.code === 'number') {
        if (body.code === 0) return body.data; // 成功：只把 data 交给业务层
        throw new ApiError(
          body.code,
          body.message,
          resp.status,
          (body.data && body.data.detail) || null
        );
      }
      // 响应不符合 envelope 约定
      throw new ApiError(-1, '后端响应格式不符合约定（期望 JSON envelope）', resp.status);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err && err.name === 'AbortError') {
        throw new ApiError(-1, '请求超时（' + cfg.REQUEST_TIMEOUT_MS + 'ms）：' + url, 0);
      }
      // fetch 网络错误（服务器不可达 / CORS 被拦截 / file:// 协议限制等）
      throw new ApiError(-1, '网络错误或服务器不可达：' + url, 0);
    } finally {
      clearTimeout(timer);
    }
  }

  KG.api = KG.api || {};
  KG.api.ApiError = ApiError;
  KG.api.request = request;
  KG.api.buildUrl = buildUrl;
})(window);
