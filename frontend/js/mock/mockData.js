/**
 * mockData.js —— 本地 Mock 数据（后端未完成时前端独立运行/演示用）
 *
 * 数据结构与仓库根目录 docs/api.md 中的定义严格一致：
 *   Entity   : { id, name, type, description, properties: [{ key, value }] }
 *   Relation : { id, source_id, target_id, relation, confidence }
 *
 * 核心数据规模：48 个实体 / 71 条关系，覆盖全部 6 种实体类型
 * （person / organization / location / concept / work / event），
 * 并包含一对多（深度学习 → 多个子领域）、多对一（多位学者 → 图灵奖）
 * 等结构，用于验证图谱浏览的各类交互。
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
      ] },
    { id: 'ent_00019', name: '马文·明斯基', type: 'person',
      description: '美国认知科学家，人工智能奠基人之一，框架理论提出者。',
      properties: [
        { key: '出生年份', value: '1927' },
        { key: '国籍', value: '美国' },
        { key: '代表成果', value: '框架理论、Snarc 神经网络机' }
      ] },
    { id: 'ent_00020', name: '吴恩达', type: 'person',
      description: '华裔计算机科学家，Google Brain 联合创始人，机器学习大众化教育的推动者。',
      properties: [
        { key: '出生年份', value: '1976' },
        { key: '国籍', value: '美国' },
        { key: '代表成果', value: 'Google Brain、Coursera' }
      ] },
    { id: 'ent_00021', name: '李飞飞', type: 'person',
      description: '华裔计算机科学家，ImageNet 数据集发起人，计算机视觉领域代表学者。',
      properties: [
        { key: '出生年份', value: '1976' },
        { key: '国籍', value: '美国' },
        { key: '研究领域', value: '计算机视觉' }
      ] },
    { id: 'ent_00022', name: '伊恩·古德费洛', type: 'person',
      description: '美国计算机科学家，生成对抗网络（GAN）的提出者。',
      properties: [
        { key: '出生年份', value: '1985' },
        { key: '国籍', value: '美国' },
        { key: '代表成果', value: '生成对抗网络' }
      ] },
    { id: 'ent_00023', name: '阿希什·瓦斯瓦尼', type: 'person',
      description: '印度裔计算机科学家，Transformer 架构论文的第一作者。',
      properties: [
        { key: '国籍', value: '印度' },
        { key: '代表成果', value: 'Transformer 论文' }
      ] },
    { id: 'ent_00024', name: '德米斯·哈萨比斯', type: 'person',
      description: '英国人工智能研究者，DeepMind 创始人，AlphaGo 项目推动者。',
      properties: [
        { key: '出生年份', value: '1976' },
        { key: '国籍', value: '英国' },
        { key: '代表成果', value: 'DeepMind、AlphaGo' }
      ] },
    { id: 'ent_00025', name: '姚期智', type: 'person',
      description: '华裔计算机科学家，图灵奖得主，清华大学交叉信息研究院创始人。',
      properties: [
        { key: '出生年份', value: '1946' },
        { key: '国籍', value: '中国' },
        { key: '研究领域', value: '计算理论' }
      ] },
    { id: 'ent_00026', name: '斯坦福大学', type: 'organization',
      description: '位于美国加州的私立研究型大学，人工智能研究重镇。',
      properties: [
        { key: '成立年份', value: '1891' },
        { key: '类别', value: '高等院校' }
      ] },
    { id: 'ent_00027', name: '卡内基梅隆大学', type: 'organization',
      description: '位于美国匹兹堡的研究型大学，计算机科学领域顶尖学府。',
      properties: [
        { key: '成立年份', value: '1900' },
        { key: '类别', value: '高等院校' }
      ] },
    { id: 'ent_00028', name: '谷歌', type: 'organization',
      description: '美国跨国科技公司，旗下拥有 Google Brain、DeepMind 等多个 AI 研究团队。',
      properties: [
        { key: '成立年份', value: '1998' },
        { key: '类别', value: '科技企业' }
      ] },
    { id: 'ent_00029', name: 'DeepMind', type: 'organization',
      description: '英国人工智能公司，2014 年被谷歌收购，以 AlphaGo 闻名。',
      properties: [
        { key: '成立年份', value: '2010' },
        { key: '类别', value: 'AI 研究机构' }
      ] },
    { id: 'ent_00030', name: 'OpenAI', type: 'organization',
      description: '美国人工智能研究公司，ChatGPT 与 GPT 系列模型的开发方。',
      properties: [
        { key: '成立年份', value: '2015' },
        { key: '类别', value: 'AI 研究机构' }
      ] },
    { id: 'ent_00031', name: '卷积神经网络', type: 'concept',
      description: '一类包含卷积运算的前馈神经网络，图像识别的主流模型。',
      properties: [
        { key: '缩写', value: 'CNN' },
        { key: '提出时间', value: '1980 年代（Neocognitron）' }
      ] },
    { id: 'ent_00032', name: '循环神经网络', type: 'concept',
      description: '处理序列数据的神经网络结构，早期自然语言处理的主流模型。',
      properties: [ { key: '缩写', value: 'RNN' } ] },
    { id: 'ent_00033', name: 'Transformer', type: 'concept',
      description: '完全基于注意力机制的神经网络架构，现代大语言模型的基础结构。',
      properties: [ { key: '提出时间', value: '2017 年' } ] },
    { id: 'ent_00034', name: '注意力机制', type: 'concept',
      description: '让模型动态关注输入中不同部分的计算机制。',
      properties: [ { key: '缩写', value: 'Attention' } ] },
    { id: 'ent_00035', name: '强化学习', type: 'concept',
      description: '智能体通过与环境的交互获得奖励来学习策略的机器学习范式。',
      properties: [ { key: '缩写', value: 'RL' } ] },
    { id: 'ent_00036', name: '自然语言处理', type: 'concept',
      description: '研究人与计算机之间用自然语言进行有效通信的学科。',
      properties: [ { key: '缩写', value: 'NLP' } ] },
    { id: 'ent_00037', name: '计算机视觉', type: 'concept',
      description: '研究如何使机器“看懂”图像与视频的学科。',
      properties: [ { key: '缩写', value: 'CV' } ] },
    { id: 'ent_00038', name: '生成对抗网络', type: 'concept',
      description: '由生成器与判别器对抗训练的生成式模型。',
      properties: [
        { key: '缩写', value: 'GAN' },
        { key: '提出时间', value: '2014 年' }
      ] },
    { id: 'ent_00039', name: '大语言模型', type: 'concept',
      description: '在海量文本上训练的超大规模语言模型，具备通用文本理解与生成能力。',
      properties: [ { key: '缩写', value: 'LLM' } ] },
    { id: 'ent_00040', name: '知识图谱', type: 'concept',
      description: '以图结构描述实体及其关系的语义网络，本系统构建的目标数据形态。',
      properties: [
        { key: '缩写', value: 'KG' },
        { key: '提出时间', value: '2012 年（谷歌）' }
      ] },
    { id: 'ent_00041', name: 'ResNet', type: 'work',
      description: '2015 年 ILSVRC 竞赛冠军网络，引入残差连接使超深网络可训练。',
      properties: [
        { key: '发表年份', value: '2015' },
        { key: '类别', value: '卷积神经网络' }
      ] },
    { id: 'ent_00042', name: 'Attention Is All You Need', type: 'work',
      description: '2017 年发表的 Transformer 架构奠基论文。',
      properties: [
        { key: '发表年份', value: '2017' },
        { key: '类别', value: '学术论文' }
      ] },
    { id: 'ent_00043', name: 'ImageNet', type: 'work',
      description: '超大规模带标注图像数据集，视觉深度学习浪潮的重要基础。',
      properties: [
        { key: '发布年份', value: '2009' },
        { key: '类别', value: '数据集' }
      ] },
    { id: 'ent_00044', name: 'AlphaGo', type: 'work',
      description: 'DeepMind 开发的围棋智能体，2016 年战胜人类顶尖棋手。',
      properties: [
        { key: '发布年份', value: '2016' },
        { key: '类别', value: '智能体系统' }
      ] },
    { id: 'ent_00045', name: 'ChatGPT', type: 'work',
      description: 'OpenAI 推出的对话式大语言模型产品，引发生成式 AI 热潮。',
      properties: [
        { key: '发布年份', value: '2022' },
        { key: '类别', value: '对话式 AI 产品' }
      ] },
    { id: 'ent_00046', name: '达特茅斯会议', type: 'event',
      description: '1956 年夏季举行的研讨会，“人工智能”作为学科诞生的标志。',
      properties: [
        { key: '举办年份', value: '1956' },
        { key: '地点', value: '美国汉诺威' }
      ] },
    { id: 'ent_00047', name: '图灵奖', type: 'event',
      description: '国际计算机学会自 1966 年起颁发的计算机科学最高奖项，被誉为“计算机界的诺贝尔奖”。',
      properties: [
        { key: '设立年份', value: '1966' },
        { key: '颁发机构', value: 'ACM' }
      ] },
    { id: 'ent_00048', name: 'ILSVRC 竞赛', type: 'event',
      description: '基于 ImageNet 数据集的大规模视觉识别挑战赛（2010–2017），深度学习里程碑的舞台。',
      properties: [
        { key: '举办年份', value: '2010' },
        { key: '全称', value: 'ImageNet 大规模视觉识别挑战赛' }
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
    { id: 'rel_00022', source_id: 'ent_00005', target_id: 'ent_00013', relation: '研究', confidence: 0.82 },

    /* —— 学科与事件脉络（一对多 / 多对一结构） —— */
    { id: 'rel_00023', source_id: 'ent_00019', target_id: 'ent_00005', relation: '就职于', confidence: 0.90 },
    { id: 'rel_00024', source_id: 'ent_00019', target_id: 'ent_00046', relation: '发起', confidence: 0.95 },
    { id: 'rel_00025', source_id: 'ent_00002', target_id: 'ent_00046', relation: '发起', confidence: 0.96 },
    { id: 'rel_00026', source_id: 'ent_00046', target_id: 'ent_00013', relation: '催生', confidence: 0.94 },
    { id: 'rel_00027', source_id: 'ent_00013', target_id: 'ent_00036', relation: '包含', confidence: 0.90 },
    { id: 'rel_00028', source_id: 'ent_00013', target_id: 'ent_00037', relation: '包含', confidence: 0.90 },
    { id: 'rel_00029', source_id: 'ent_00014', target_id: 'ent_00035', relation: '包含', confidence: 0.88 },
    { id: 'rel_00030', source_id: 'ent_00016', target_id: 'ent_00031', relation: '包含', confidence: 0.92 },
    { id: 'rel_00031', source_id: 'ent_00016', target_id: 'ent_00032', relation: '包含', confidence: 0.88 },
    { id: 'rel_00032', source_id: 'ent_00016', target_id: 'ent_00033', relation: '包含', confidence: 0.93 },
    { id: 'rel_00033', source_id: 'ent_00033', target_id: 'ent_00034', relation: '基于', confidence: 0.97 },
    { id: 'rel_00034', source_id: 'ent_00015', target_id: 'ent_00031', relation: '包含', confidence: 0.85 },
    { id: 'rel_00035', source_id: 'ent_00031', target_id: 'ent_00037', relation: '应用于', confidence: 0.93 },
    { id: 'rel_00036', source_id: 'ent_00032', target_id: 'ent_00036', relation: '应用于', confidence: 0.90 },

    /* —— 人物、机构与奖项（多个人物 → 同一机构 / 同一奖项） —— */
    { id: 'rel_00037', source_id: 'ent_00003', target_id: 'ent_00028', relation: '曾任职于', confidence: 0.92 },
    { id: 'rel_00038', source_id: 'ent_00003', target_id: 'ent_00047', relation: '获奖', confidence: 0.99 },
    { id: 'rel_00039', source_id: 'ent_00004', target_id: 'ent_00047', relation: '获奖', confidence: 0.99 },
    { id: 'rel_00040', source_id: 'ent_00025', target_id: 'ent_00047', relation: '获奖', confidence: 0.98 },
    { id: 'rel_00041', source_id: 'ent_00025', target_id: 'ent_00007', relation: '任教于', confidence: 0.95 },
    { id: 'rel_00042', source_id: 'ent_00040', target_id: 'ent_00013', relation: '属于', confidence: 0.90 },
    { id: 'rel_00043', source_id: 'ent_00039', target_id: 'ent_00033', relation: '基于', confidence: 0.96 },
    { id: 'rel_00044', source_id: 'ent_00045', target_id: 'ent_00039', relation: '基于', confidence: 0.97 },
    { id: 'rel_00045', source_id: 'ent_00030', target_id: 'ent_00045', relation: '发布', confidence: 0.98 },
    { id: 'rel_00046', source_id: 'ent_00029', target_id: 'ent_00044', relation: '开发', confidence: 0.97 },
    { id: 'rel_00047', source_id: 'ent_00024', target_id: 'ent_00029', relation: '创立', confidence: 0.96 },
    { id: 'rel_00048', source_id: 'ent_00024', target_id: 'ent_00009', relation: '出生于', confidence: 0.94 },
    { id: 'rel_00049', source_id: 'ent_00044', target_id: 'ent_00035', relation: '应用于', confidence: 0.92 },
    { id: 'rel_00050', source_id: 'ent_00021', target_id: 'ent_00043', relation: '创建', confidence: 0.97 },
    { id: 'rel_00051', source_id: 'ent_00043', target_id: 'ent_00037', relation: '推动', confidence: 0.93 },
    { id: 'rel_00052', source_id: 'ent_00048', target_id: 'ent_00037', relation: '聚焦', confidence: 0.91 },
    { id: 'rel_00053', source_id: 'ent_00018', target_id: 'ent_00048', relation: '夺冠', confidence: 0.98 },
    { id: 'rel_00054', source_id: 'ent_00020', target_id: 'ent_00026', relation: '任教于', confidence: 0.95 },
    { id: 'rel_00055', source_id: 'ent_00020', target_id: 'ent_00028', relation: '曾任职于', confidence: 0.92 },
    { id: 'rel_00056', source_id: 'ent_00021', target_id: 'ent_00026', relation: '任教于', confidence: 0.96 },
    { id: 'rel_00057', source_id: 'ent_00022', target_id: 'ent_00038', relation: '提出', confidence: 0.97 },
    { id: 'rel_00058', source_id: 'ent_00022', target_id: 'ent_00028', relation: '曾任职于', confidence: 0.90 },
    { id: 'rel_00059', source_id: 'ent_00023', target_id: 'ent_00042', relation: '发表', confidence: 0.96 },
    { id: 'rel_00060', source_id: 'ent_00042', target_id: 'ent_00033', relation: '提出', confidence: 0.98 },
    { id: 'rel_00061', source_id: 'ent_00026', target_id: 'ent_00013', relation: '研究', confidence: 0.88 },
    { id: 'rel_00062', source_id: 'ent_00027', target_id: 'ent_00013', relation: '研究', confidence: 0.87 },
    { id: 'rel_00063', source_id: 'ent_00041', target_id: 'ent_00031', relation: '基于', confidence: 0.95 },
    { id: 'rel_00064', source_id: 'ent_00041', target_id: 'ent_00048', relation: '夺冠', confidence: 0.97 },
    { id: 'rel_00065', source_id: 'ent_00045', target_id: 'ent_00036', relation: '应用于', confidence: 0.95 },
    { id: 'rel_00066', source_id: 'ent_00033', target_id: 'ent_00036', relation: '应用于', confidence: 0.90 },
    { id: 'rel_00067', source_id: 'ent_00006', target_id: 'ent_00003', relation: '培养', confidence: 0.88 },
    { id: 'rel_00068', source_id: 'ent_00002', target_id: 'ent_00026', relation: '任教于', confidence: 0.86 },
    { id: 'rel_00069', source_id: 'ent_00019', target_id: 'ent_00008', relation: '就读于', confidence: 0.90 },
    { id: 'rel_00070', source_id: 'ent_00047', target_id: 'ent_00001', relation: '纪念', confidence: 0.99 },
    { id: 'rel_00071', source_id: 'ent_00038', target_id: 'ent_00037', relation: '应用于', confidence: 0.80 }
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
