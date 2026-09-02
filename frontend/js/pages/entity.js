/**
 * entity.js —— 实体详情页入口（骨架，业务下一步实现）
 *
 * 计划交互：
 *   1. 读取 ?id= 参数；缺失时提示并引导回搜索页
 *   2. GET /api/v1/entities/{id} → 渲染基本信息（名称/类型/描述）与属性表（entity.properties）
 *   3. GET /api/v1/entities/{id}/relations → 渲染关系表：
 *        - direction 筛选：out（发出的关系）/ in（收到的关系）/ both
 *        - 分页控件（pagination）
 *        - 关系行内 source/target 渲染为链接，可跳转到对应实体页，形成浏览闭环
 *   4. 低置信度关系（confidence 偏低）弱化展示
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  document.addEventListener('DOMContentLoaded', function () {
    var id = (KG.utils && KG.utils.getQueryParam('id')) || '';
    console.info('[entity] 页面骨架已就绪，待实现详情渲染。id =', id || '(未指定)');
  });
})(window);
