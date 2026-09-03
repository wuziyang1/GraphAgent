# GraphAgent

面向医学文本的自动知识抽取、知识库存储和知识图谱可视化系统。

当前后端会读取 `data/r_medical_real_texts_3000.jsonl`，通过规则自动识别疾病实体、属性和实体关系，完成规范化、类型约束、去重与证据保留，生成结构化 JSONL，并写入 SQLite 知识库。它同时实现了 `docs/api.md` 约定的 7 个 REST API，可直接连接已有前端。

## 快速开始

要求 Python 3.10 或更高版本。核心流程只使用标准库，不需要安装依赖。

```bash
# 1. 构建三元组和知识库
python -m backend build

# 2. 运行测试
python -m unittest discover -s tests -v

# 3. 启动后端 API
python -m backend serve --host 127.0.0.1 --port 8000

# 4. 另开终端启动前端
python -m http.server 8080 --directory frontend
```

浏览器打开：

```text
http://127.0.0.1:8080/?mode=real&api=http://127.0.0.1:8000
```

## 抽取设计

```text
JSONL → 规则路由 → 实体/属性/关系候选 → 名称规范化
      → 关系类型校验 → 去重 → JSONL + SQLite → REST API → 前端
```

### 关系型事实

原数据中 `object` 非空的记录按受控映射转换。例如：

```text
百日咳 --HAS_SYMPTOM--> 痉挛性咳嗽
百日咳 --NEEDS_CHECK--> 血常规
百日咳 --VISITS_DEPARTMENT--> 小儿内科
```

支持的关系包括症状、并发疾病、科室、治疗方式、检查项目、药物、食物和疾病分类。每种关系都有允许的主客体类型，非法自环或类型组合会进入 `artifacts/rejected.jsonl`，不会写入知识库。

### 属性型事实

疾病简介、病因、预防措施、医保状态、患病比例、易感人群、传播方式、治疗周期、治愈概率和治疗费用保存为疾病属性。所有属性保留原文证据、来源记录、抽取方式和置信度。

### 可选 LLM 增强

规则流程本身已经完整可运行。如果需要从病因、易感人群和传播方式的长文本中继续抽取新实体关系，可使用 OpenAI Responses API 的 Structured Outputs：

```powershell
$env:OPENAI_API_KEY = "你的密钥"
$env:OPENAI_MODEL = "你选择的、支持 Structured Outputs 的模型"
python -m backend build --llm
```

LLM 输出受 JSON Schema、关系白名单、实体类型约束和原文证据检查四层限制。没有密钥时不要传 `--llm`。实现遵循[官方 OpenAI Responses API 文档](https://developers.openai.com/api/reference/resources/responses/methods/create)。

## 产物

| 文件 | 内容 |
| --- | --- |
| `artifacts/entities.jsonl` | 规范化实体及来源记录 |
| `artifacts/properties.jsonl` | 实体属性、证据、置信度与抽取方法 |
| `artifacts/relations.jsonl` | 结构化实体关系/三元组 |
| `artifacts/rejected.jsonl` | 被校验器拒绝的数据及原因 |
| `artifacts/extraction_report.json` | 本次构建统计 |
| `knowledge.db` | 可查询的 SQLite 知识库 |

当前全量规则构建结果：

- 输入记录：3,000；
- 实体：752；
- 属性：1,000；
- 关系：1,997；
- 拒绝：2 条自环关系；
- 处理失败：0。

## 命令参数

```bash
python -m backend build --help
python -m backend serve --help
```

可使用 `--limit 100` 快速构建样本库，也可用 `--input`、`--output` 和 `--database` 指定路径。

## API

- `GET /api/v1/health`
- `GET /api/v1/graph/stats`
- `GET /api/v1/graph/overview?limit=50`
- `GET /api/v1/graph/expand?entity_id=...&depth=1&limit=50`
- `GET /api/v1/entities/{id}`
- `GET /api/v1/entities/{id}/relations?direction=both&page=1&page_size=20`
- `GET /api/v1/search?keyword=百日咳&page=1&page_size=20`

成功和失败均返回统一 envelope，参数范围与错误码遵循 `docs/api.md`。

