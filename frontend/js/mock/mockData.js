/**
 * mockData.js —— 本地 Mock 数据（后端未完成时前端独立运行/演示用）
 *
 * 数据结构与仓库根目录 docs/api.md 中的定义严格一致：
 *   Entity   : { id, name, type, description, properties: [{ key, value }] }
 *   Relation : { id, source_id, target_id, relation, confidence }
 *
 * 大规模压测：在 js/config.js 中把 MOCK_SCALE_NODES 设为 3000，
 * getAll() 会附加程序生成的 3000 个实体，用于验证“概览 + 按需展开”的渲染策略。
 */
(function (global) {
  'use strict';

  var KG = (global.KG = global.KG || {});
  var mock = (KG.mock = KG.mock || {});

  /* ---------- 核心手工数据（演示用：规模小但字段完整） ---------- */

  var entities = [
    { id: 'ent_00001', name: '艾伦·图灵', type: 'person',
      description: '英国数学家、逻辑学家，计算机科学与人工智能奠基人之一。',
      properties: [
        { key: '出生年份', value: '1912' },
        { key: '国籍', value: '英国' },
        { key: '代表成果', value: '图灵机、图灵测试' }
      ] },
    { id: 'ent_00002', name: '约翰·麦卡锡', type: 'person',
      description: '美国计算机科学家，“人工智能”一词的提出者。',
      properties: [
        { key: '出生年份', value: '1927' },
        { key: '国籍', value: '美国' },
        { key: '称号', value: '人工智能之父' }
      ] },
    { id: 'ent_00003', name: '杰弗里·辛顿', type: 'person',
      description: '计算机科学家，深度学习与神经网络领域代表学者，图灵奖得主。',
      properties: [
        { key: '出生年份', value: '1947' },
        { key: '国籍', value: '加拿大' },
        { key: '研究领域', value: '深度学习' }
      ] },
    { id: 'ent_00004', name: '扬·勒丘恩', type: 'person',
      description: '计算机科学家，卷积神经网络的主要推动者，图灵奖得主。',
      properties: [
        { key: '出生年份', value: '1960' },
        { key: '国籍', value: '法国' },
        { key: '研究领域', value: '机器学习' }
      ] },
    { id: 'ent_00005', name: '麻省理工学院', type: 'organization',
      description: '位于美国剑桥市的私立研究型大学。',
      properties: [
        { key: '成立年份', value: '1861' },
        { key: '类别', value: '高等院校' }
      ] },
    { id: 'ent_00006', name: '多伦多大学', type: 'organization',
      description: '位于加拿大多伦多的公立研究型大学，深度学习研究重镇之一。',
      properties: [
        { key: '成立年份', value: '1827' },
        { key: '类别', value: '高等院校' }
      ] },
    { id: 'ent_00007', name: '清华大学', type: 'organization',
      description: '位于中国北京的综合性研究型大学。',
      properties: [
        { key: '成立年份', value: '1911' },
        { key: '类别', value: '高等院校' }
      ] },
    { id: 'ent_00008', name: '普林斯顿大学', type: 'organization',
      description: '位于美国新泽西州的私立研究型大学。',
      properties: [
        { key: '成立年份', value: '1746' },
        { key: '类别', value: '高等院校' }
      ] },
    { id: 'ent_00009', name: '伦敦', type: 'location',
      description: '英国首都。',
      properties: [ { key: '类别', value: '城市' } ] },
    { id: 'ent_00010', name: '多伦多', type: 'location',
      description: '加拿大安大略省首府。',
      properties: [ { key: '类别', value: '城市' } ] },
    { id: 'ent_00011', name: '北京', type: 'location',
      description: '中华人民共和国首都。',
      properties: [ { key: '类别', value: '城市' } ] },
    { id: 'ent_00012', name: '剑桥', type: 'location',
      description: '英国剑桥市，剑桥大学所在地。',
      properties: [ { key: '类别', value: '城市' } ] },
    { id: 'ent_00013', name: '人工智能', type: 'concept',
      description: '研究如何使机器模拟人类智能的学科。',
      properties: [ { key: '缩写', value: 'AI' }, { key: '提出时间', value: '1956 年达特茅斯会议' } ] },
    { id: 'ent_00014', name: '机器学习', type: 'concept',
      description: '人工智能的分支，通过数据自动学习规律。',
      properties: [ { key: '缩写', value: 'ML' } ] },
    { id: 'ent_00015', name: '神经网络', type: 'concept',
      description: '受人脑结构启发的计算模型，由大量神经元连接构成。',
      properties: [ { key: '提出时间', value: '1943 年 MP 模型' } ] },
    { id: 'ent_00016', name: '深度学习', type: 'concept',
      description: '基于多层神经网络的机器学习方法。',
      properties: [ { key: '缩写', value: 'DL' } ] },
    { id: 'ent_00017', name: '反向传播', type: 'concept',
      description: '训练神经网络的核心算法，沿误差梯度反向更新权重。',
      properties: [ { key: '缩写', value: 'BP' } ] },
    { id: 'ent_00018', name: 'AlexNet', type: 'work',
      description: '2012 年 ImageNet 竞赛冠军卷积神经网络，引爆深度学习浪潮。',
      properties: [
        { key: '发表年份', value: '2012' },
        { key: '类别', value: '卷积神经网络' }
      ] }
  ];

  var relations = [
    { id: 'rel_00001', source_id: 'ent_00001', target_id: 'ent_00009', relation: '出生于', confidence: 0.98 },
    { id: 'rel_00002', source_id: 'ent_00001', target_id: 'ent_00008', relation: '就读于', confidence: 0.92 },
    { id: 'rel_00003', source_id: 'ent_00001', target_id: 'ent_00013', relation: '推动', confidence: 0.85 },
    { id: 'rel_00004', source_id: 'ent_00002', target_id: 'ent_00005', relation: '就职于', confidence: 0.90 },
    { id: 'rel_00005', source_id: 'ent_00002', target_id: 'ent_00013', relation: '提出', confidence: 0.97 },
    { id: 'rel_00006', source_id: 'ent_00003', target_id: 'ent_00009', relation: '出生于', confidence: 0.95 },
    { id: 'rel_00007', source_id: 'ent_00003', target_id: 'ent_00006', relation: '就职于', confidence: 0.96 },
    { id: 'rel_00008', source_id: 'ent_00003', target_id: 'ent_00015', relation: '研究', confidence: 0.95 },
    { id: 'rel_00009', source_id: 'ent_00003', target_id: 'ent_00016', relation: '研究', confidence: 0.93 },
    { id: 'rel_00010', source_id: 'ent_00004', target_id: 'ent_00015', relation: '研究', confidence: 0.94 },
    { id: 'rel_00011', source_id: 'ent_00004', target_id: 'ent_00016', relation: '研究', confidence: 0.90 },
    { id: 'rel_00012', source_id: 'ent_00006', target_id: 'ent_00010', relation: '位于', confidence: 0.99 },
    { id: 'rel_00013', source_id: 'ent_00005', target_id: 'ent_00012', relation: '位于', confidence: 0.90 },
    { id: 'rel_00014', source_id: 'ent_00007', target_id: 'ent_00011', relation: '位于', confidence: 0.99 },
    { id: 'rel_00015', source_id: 'ent_00013', target_id: 'ent_00014', relation: '包含', confidence: 0.90 },
    { id: 'rel_00016', source_id: 'ent_00014', target_id: 'ent_00016', relation: '包含', confidence: 0.88 },
    { id: 'rel_00017', source_id: 'ent_00016', target_id: 'ent_00015', relation: '基于', confidence: 0.92 },
    { id: 'rel_00018', source_id: 'ent_00015', target_id: 'ent_00017', relation: '使用', confidence: 0.90 },
    { id: 'rel_00019', source_id: 'ent_00003', target_id: 'ent_00018', relation: '参与', confidence: 0.86 },
    { id: 'rel_00020', source_id: 'ent_00018', target_id: 'ent_00016', relation: '推动', confidence: 0.87 },
    { id: 'rel_00021', source_id: 'ent_00007', target_id: 'ent_00013', relation: '研究', confidence: 0.80 },
    { id: 'rel_00022', source_id: 'ent_00005', target_id: 'ent_00013', relation: '研究', confidence: 0.82 }
  ];

  /* ---------- 可选：程序生成的压测数据（验证 3000+ 规模） ---------- */

  /** 数字左补零 */
  function pad(num, width) {
    var str = String(num);
    while (str.length < width) str = '0' + str;
    return str;
  }

  /** 简单可复现的伪随机数（LCG），保证每次生成的压测数据一致 */
  function seededRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /**
   * 生成 count 个附加实体及其关系（挂在核心概念上），模拟大规模图谱。
   * 仅当 config.MOCK_SCALE_NODES > 0 时由 getAll() 调用。
   */
  function generateScaleData(count) {
    var TYPES = ['concept', 'person', 'organization', 'location', 'work'];
    var TYPE_NAME = { concept: '概念', person: '人物', organization: '机构', location: '地点', work: '作品' };
    var LABELS = { concept: '涉及', person: '研究', organization: '参与', location: '相关', work: '提及' };
    var anchors = ['ent_00013', 'ent_00014', 'ent_00015', 'ent_00016']; // 核心概念作为挂接点
    var rand = seededRandom(20260902);
    var es = [];
    var rs = [];

    for (var i = 0; i < count; i++) {
      var type = TYPES[Math.floor(rand() * TYPES.length)];
      var id = 'ent_9' + pad(i, 5);
      es.push({
        id: id,
        name: '压测' + TYPE_NAME[type] + ' #' + pad(i, 4),
        type: type,
        description: '自动生成的压测数据 #' + i + '，用于验证大规模图渲染与按需加载。',
        properties: [
          { key: '数据批次', value: 'mock-scale' },
          { key: '序号', value: String(i) }
        ]
      });
      // 每个压测实体 1~2 条边：一条连核心概念；一半概率连一个更早生成的压测实体
      rs.push({
        id: 'rel_9' + pad(rs.length, 5),
        source_id: id,
        target_id: anchors[Math.floor(rand() * anchors.length)],
        relation: LABELS[type],
        confidence: +(0.5 + rand() * 0.45).toFixed(2)
      });
      if (i > 0 && rand() > 0.5) {
        rs.push({
          id: 'rel_9' + pad(rs.length, 5),
          source_id: id,
          target_id: 'ent_9' + pad(Math.floor(rand() * i), 5),
          relation: '关联',
          confidence: +(0.5 + rand() * 0.4).toFixed(2)
        });
      }
    }
    return { entities: es, relations: rs };
  }

  var scaleCache = null;

  /** 取全量数据；MOCK_SCALE_NODES > 0 时附加压测数据（带缓存，避免重复生成） */
  function getAll() {
    var want = (KG.config && KG.config.MOCK_SCALE_NODES) || 0;
    if (!want) return { entities: entities, relations: relations };
    if (!scaleCache) scaleCache = generateScaleData(want);
    return {
      entities: entities.concat(scaleCache.entities),
      relations: relations.concat(scaleCache.relations)
    };
  }

  mock.data = {
    entities: entities,          // 核心演示数据
    relations: relations,
    getAll: getAll,
    generateScaleData: generateScaleData
  };
})(window);
