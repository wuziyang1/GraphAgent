# 知识图谱可视化前端

“智能体驱动的知识图谱自动构建系统”课程项目的前端部分，负责**知识图谱可视化浏览、实体查询与关系展示**。

- 纯 HTML + CSS + 原生 JavaScript，不引入 Vue / React / TypeScript / Webpack 等工程体系
- 图谱渲染使用 [Cytoscape.js](https://js.cytoscape.org/) 3.30.4：**优先加载本地 `vendor/` 副本，失败时自动回退 CDN**（答辩断网也能跑）
- 前后端通过 REST API（JSON）通信，接口契约见仓库根目录 [`docs/api.md`](../docs/api.md)
- 内置 Mock 数据层：后端未完成时前端可独立运行与演示
- 不依赖任何固定服务器地址（详见下文“配置说明”）

## 目录结构

```
frontend/
├── README.md                    # 本文件
├── .gitignore                   # 忽略 config.local.js 等本机私有文件
├── index.html                   # 图谱浏览主页（五区布局：顶栏统计 / 左搜索 / 中图谱 / 右详情 / 底状态栏）
├── pages/
│   ├── search.html              # 实体查询页（骨架，待开发）
│   └── entity.html              # 实体详情页（骨架，待开发）
├── css/
│   └── base.css                 # 全局基础样式 + 主页应用布局
├── vendor/
│   └── cytoscape.min.js         # Cytoscape.js 3.30.4 本地副本（离线答辩兜底）
└── js/
    ├── config.js                # 全局配置（全项目唯一允许出现 API 地址的文件）
    ├── config.local.example.js  # 本机私有配置模板（复制为 config.local.js 使用，不入库）
    ├── utils.js                 # 通用工具（选择器 / HTML 转义 / 防抖…）
    ├── api/
    │   ├── client.js            # fetch 封装：URL 拼接、超时、envelope 解析、统一 ApiError
    │   ├── validators.js        # 响应契约校验：坏数据友好报错 / 条目级容错，页面不崩溃
    │   └── graphApi.js          # 业务接口层：按 API_MODE 分流 Mock / 真实请求
    ├── mock/
    │   ├── mockData.js          # Mock 数据 + 大规模数据生成器
    │   └── mockAdapter.js       # Mock 接口实现（模拟 REST 行为，含分页与错误路径）
    ├── graph/
    │   ├── styles.js            # Cytoscape 视觉样式（类型配色、选中光晕、筛选弱化）
    │   ├── tooltip.js           # 节点/关系悬浮信息卡（单 DOM 复用、防溢出定位）
    │   └── renderer.js          # Cytoscape 渲染封装（GraphRenderer：布局/定位/增量并入）
    ├── entity/
    │   └── entity.js            # 实体查询模块（搜索四态 + 实体/关系详情面板，KG.entity）
    └── pages/
        ├── app.js               # index.html 入口（初始化 + 模块协调）
        ├── search.js            # search.html 入口
        └── entity.js            # entity.html 入口
```

## 快速开始

### 方式一：直接双击 index.html（零依赖，Mock 模式）

默认 `API_MODE = 'mock'`，双击 `frontend/index.html` 即可使用完整界面（图谱渲染 / 搜索 / 实体详情全部基于 Mock 数据）。
> 注意：`file://` 协议下浏览器会拦截跨域请求，此方式**只能使用 Mock 数据**。

### 方式二：本地静态服务器（推荐）

```bash
cd frontend
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

前端资源全部使用相对路径，部署在任何子目录下都能正常工作。

### 方式三：接入真实后端

1. 将 `js/config.js` 中 `API_MODE` 改为 `'real'`（或用下述任意覆盖方式，不改代码）
2. 保证 API 地址可达（见“配置说明”）

## 配置说明（API_MODE 与 API_BASE_URL）

**全项目只有 `js/config.js` 允许出现后端地址；禁止在任何页面/脚本里硬编码 `http://localhost:xxxx`。**

- `API_MODE = 'mock'`（**默认**）：使用内置 Mock 数据，后端未就绪时前端独立可跑
- `API_MODE = 'real'`：请求真实后端。真实请求代码已提前写好（`js/api/client.js` + `graphApi.js`），
  后端不存在时会得到「网络错误或服务器不可达」的友好提示，不会崩溃

`API_BASE_URL = ''`（空字符串）＝ **同源相对路径**：前端与后端部署在同一域名/端口
（或同一反向代理之后）时，无需任何配置即可工作。

覆盖优先级（高 → 低）：

| 优先级 | 方式 | 适用场景 |
| --- | --- | --- |
| 1 | URL 参数 `?mode=real&api=<地址>`（兼容旧 `?mock=0`） | 临时演示：`index.html?mode=real&api=http://192.168.1.20:8000`，不改代码，刷新即失效；`?api=same` 强制回到同源 |
| 2 | `localStorage`：`KG_API_MODE`、`KG_API_BASE_URL`（兼容旧 `KG_USE_MOCK`） | 联调：控制台执行 `localStorage.setItem('KG_API_MODE', 'real')` 与 `localStorage.setItem('KG_API_BASE_URL', 'http://192.168.1.20:8000')` 后刷新，对本机浏览器长期生效 |
| 3 | `js/config.local.js` | 长期固定使用某台后端：复制 `js/config.local.example.js`，并在 HTML 中取消对应 `<script>` 注释；该文件已被 gitignore，不会把个人地址提交进仓库 |
| 4 | `js/config.js` 默认值 | `API_MODE: 'mock'`、`API_BASE_URL: ''` |

非法值一律安全回退到 Mock（后端没接好时页面不会白屏）。

首页底部状态栏会实时显示当前生效的数据来源、API 健康状态与加载规模，便于演示时说明。

## Mock 数据

- 核心数据位于 `js/mock/mockData.js`（48 个演示实体 / 71 条关系，覆盖 6 种实体类型），字段与 `docs/api.md` 完全一致；含多种连接形态：一个实体连接多个实体（如「深度学习 → CNN/RNN/Transformer」）、多个实体连接同一实体（如辛顿/勒丘恩/本吉奥 → 图灵奖）
- `js/mock/mockAdapter.js` 模拟全部 REST 接口行为：分页、类型过滤、方向筛选、404/参数错误等错误路径，附带 ~150ms 模拟延迟
- **大规模压测**：把 `js/config.js` 中 `MOCK_SCALE_NODES` 设为 `3000`，会附加 3000 个程序生成的实体（确定性伪随机，每次一致），用于验证“概览 + 按需展开”策略与渲染性能

## CDN 与离线兜底

HTML 中先加载本地副本，再检测是否成功、失败时用 `document.write` 回退 jsDelivr CDN：

```html
<script src="vendor/cytoscape.min.js"></script>
<script>window.cytoscape || document.write('<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.30.4/dist/cytoscape.min.js"><\/script>');</script>
```

因此默认断网可用；如需更换 CDN（bootcdn / staticfile 等国内源），只改各 HTML 中这一处地址即可。

升级 Cytoscape 版本时：替换 `vendor/cytoscape.min.js` 并同步修改 HTML 里的回退地址。

## 与后端联调流程

1. **后端实现**：按仓库根目录 [`docs/api.md`](../docs/api.md) 实现接口（唯一契约，改动先改文档、双方确认）。
   第 5 节有按优先级的实现清单（P0：health / stats / overview / search；P1：实体详情 / 关系 / expand）
   与逐接口 curl 自测示例，后端同学可独立自查
2. **后端跨域**：开发环境建议 `Access-Control-Allow-Origin: *` 并正确响应 OPTIONS 预检
   （前端独立端口联调时需要；同源部署则不需要）
3. **前端切换验证**：地址栏打开
   `index.html?mode=real&api=http://<后端地址>:<端口>`，
   底部状态栏「API 状态」变绿即连通，此时整页已是真实数据——不改任何代码
4. **长期固化**（三选一）：
   - 控制台 `localStorage.setItem('KG_API_MODE', 'real')` + `localStorage.setItem('KG_API_BASE_URL', 'http://<后端地址>')`
   - 复制 `js/config.local.example.js` 为 `js/config.local.js` 并在 HTML 取消对应注释（gitignore，不入库）
   - 直接改 `js/config.js` 的 `API_MODE`
5. **最终演示**：推荐同源部署——由后端（或 Nginx）静态托管 `frontend/` 目录，前端走相对路径，
   无需 CORS、无需任何配置
6. **数据对不齐时**：界面会显示「后端数据不符合接口契约：…」的友好提示（不会崩溃），
   浏览器控制台的 `[validators]` warn 会写明被丢弃的条目与原因，对照 `docs/api.md` 第 2 节修字段即可；
   后端不可达 / 超时则显示「网络错误或服务器不可达」提示

## 编码约定

- 所有脚本挂全局命名空间 `window.KG`（KG = Knowledge Graph）；经典 `<script>` 按依赖顺序加载，无模块构建，`file://` 直开可用
- 页面入口统一放 `js/pages/<page>.js`，在 `DOMContentLoaded` 中初始化
- 分层职责（避免入口脚本变成大杂烩）：`api/` 只管请求与 Mock 分流、`graph/` 只管画布渲染与交互、`entity/` 只管搜索与详情面板；`pages/app.js` 只做初始化和模块协调（模块间通过回调钩子通信），不写业务细节
- 新增页面步骤：`pages/xxx.html` → `js/pages/xxx.js` → HTML 末尾按序引入 `config / utils / api(/mock) / 页面脚本`
- 接口响应在 API 层统一过 `KG.api.validators` 契约校验（`js/api/validators.js`）后才能进页面，页面不直接消费未校验的数据
- 接口数据渲染进页面前一律用 `KG.utils.escapeHtml` 转义
- 图谱相关代码只改 `js/graph/` 下的文件，页面不直接操作 cytoscape 实例

## 开发顺序（建议）

1. ✅ 首页图谱渲染：`app.js` 调 `overview()` → `GraphRenderer.setData()`，含 loading / 错误态
2. ✅ 首页交互：点击节点 / 搜索结果 / 相关实体显示详情，点击关系边显示关系详情，类型筛选联动画布
3. ✅ 知识图谱浏览：滚轮缩放 / 拖拽画布与节点、节点与关系 hover 悬浮卡、实体详情（属性 / 出边 / 入边 / 关联实体）、工具栏放大缩小 / 适配 / 重置、双击节点调 `expand()` 增量展开邻居（3000+ 数据时的“按需展开”）
4. ✅ 首页实体查询：左侧面板搜索（精确 / 模糊 / 类型筛选，请求统一走 `graphApi.js`），加载中 / 成功 / 无结果 / 失败四态齐全；点击结果自动定位高亮画布节点（不在画布时先 `expand()` 并入）并在右侧显示详情
5. ⬜ 独立搜索页：`search()` + 结果列表 + 分页（首页左侧搜索已覆盖主流程，独立页可做高级筛选与分页）
6. ⬜ 独立实体详情页：`getEntity()` 属性表 + `getEntityRelations()` 关系表（方向筛选 + 分页）
7. ⬜ 体验打磨：布局切换、低置信关系弱化、搜索定位过渡动画
8. ⬜ 与后端联调（切换机制与契约校验已就绪：`?mode=real&api=…` 免改码切换、响应格式不符时友好报错；待后端按 `docs/api.md` 实现后对齐字段）
9. ⬜ 性能验证：`MOCK_SCALE_NODES = 3000` 压测，必要时调整采样/布局策略
