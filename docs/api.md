# 知识图谱系统 · 前后端接口契约（v1）

本文档是前端（图谱可视化，`frontend/`）与后端（数据采集 / 实体关系抽取 / 知识库）之间的接口契约。
**任何接口改动请先修改本文档，双方确认后再改代码。**

- 契约版本：v1（路径前缀 `/api/v1`）。不兼容变更时启用 `/api/v2`，不原地修改 v1 语义
- 设计基线：实体总量 ≥ 3000、数据类别 ≥ 100。因此**任何接口都不允许一次性返回全图**，
  图谱浏览采用「概览 + 按需展开」模式（见第 4 节）
- 前端不依赖固定服务器地址：默认请求同源相对路径，联调时的地址覆盖方式见 `frontend/README.md`

---

## 1. 通用约定

| 项目 | 约定 |
| --- | --- |
| 传输格式 | 请求与响应均为 `application/json; charset=utf-8` |
| 字符编码 | UTF-8 |
| 时间格式 | ISO 8601，如 `2026-09-02T10:00:00Z` |
| 跨域（CORS） | 开发阶段前端可能运行在独立端口或 `file://`，后端须允许跨域（开发环境建议 `Access-Control-Allow-Origin: *`）并正确响应 OPTIONS 预检 |
| 同源部署 | 演示/生产推荐由后端或反向代理静态托管 `frontend/`，此时前端走相对路径，无需 CORS |
| ID 规则 | 实体 `ent_` 前缀 + 数字（建议定长零填充，如 `ent_00012345`）；关系 `rel_` 前缀 + 数字 |

### 1.1 统一响应 envelope

所有接口（成功与失败）均返回：

```json
{ "code": 0, "message": "ok", "data": { } }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | int | `0` 成功；非 0 为业务错误码（见 1.2） |
| `message` | string | 成功固定 `ok`；失败为可直接展示给用户的中文错误描述 |
| `data` | object \| null | 成功时为业务数据（各接口定义见第 3 节）；失败时为 `null` 或含 `detail`、`request_id` 等补充信息的对象 |

HTTP 状态码与 `code` 前三位语义保持一致（如 `40401` → HTTP 404）。

### 1.2 错误码表

| code | HTTP | 含义 | 典型场景 |
| --- | --- | --- | --- |
| 0 | 200 | 成功 | — |
| 40001 | 400 | 参数错误 | 缺少 `keyword`、`page` 非法等 |
| 40002 | 400 | 参数超出上限 | `limit > 500`、`page_size > 100`、`depth > 2` |
| 40400 | 404 | 接口不存在 | 路径拼写错误 |
| 40401 | 404 | 资源不存在 | 实体 id 未找到 |
| 42901 | 429 | 请求过于频繁 | 预留 |
| 50000 | 500 | 服务器内部错误 | 未捕获异常 |
| 50001 | 500 | 知识库 / 抽取流水线异常 | 预留 |

错误响应示例：

```json
{
  "code": 40401,
  "message": "实体不存在",
  "data": { "detail": "未找到 id 为 ent_99999 的实体", "request_id": "req-20260902-000123" }
}
```

### 1.3 分页约定

列表类接口（搜索、实体关系）统一使用页码分页：

| 参数 | 类型 | 默认 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | int | 1 | ≥ 1 | 页码，从 1 开始 |
| `page_size` | int | 20 | 1 ~ 100 | 每页条数，超限返回 40002 |

响应中的 `pagination` 结构：

```json
{ "page": 1, "page_size": 20, "total": 35, "total_pages": 2 }
```

---

## 2. 通用数据结构

以下结构在多个接口中复用，字段命名以本节为准。完整示例可参考 `frontend/js/mock/mockData.js`。

### 2.1 EntitySummary（实体摘要）

```json
{ "id": "ent_00001", "name": "艾伦·图灵", "type": "person" }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 实体全局唯一 id |
| `name` | string | 实体名称（展示用） |
| `type` | string | 实体类型（见 2.2） |

### 2.2 实体类型（type）

建议枚举：`person`（人物）、`organization`（机构）、`location`（地点）、
`concept`（概念）、`event`（事件）、`work`（作品/文献）。

**`type` 为开放式字符串**：项目要求采集 100+ 类别数据，后端可按需扩展类型；
前端对未知类型使用默认配色，不会报错（配色表见 `frontend/js/graph/styles.js`）。

### 2.3 Entity（实体详情）

```json
{
  "id": "ent_00001",
  "name": "艾伦·图灵",
  "type": "person",
  "description": "英国数学家、逻辑学家，计算机科学与人工智能奠基人之一。",
  "properties": [
    { "key": "出生年份", "value": "1912" },
    { "key": "国籍", "value": "英国" }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` / `name` / `type` | — | 同 EntitySummary |
| `description` | string | 实体简介，可为空字符串 |
| `properties` | EntityProperty[] | 属性键值对列表，可为空数组 |

### 2.4 EntityProperty（实体属性）

```json
{ "key": "出生年份", "value": "1912" }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `key` | string | 属性名（中文，可直接展示） |
| `value` | string | 属性值统一为字符串，前端按需格式化 |

### 2.5 Relation（实体关系 · 业务展示用）

用于实体详情页的关系列表。`source` / `target` 内嵌摘要，前端无需二次查表：

```json
{
  "id": "rel_00001",
  "source": { "id": "ent_00001", "name": "艾伦·图灵", "type": "person" },
  "target": { "id": "ent_00009", "name": "伦敦", "type": "location" },
  "relation": "出生于",
  "confidence": 0.98
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 关系全局唯一 id |
| `source` | EntitySummary | 关系主体 |
| `target` | EntitySummary | 关系客体 |
| `relation` | string | 关系名称（谓词），如 出生于、就职于、研究 |
| `confidence` | float | 0~1，抽取置信度；前端对低置信关系弱化展示 |

三元组语义约定：**`source —(relation)→ target`**，如 `艾伦·图灵 —出生于→ 伦敦`。

### 2.6 GraphNode（图谱渲染节点）

```json
{ "id": "ent_00001", "name": "艾伦·图灵", "type": "person", "degree": 3 }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` / `name` / `type` | — | 同 EntitySummary |
| `degree` | int | 该实体在**全图**中的关系数（度数），由后端计算；前端用于节点大小与重要度排序 |

### 2.7 GraphEdge（图谱渲染边）

```json
{ "id": "rel_00001", "source": "ent_00001", "target": "ent_00009", "relation": "出生于", "weight": 0.98 }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 关系 id（同 Relation.id） |
| `source` / `target` | string | 节点 id，与 GraphNode.id 对应（注意：这里是裸 id，不是内嵌对象） |
| `relation` | string | 关系名称，显示在边上 |
| `weight` | float | 关系置信度，可用于边的粗细映射 |

### 2.8 GraphPayload（图子图数据）

`/graph/overview` 与 `/graph/expand` 的 `data` 结构：

```json
{
  "nodes": [ { "id": "ent_00001", "name": "艾伦·图灵", "type": "person", "degree": 3 } ],
  "edges": [ { "id": "rel_00001", "source": "ent_00001", "target": "ent_00009", "relation": "出生于", "weight": 0.98 } ],
  "total_nodes": 3218,
  "total_edges": 8942,
  "truncated": true
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `nodes` | GraphNode[] | 本次返回的节点 |
| `edges` | GraphEdge[] | 两端均在 `nodes` 内的边（不允许出现悬空边） |
| `total_nodes` / `total_edges` | int | **全图**规模（不是本次返回数量） |
| `truncated` | bool | 本次结果是否经过采样/截断；为 `true` 时前端提示「已采样展示」 |

---

## 3. 接口列表

| # | 方法 | 路径 | 用途 | 前端调用方 |
| --- | --- | --- | --- | --- |
| 1 | GET | `/api/v1/health` | 连通性检查 | `KG.api.graph.health()` |
| 2 | GET | `/api/v1/graph/stats` | 图谱统计概览 | `KG.api.graph.stats()` |
| 3 | GET | `/api/v1/graph/overview` | 初始概览子图 | `KG.api.graph.overview()` |
| 4 | GET | `/api/v1/graph/expand` | 邻居按需展开 | `KG.api.graph.expand()` |
| 5 | GET | `/api/v1/entities/{entityId}` | 实体详情 | `KG.api.graph.getEntity()` |
| 6 | GET | `/api/v1/entities/{entityId}/relations` | 实体关系（分页） | `KG.api.graph.getEntityRelations()` |
| 7 | GET | `/api/v1/search` | 实体搜索（分页） | `KG.api.graph.search()` |

### 3.1 GET /health

无参数。`data`：

```json
{ "status": "ok", "time": "2026-09-02T02:00:00Z", "version": "v1" }
```

### 3.2 GET /graph/stats

无参数。`data`：

```json
{
  "entity_count": 3218,
  "relation_count": 8942,
  "entity_type_distribution": { "person": 812, "concept": 1104, "organization": 402 },
  "relation_type_distribution": { "出生于": 231, "就职于": 158, "研究": 466 },
  "last_updated": "2026-09-01T16:00:00Z"
}
```

| 字段 | 说明 |
| --- | --- |
| `entity_count` / `relation_count` | 全图实体数 / 关系数 |
| `entity_type_distribution` | 实体类型 → 数量（前端据此生成图例） |
| `relation_type_distribution` | 关系名称 → 数量 |
| `last_updated` | 知识库最近一次更新时间 |

### 3.3 GET /graph/overview

返回初始展示的子图：按 `degree` **降序**取最重要的前 `limit` 个节点。
用于首页首屏；全图 3000+ 节点不允许一次性全量返回。

| 参数 | 类型 | 默认 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `limit` | int | 50 | 1 ~ 500 | 返回节点数上限，超限返回 40002 |
| `entity_type` | string | 无 | 可选 | 只返回该类型的节点 |

`data`：GraphPayload（通常 `truncated: true`）。

### 3.4 GET /graph/expand

以某实体为中心拉取其邻域子图。前端点击/双击节点时调用，是**支撑大规模图谱浏览的核心接口**。

| 参数 | 类型 | 默认 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `entity_id` | string | 必填 | — | 中心实体 id，不存在返回 40401 |
| `depth` | int | 1 | 1 ~ 2 | 展开深度 |
| `limit` | int | 50 | 1 ~ 500 | 返回节点数上限（**含**中心节点），超限返回 40002 |

`data`：GraphPayload。节点集合 = 中心实体 + 其 `depth` 层邻居；边只含两端都在集合内的关系。

### 3.5 GET /entities/{entityId}

路径参数 `entityId`。`data`：

```json
{
  "entity": {
    "id": "ent_00001",
    "name": "艾伦·图灵",
    "type": "person",
    "description": "英国数学家、逻辑学家，计算机科学与人工智能奠基人之一。",
    "properties": [ { "key": "出生年份", "value": "1912" } ]
  },
  "stats": { "out_relation_count": 3, "in_relation_count": 2, "total": 5 }
}
```

实体不存在时返回 40401。

### 3.6 GET /entities/{entityId}/relations

| 参数 | 类型 | 默认 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `direction` | string | `both` | `out` / `in` / `both` | `out` = 该实体发出的关系；`in` = 指向该实体的关系 |
| `page` / `page_size` | int | 见 1.3 | 分页 | — |

`data`：

```json
{
  "pagination": { "page": 1, "page_size": 20, "total": 5, "total_pages": 1 },
  "items": [
    {
      "id": "rel_00001",
      "source": { "id": "ent_00001", "name": "艾伦·图灵", "type": "person" },
      "target": { "id": "ent_00009", "name": "伦敦", "type": "location" },
      "relation": "出生于",
      "confidence": 0.98
    }
  ]
}
```

### 3.7 GET /search

| 参数 | 类型 | 默认 | 约束 | 说明 |
| --- | --- | --- | --- | --- |
| `keyword` | string | 必填 | 非空 | 匹配实体名称、description、属性值；为空返回 40001 |
| `entity_type` | string | 无 | 可选 | 类型过滤 |
| `page` / `page_size` | int | 见 1.3 | 分页 | — |

`data`：

```json
{
  "pagination": { "page": 1, "page_size": 20, "total": 2, "total_pages": 1 },
  "items": [
    {
      "entity": { "id": "ent_00001", "name": "艾伦·图灵", "type": "person", "description": "英国数学家……" },
      "matched_field": "name",
      "score": 0.9
    }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `items[].entity` | EntitySummary + `description` |
| `items[].matched_field` | 命中字段：`name` / `description` / `properties` |
| `items[].score` | 0~1 相关度，结果按 `score` 降序返回 |

---

## 4. 规模与性能约定（面向 3000+ 数据）

1. **任何接口不允许一次性返回全图**：overview / expand 受 `limit ≤ 500` 约束，列表接口受 `page_size ≤ 100` 约束
2. 图谱浏览采用「概览 + 按需展开」：初始 `overview` 展示重要节点（degree 降序），用户交互时 `expand` 邻域增量加载
3. `GraphNode.degree` 由后端基于全图计算并随图数据返回，供前端做尺寸映射与排序，口径以本条为准
4. `truncated: true` 时前端会提示采样状态，并通过搜索 / 展开引导用户探索剩余数据
5. 建议后端对实体 `name` 建索引，常规查询接口 P95 < 500ms
6. 未来数据量继续增长时，优先在 v1 内调整 `limit` 默认值与采样策略；确需游标分页等不兼容变更时启用 v2

---

## 5. 变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-09-02 | v1 | 初稿：7 个接口、统一 envelope 与错误码、8 个通用数据结构定稿（前端：wuziyang） |
