/**
 * utils.js —— 通用小工具（与业务无关，任何页面均可使用）
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  var utils = {
    /** document.querySelector 简写 */
    $: function (selector, root) {
      return (root || document).querySelector(selector);
    },

    /** document.querySelectorAll 简写，返回真数组 */
    $$: function (selector, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    },

    /** HTML 转义：所有接口数据渲染进页面前必须经过它，防止注入 */
    escapeHtml: function (value) {
      var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
    },

    /** 读取当前页面 URL 查询参数 */
    getQueryParam: function (name) {
      try { return new URLSearchParams(global.location.search).get(name); } catch (e) { return null; }
    },

    /** 千分位格式化：12345 -> '12,345' */
    formatNumber: function (n) {
      if (n == null || isNaN(n)) return '0';
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /** 防抖：搜索输入等场景使用 */
    debounce: function (fn, wait) {
      var timer = null;
      return function () {
        var args = arguments;
        var ctx = this;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
      };
    }
  };

  KG.utils = utils;
})(window);
