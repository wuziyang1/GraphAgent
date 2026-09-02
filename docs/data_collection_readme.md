# R大类医学文本数据采集说明

本文件说明本次提交的数据采集部分。该部分对应项目要求中的“采集不少于100个类别、总量不少于3000条的R大类文本数据”，供后续实体识别、关系抽取和知识图谱构建使用。

## 数据来源

数据来自开源中文医疗知识图谱项目 `QASystemOnMedicalKG` 中的 `data/medical.json` 文件。原始数据围绕疾病、症状、药品、检查、科室、食物等医学实体组织，已经包含疾病描述、病因、预防、治疗方式、检查项目、常用药物、推荐药物、宜吃食物、忌吃食物、并发疾病等真实字段和关系信息。

本次只抽取其中医学卫生相关内容，按中国图书馆分类法中的 R 大类理解为“医药、卫生”方向数据。

原始项目地址：

https://github.com/zhihao-chen/QASystemOnMedicalKG

## 提交文件

数据文件路径：

`data/r_medical_real_texts_3000.jsonl`

文件格式为 JSON Lines，即每一行是一条独立 JSON 记录。共 3000 行，每行可单独解析。

## 数据规模

| 指标 | 数量 |
| --- | ---: |
| 大类 | R |
| 类别数 | 100 |
| 文本记录数 | 3000 |
| 每个类别记录数 | 30 |
| 关系/事实类型数 | 20 |

本次将每一种疾病作为一个采集类别，类别编号为 `R001` 至 `R100`。每个疾病类别下抽取 30 条真实医学事实文本，因此总量为 100 * 30 = 3000 条。

## 字段说明

| 字段名 | 含义 |
| --- | --- |
| `id` | 数据记录编号 |
| `major_class` | 大类编号，固定为 `R` |
| `category_id` | 类别编号，例如 `R001` |
| `category_name` | 类别名称，即疾病名称 |
| `source_category` | 原始数据中的疾病分类路径 |
| `title` | 文本标题 |
| `text` | 用于信息抽取的真实医学文本 |
| `subject` | 三元组主语 |
| `predicate` | 三元组谓语 |
| `object` | 三元组宾语 |
| `fact_type` | 事实类型 |
| `source` | 数据来源说明 |

其中 `text` 字段可作为后续自然语言处理输入，`subject`、`predicate`、`object` 字段可作为知识图谱构建的参考三元组。

## 示例记录

```json
{"id":"R001_001","major_class":"R","category_id":"R001","category_name":"百日咳","source_category":["疾病百科","儿科","小儿内科"],"title":"百日咳-疾病简介","text":"百日咳是由百日咳杆菌所致的急性呼吸道传染病。其特征为阵发性痉挛性咳嗽，咳嗽终末伴有深长的鸡啼样吸气性吼声，病程较长，可达数周甚至3个月左右，故有百日咳之称。","subject":"百日咳","predicate":"疾病简介","object":"百日咳是由百日咳杆菌所致的急性呼吸道传染病。其特征为阵发性痉挛性咳嗽，咳嗽终末伴有深长的鸡啼样吸气性吼声，病程较长，可达数周甚至3个月左右，故有百日咳之称。","fact_type":"疾病简介","source":"QASystemOnMedicalKG medical.json"}
```

## 使用方式

Python 读取示例：

```python
import json

records = []
with open("data/r_medical_real_texts_3000.jsonl", "r", encoding="utf-8") as f:
    for line in f:
        records.append(json.loads(line))

print(len(records))
print(records[0]["text"])
print(records[0]["subject"], records[0]["predicate"], records[0]["object"])
```

如果后续模块需要直接构建知识图谱，可以先读取每行中的 `subject`、`predicate`、`object` 三个字段生成三元组；如果需要重新做实体识别和关系抽取，则使用 `text` 字段作为输入文本。

## 数据验证

已对提交文件进行数量检查：

- 总记录数：3000
- 类别数：100
- 每个类别记录数：30
- 大类字段：全部为 `R`
- 每条记录均包含 `text`、`subject`、`predicate`、`object`

因此该文件满足“R大类、不少于100个类别、总量不少于3000条文本数据”的数据采集要求。
