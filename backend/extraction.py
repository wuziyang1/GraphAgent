from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any


RELATION_RULES: dict[str, tuple[str, str]] = {
    "所属分类": ("BELONGS_TO_CATEGORY", "Category"),
    "相关症状": ("HAS_SYMPTOM", "Symptom"),
    "并发疾病": ("HAS_COMPLICATION", "Disease"),
    "就诊科室": ("VISITS_DEPARTMENT", "Department"),
    "治疗方式": ("TREATED_BY", "Treatment"),
    "检查项目": ("NEEDS_CHECK", "Check"),
    "常用药物": ("USES_DRUG", "Drug"),
    "推荐药物": ("RECOMMENDS_DRUG", "Drug"),
    "宜吃食物": ("RECOMMENDS_FOOD", "Food"),
    "忌吃食物": ("AVOIDS_FOOD", "Food"),
    "在售药品": ("HAS_MARKETED_DRUG", "Drug"),
}

PROPERTY_RULES: dict[str, str] = {
    "疾病简介": "description",
    "病因": "cause",
    "预防措施": "prevention",
    "医保状态": "insurance_status",
    "患病比例": "prevalence",
    "易感人群": "susceptible_population",
    "传播方式": "transmission",
    "治疗周期": "treatment_period",
    "治愈概率": "cure_probability",
    "治疗费用": "treatment_cost",
}

RELATION_CONSTRAINTS: dict[str, tuple[set[str], set[str]]] = {
    relation: ({"Disease"}, {target_type})
    for relation, target_type in RELATION_RULES.values()
}
RELATION_CONSTRAINTS.update({
    "CAUSED_BY": ({"Disease"}, {"Pathogen", "Cause"}),
    "SUSCEPTIBLE_GROUP": ({"Disease"}, {"Population"}),
    "SPREADS_BY": ({"Disease"}, {"TransmissionMode"}),
})


def normalize_name(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip(" \t\r\n,，、;；。")
    return text


def property_value(record: dict[str, Any]) -> str:
    value = record.get("object")
    if value not in (None, ""):
        return normalize_name(value)
    text = normalize_name(record.get("text"))
    subject = re.escape(normalize_name(record.get("subject")))
    predicate = record.get("predicate", "")
    prefixes = {
        "医保状态": rf"^{subject}的医保状态为",
        "患病比例": rf"^{subject}的患病比例(?:约)?为",
        "易感人群": rf"^{subject}的易感人群(?:主要)?为",
        "传播方式": rf"^{subject}的传播方式(?:或传染方式)?为",
        "治疗周期": rf"^{subject}的治疗周期通常为",
        "治愈概率": rf"^{subject}的治愈概率(?:约)?为",
        "治疗费用": rf"^{subject}的治疗费用信息为",
    }
    if predicate in prefixes:
        cleaned = re.sub(prefixes[predicate], "", text).strip("，。；; ")
        return cleaned or text
    return text


def split_objects(value: Any) -> list[str]:
    if isinstance(value, list):
        raw = value
    elif value is None:
        raw = []
    else:
        # Existing source normally stores one object per row. Only split explicit
        # list delimiters; commas may be part of a medical entity name.
        raw = re.split(r"[|；;]", str(value))
    result: list[str] = []
    for item in raw:
        name = normalize_name(item)
        if name and name not in result:
            result.append(name)
    return result


@dataclass
class CandidateEntity:
    name: str
    type: str


@dataclass
class CandidateProperty:
    subject: str
    key: str
    value: str
    confidence: float = 1.0
    method: str = "rule"


@dataclass
class CandidateRelation:
    source: str
    source_type: str
    relation: str
    target: str
    target_type: str
    confidence: float = 1.0
    method: str = "rule"
    evidence: str = ""


@dataclass
class ExtractionResult:
    entities: list[CandidateEntity] = field(default_factory=list)
    properties: list[CandidateProperty] = field(default_factory=list)
    relations: list[CandidateRelation] = field(default_factory=list)
    rejected: list[str] = field(default_factory=list)


def extract_by_rule(record: dict[str, Any]) -> ExtractionResult:
    result = ExtractionResult()
    subject = normalize_name(record.get("subject") or record.get("category_name"))
    predicate = normalize_name(record.get("predicate"))
    evidence = normalize_name(record.get("text"))
    if not subject:
        result.rejected.append("缺少主实体")
        return result

    result.entities.append(CandidateEntity(subject, "Disease"))
    if predicate in RELATION_RULES:
        relation, target_type = RELATION_RULES[predicate]
        objects = split_objects(record.get("object"))
        if not objects:
            result.rejected.append(f"关系型记录 {predicate} 缺少客体")
            return result
        for target in objects:
            result.entities.append(CandidateEntity(target, target_type))
            result.relations.append(CandidateRelation(
                source=subject,
                source_type="Disease",
                relation=relation,
                target=target,
                target_type=target_type,
                confidence=1.0,
                method="source-structure",
                evidence=evidence,
            ))
    elif predicate in PROPERTY_RULES:
        value = property_value(record)
        if value:
            result.properties.append(CandidateProperty(
                subject=subject,
                key=PROPERTY_RULES[predicate],
                value=value,
                confidence=1.0 if record.get("object") not in (None, "") else 0.95,
                method="source-structure" if record.get("object") not in (None, "") else "rule",
            ))
        else:
            result.rejected.append(f"属性型记录 {predicate} 缺少值")
    else:
        result.rejected.append(f"未支持的谓词：{predicate}")
    return result


def validate_relation(relation: CandidateRelation) -> str | None:
    if not relation.source or not relation.target:
        return "关系主客体不能为空"
    if relation.source == relation.target:
        return "不允许自环关系"
    constraint = RELATION_CONSTRAINTS.get(relation.relation)
    if constraint is None:
        return f"关系不在白名单：{relation.relation}"
    sources, targets = constraint
    if relation.source_type not in sources or relation.target_type not in targets:
        return (
            f"关系类型不兼容：{relation.source_type}-[{relation.relation}]->"
            f"{relation.target_type}"
        )
    if not 0 <= relation.confidence <= 1:
        return "置信度必须在 0 到 1 之间"
    return None

