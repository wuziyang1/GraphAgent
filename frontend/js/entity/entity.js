/**
 * entity.js —— 实体查询模块（KG.entity）
 *
 * 负责主页两块 UI 的渲染与状态：
 *   左侧搜索区：关键词搜索（精确 / 模糊）+ 类型筛选 + 结果列表，四种状态：
 *     加载中 / 搜索成功 / 无结果 / 请求失败（含竞态保护，快速连续搜索只认最后一次）
 *   右侧详情区：实体详情（属性 + 出边 / 入边 / 关联实体）与关系详情卡片
 *
 * 分层约定：
 *   - 数据一律通过 KG.api.graph.* 获取（统一 API 层见 js/api/），本模块不直接发请求
 *   - 与图谱画布的联动（类型弱化、定位高亮）通过 init 注入的回调完成，由 app.js 协调
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});

  /* ---------- 本模块持有的 DOM（左右两栏区域，入口脚本不重复缓存） ---------- */

  var dom = {};
  var IDS = [
    // 左侧：搜索区
    'search-input', 'search-btn', 'type-filter', 'clear-filter-btn',
    'search-results', 'result-count', 'legend',
    // 右侧：实体详情
    'entity-detail', 'entity-name', 'entity-type-badge', 'entity-id', 'entity-desc',
    'entity-props-body', 'entity-prop-count',
    'entity-out-list', 'entity-out-count', 'entity-in-list', 'entity-in-count',
    'entity-linked-list', 'entity-linked-count',
    // 右侧：关系详情 / 空态
    'relation-detail', 'rel-source', 'rel-name', 'rel-target', 'rel-id', 'rel-type', 'rel-confidence',
    'detail-empty'
  ];

  /* ---------- 状态 ---------- */

  var hooks = {};             // init 注入：onFilterChange / onActivate / getNodeData
  var currentEntityId = null; // 右侧当前展示的实体 id（详情两段加载的竞态保护）
  var searchSeq = 0;          // 搜索序号：只有最新一次搜索允许写结果 DOM

  /* ---------- 小工具 ---------- */

  var COLORS = KG.graph.styles.TYPE_COLORS;
  var NAMES = KG.graph.styles.TYPE_NAMES;

  /** 命中字段 → 中文（docs/api.md 3.7 items[].matched_field） */
  var FIELD_NAMES = { name: '名称', description: '描述', properties: '属性' };

  function typeLabel(type) { return NAMES[type] || type || '未知'; }

  function typeBadgeHtml(type) {
    var color = COLORS[type] || '#64748b';
    return '<span class="type-badge" style="background:' + color + '">' +
           KG.utils.escapeHtml(typeLabel(type)) + '</span>';
  }

  /** 就地更新详情卡上的类型徽标（textContent + 配色，不替换 DOM 节点） */
  function setBadge(el, type) {
    el.textContent = type ? typeLabel(type) : '—';
    el.style.background = type ? (COLORS[type] || '#64748b') : '#64748b';
  }

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  /* ================================================================
   * 初始化与事件绑定
   * ================================================================ */

  /**
   * @param {object} opts
   *   - onFilterChange(type)  类型筛选变化（app.js 负责联动画布弱化）
   *   - onActivate(id)        点击搜索结果 / 关联实体 / 关系端点，请求跳转到该实体
   *   - getNodeData(id)       画布提供的节点数据读取器（关系详情卡显示端点名称用）
   */
  function init(opts) {
    hooks = opts || {};
    IDS.forEach(function (id) { dom[id] = KG.utils.$('#' + id); });

    dom['search-btn'].addEventListener('click', search);
    dom['search-input'].addEventListener('keydown', function (e) {
      // isComposing：中文输入法组词中的回车不触发搜索
      if (e.key === 'Enter' && !e.isComposing) search();
    });
    dom['search-input'].addEventListener('input',
      KG.utils.debounce(function () {
        if (dom['search-input'].value.trim() === '') clearResults();
      }, 250));

    dom['type-filter'].addEventListener('change', function () {
      if (hooks.onFilterChange) hooks.onFilterChange(dom['type-filter'].value);
      // 已有关键词时，切换类型立即刷新搜索结果
      if (dom['search-input'].value.trim() !== '') search();
    });
    dom['clear-filter-btn'].addEventListener('click', clearFilter);

    // 关系详情卡片里的实体名可点击跳转
    dom['rel-source'].addEventListener('click', function () { activate(dom['rel-source'].dataset.id); });
    dom['rel-target'].addEventListener('click', function () { activate(dom['rel-target'].dataset.id); });
  }

  /** 统一走协调器跳转实体（搜索结果 / 关联实体 / 关系端点） */
  function activate(id) {
    if (id && hooks.onActivate) hooks.onActivate(id);
  }

  /* ================================================================
   * 左侧：搜索（加载中 / 成功 / 无结果 / 失败 四态）
   * ================================================================ */

  function search() {
    var keyword = dom['search-input'].value.trim();
    if (!keyword) {
      dom['result-count'].textContent = '';
      dom['search-results'].innerHTML = '<li class="result-empty">请输入搜索关键词</li>';
      return;
    }

    var params = { keyword: keyword, page_size: 20 };
    var type = dom['type-filter'].value;
    if (type) params.entity_type = type;

    var seq = ++searchSeq;
    setSearching(true);

    KG.api.graph.search(params)
      .then(function (result) {
        if (seq !== searchSeq) return; // 已被更新的搜索取代，丢弃本次结果
        setSearching(false);
        renderResults(result, keyword, type);
      })
      .catch(function (err) {
        if (seq !== searchSeq) return;
        setSearching(false);
        showError(err);
      });
  }

  /** 加载中：列表提示 + 按钮禁用（Mock 延迟 / 真实网络下均可见） */
  function setSearching(busy) {
    dom['search-btn'].disabled = busy;
    dom['search-btn'].textContent = busy ? '搜索中' : '搜索';
    if (busy) {
      dom['result-count'].textContent = '';
      dom['search-results'].innerHTML =
        '<li class="result-empty">正在搜索「' +
        KG.utils.escapeHtml(dom['search-input'].value.trim()) + '」…</li>';
    }
  }

  /** 请求失败态：给出原因与可重试提示 */
  function showError(err) {
    dom['result-count'].textContent = '';
    dom['search-results'].innerHTML =
      '<li class="result-empty result-error">搜索失败：' +
      KG.utils.escapeHtml((err && err.message) || String(err)) +
      '<br><span class="state-hint">请检查网络后重试</span></li>';
  }

  /** 成功态：结果列表（名称 / 类型 / 命中字段 / 简介），点击跳转实体 */
  function renderResults(result, keyword, type) {
    var list = dom['search-results'];
    dom['result-count'].textContent = '共 ' + result.pagination.total + ' 条';

    if (!result.items.length) {
      list.innerHTML =
        '<li class="result-empty">未找到与「' + KG.utils.escapeHtml(keyword) + '」相关的实体' +
        '<br><span class="state-hint">试试其他关键词' + (type ? '，或清除类型筛选' : '') + '</span></li>';
      return;
    }

    list.innerHTML = result.items.map(function (item) {
      var e = item.entity;
      var field = FIELD_NAMES[item.matched_field] || item.matched_field || '';
      return '<li class="result-item" data-id="' + KG.utils.escapeHtml(e.id) + '">' +
               '<div class="result-item-top">' +
                 '<span class="result-name" title="' + KG.utils.escapeHtml(e.name) + '">' +
                   KG.utils.escapeHtml(e.name) + '</span>' + typeBadgeHtml(e.type) +
                 (field ? '<span class="match-field" title="关键词命中字段">' +
                   KG.utils.escapeHtml(field) + '</span>' : '') +
               '</div>' +
               (e.description
                 ? '<div class="result-desc">' + KG.utils.escapeHtml(e.description) + '</div>'
                 : '') +
             '</li>';
    }).join('');

    // 首页为轻量搜索，超出本页条数时提示（完整分页留给独立搜索页）
    if (result.pagination.total > result.items.length) {
      list.innerHTML += '<li class="result-empty result-more">仅显示前 ' + result.items.length +
        ' 条 / 共 ' + result.pagination.total + ' 条</li>';
    }

    KG.utils.$$('.result-item', list).forEach(function (li) {
      li.addEventListener('click', function () { activate(li.dataset.id); });
    });
  }

  function clearResults() {
    dom['search-results'].innerHTML =
      '<li class="result-empty" id="result-placeholder">输入关键词并点击「搜索」</li>';
    dom['result-count'].textContent = '';
  }

  function clearFilter() {
    dom['type-filter'].value = '';
    dom['search-input'].value = '';
    if (hooks.onFilterChange) hooks.onFilterChange('');
    clearResults();
  }

  /* ---------- 类型筛选下拉与图例（stats 接口数据，app.js 调用） ---------- */

  /** 类型筛选下拉：按数量降序；刷新选项时保持已选中值不变 */
  function renderTypeOptions(distribution) {
    var select = dom['type-filter'];
    var kept = select.value;
    select.innerHTML = '<option value="">全部类型</option>';
    Object.keys(distribution)
      .sort(function (a, b) { return distribution[b] - distribution[a]; })
      .forEach(function (type) {
        var opt = document.createElement('option');
        opt.value = type;
        opt.textContent = typeLabel(type) + '（' + distribution[type] + '）';
        select.appendChild(opt);
      });
    select.value = kept;
  }

  function renderLegend(distribution) {
    dom['legend'].innerHTML = Object.keys(distribution)
      .sort(function (a, b) { return distribution[b] - distribution[a]; })
      .map(function (type) {
        var color = COLORS[type] || '#64748b';
        return '<li><span class="swatch" style="background:' + color + '"></span>' +
               KG.utils.escapeHtml(typeLabel(type)) + ' ' + distribution[type] + '</li>';
      }).join('');
  }

  /* ================================================================
   * 右侧：实体详情 / 关系详情
   * ================================================================ */

  /**
   * 展示实体详情：骨架 → 实体 → 关系两段加载，各自带竞态保护。
   * 点击搜索结果、图中节点、关联实体、关系端点都会走到这里（由 app.js 协调调用）。
   */
  function showDetail(entityId) {
    if (!entityId) return Promise.resolve();
    currentEntityId = entityId;

    // 先展示骨架，避免网络延迟期间右侧空白
    hide(dom['relation-detail']);
    hide(dom['detail-empty']);
    show(dom['entity-detail']);
    dom['entity-name'].textContent = '加载中…';
    setBadge(dom['entity-type-badge'], null);
    dom['entity-id'].textContent = entityId;
    dom['entity-desc'].textContent = '';
    dom['entity-props-body'].innerHTML = '';
    dom['entity-out-count'].textContent = '…';
    dom['entity-in-count'].textContent = '…';
    dom['entity-out-list'].innerHTML = dom['entity-in-list'].innerHTML = '<li class="result-empty">加载中…</li>';
    dom['entity-linked-count'].textContent = '…';
    dom['entity-linked-list'].innerHTML = '';

    return KG.api.graph.getEntity(entityId)
      .then(function (detail) {
        if (currentEntityId !== entityId) return; // 期间用户又点了别的实体
        renderEntityDetail(detail.entity);
      })
      .catch(function (err) {
        if (currentEntityId !== entityId) return;
        dom['entity-name'].textContent = '加载失败';
        dom['entity-desc'].textContent = err.message;
      })
      .then(function () {
        return KG.api.graph.getEntityRelations(entityId, { direction: 'both', page_size: 50 });
      })
      .then(function (rels) {
        if (currentEntityId !== entityId) return;
        renderEntityRelations(entityId, rels.items);
      })
      .catch(function (err) {
        if (currentEntityId !== entityId) return;
        dom['entity-out-list'].innerHTML =
          '<li class="result-empty">关系加载失败：' + KG.utils.escapeHtml(err.message) + '</li>';
      });
  }

  function renderEntityDetail(entity) {
    dom['entity-name'].textContent = entity.name;
    setBadge(dom['entity-type-badge'], entity.type);
    dom['entity-id'].textContent = entity.id;
    dom['entity-desc'].textContent = entity.description || '（暂无描述）';

    var props = entity.properties || [];
    dom['entity-prop-count'].textContent = props.length;
    dom['entity-props-body'].innerHTML = props.length
      ? props.map(function (p) {
          return '<tr><th>' + KG.utils.escapeHtml(p.key) + '</th><td>' +
                 KG.utils.escapeHtml(p.value) + '</td></tr>';
        }).join('')
      : '<tr><td>（暂无属性）</td></tr>';
  }

  /** 单条关系行的 HTML：isOut=true 时为“关系 → 对端”，否则“对端 → 关系”（隐含指向当前实体） */
  function relRowHtml(r, other, isOut) {
    var dirTitle = isOut
      ? '出边：当前实体 → ' + other.name
      : '入边：' + other.name + ' → 当前实体';
    var parts = isOut
      ? ['<span class="rel-label" title="' + KG.utils.escapeHtml(r.relation) + '">' + KG.utils.escapeHtml(r.relation) + '</span>',
         '<span class="rel-dir" title="' + KG.utils.escapeHtml(dirTitle) + '">→</span>',
         otherHtml(other)]
      : [otherHtml(other),
         '<span class="rel-dir" title="' + KG.utils.escapeHtml(dirTitle) + '">→</span>',
         '<span class="rel-label" title="' + KG.utils.escapeHtml(r.relation) + '">' + KG.utils.escapeHtml(r.relation) + '</span>'];
    return '<li class="rel-item" data-id="' + KG.utils.escapeHtml(other.id) + '">' + parts.join('') + '</li>';
  }

  function otherHtml(other) {
    return '<span class="rel-other" title="' + KG.utils.escapeHtml(other.name) + '">' +
             KG.utils.escapeHtml(other.name) +
           '</span>' +
           '<span class="rel-other-type">' + KG.utils.escapeHtml(typeLabel(other.type)) + '</span>';
  }

  /**
   * 相关关系渲染：拆分为出边（当前实体 → 他人）与入边（他人 → 当前实体）两组，
   * 另外汇总去重后的关联实体，全部可点击跳转。
   */
  function renderEntityRelations(entityId, items) {
    var outs = [], ins = [];
    items.forEach(function (r) { (r.source.id === entityId ? outs : ins).push(r); });

    dom['entity-out-count'].textContent = outs.length;
    dom['entity-in-count'].textContent = ins.length;
    dom['entity-out-list'].innerHTML = outs.length
      ? outs.map(function (r) { return relRowHtml(r, r.target, true); }).join('')
      : '<li class="result-empty">（无出边）</li>';
    dom['entity-in-list'].innerHTML = ins.length
      ? ins.map(function (r) { return relRowHtml(r, r.source, false); }).join('')
      : '<li class="result-empty">（无入边）</li>';

    // 关联实体：出入两端去重
    var seen = {}, linked = [];
    items.forEach(function (r) {
      var other = r.source.id === entityId ? r.target : r.source;
      if (!seen[other.id]) { seen[other.id] = true; linked.push(other); }
    });
    dom['entity-linked-count'].textContent = linked.length;
    dom['entity-linked-list'].innerHTML = linked.length
      ? linked.map(function (o) {
          return '<span class="entity-chip" data-id="' + KG.utils.escapeHtml(o.id) + '" ' +
                 'title="' + KG.utils.escapeHtml(typeLabel(o.type) + ' · ' + o.id) + '">' +
                   '<span class="dot" style="background:' + (COLORS[o.type] || '#64748b') + '"></span>' +
                   KG.utils.escapeHtml(o.name) +
                 '</span>';
        }).join('')
      : '<span class="placeholder-note">（无关联实体）</span>';

    [dom['entity-out-list'], dom['entity-in-list'], dom['entity-linked-list']].forEach(function (root) {
      KG.utils.$$('.rel-item, .entity-chip', root).forEach(function (el) {
        el.addEventListener('click', function () { activate(el.dataset.id); });
      });
    });
  }

  /** 单击关系边：右侧切换为关系详情卡片（source —relation→ target） */
  function showRelationDetail(edgeData) {
    hide(dom['entity-detail']);
    hide(dom['detail-empty']);
    show(dom['relation-detail']);

    var source = hooks.getNodeData ? hooks.getNodeData(edgeData.source) : null;
    var target = hooks.getNodeData ? hooks.getNodeData(edgeData.target) : null;

    fillRelNode(dom['rel-source'], source, edgeData.source);
    fillRelNode(dom['rel-target'], target, edgeData.target);
    dom['rel-name'].textContent = edgeData.relation;
    dom['rel-id'].textContent = edgeData.id;
    dom['rel-type'].textContent = edgeData.relation;
    dom['rel-confidence'].textContent =
      edgeData.weight == null ? '—' : (Math.round(edgeData.weight * 100) + '%');
  }

  function fillRelNode(el, nodeData, fallbackId) {
    el.textContent = nodeData ? nodeData.name : fallbackId;
    el.dataset.id = nodeData ? nodeData.id : fallbackId;
    el.title = nodeData ? (typeLabel(nodeData.type) + ' · ' + nodeData.id) : fallbackId;
  }

  /** 搜索结果列表中高亮当前选中项 */
  function markActive(entityId) {
    KG.utils.$$('.result-item', dom['search-results']).forEach(function (li) {
      li.classList.toggle('active', li.dataset.id === entityId);
    });
  }

  /** 工具栏「重置」时调用：清空搜索区并回到详情空态（画布部分由 app.js 负责） */
  function reset() {
    dom['type-filter'].value = '';
    dom['search-input'].value = '';
    clearResults();
    currentEntityId = null;
    hide(dom['entity-detail']);
    hide(dom['relation-detail']);
    show(dom['detail-empty']);
  }

  KG.entity = {
    init: init,
    search: search,
    showDetail: showDetail,
    showRelationDetail: showRelationDetail,
    markActive: markActive,
    renderTypeOptions: renderTypeOptions,
    renderLegend: renderLegend,
    clearResults: clearResults,
    reset: reset
  };
})(window);
