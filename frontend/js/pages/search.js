/**
 * search.js —— 实体查询页入口（骨架，业务下一步实现）
 *
 * 计划交互：
 *   1. 读取 ?keyword= 与 ?type= 初始化筛选条件（支持从图谱页跳转过来搜索）
 *   2. 输入防抖 300ms 后调用 KG.api.graph.search({ keyword, entity_type, page, page_size })
 *   3. 渲染结果列表：实体名 / 类型标签 / 命中字段（matched_field）/ 简介
 *   4. 点击结果跳转 pages/entity.html?id=xxx；底部渲染分页控件（pagination）
 *   5. 空结果与请求失败分别给出提示态
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  document.addEventListener('DOMContentLoaded', function () {
    var keyword = (KG.utils && KG.utils.getQueryParam('keyword')) || '';
    var type = (KG.utils && KG.utils.getQueryParam('type')) || '';
    console.info('[search] 页面骨架已就绪，待实现搜索。keyword =', keyword || '(空)', 'type =', type || '(不限)');
  });
})(window);
