from __future__ import annotations

import json
import sqlite3
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .extraction import CandidateRelation, extract_by_rule, normalize_name, validate_relation
from .models import Entity, Property, Relation, stable_id


@dataclass
class BuildReport:
    records_total: int = 0
    records_processed: int = 0
    entities: int = 0
    properties: int = 0
    relations: int = 0
    rejected: int = 0
    methods: dict[str, int] | None = None
    entity_types: dict[str, int] | None = None
    relation_types: dict[str, int] | None = None

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


class KnowledgeBuilder:
    def __init__(self, use_llm: bool = False):
        self.use_llm = use_llm
        self.entities: dict[tuple[str, str], Entity] = {}
        self.properties: dict[tuple[str, str, str], Property] = {}
        self.relations: dict[tuple[str, str, str], Relation] = {}
        self.rejected: list[dict[str, Any]] = []
        self.method_counts: Counter[str] = Counter()

    def entity(self, name: str, entity_type: str, record_id: str) -> Entity:
        clean = normalize_name(name)
        key = (entity_type, clean.casefold())
        if key not in self.entities:
            self.entities[key] = Entity(stable_id("ent", entity_type, clean.casefold()), clean, entity_type)
        entity = self.entities[key]
        if record_id not in entity.source_record_ids:
            entity.source_record_ids.append(record_id)
        return entity

    def reject(self, record: dict[str, Any], reason: str, stage: str = "rule") -> None:
        self.rejected.append({
            "record_id": record.get("id", ""),
            "stage": stage,
            "reason": reason,
            "predicate": record.get("predicate", ""),
        })

    def consume(self, record: dict[str, Any]) -> None:
        record_id = str(record.get("id", ""))
        outcome = extract_by_rule(record)
        for reason in outcome.rejected:
            self.reject(record, reason)
        for candidate in outcome.entities:
            self.entity(candidate.name, candidate.type, record_id)
        subject = self.entity(record.get("subject") or record.get("category_name"), "Disease", record_id)
        for candidate in outcome.properties:
            key = (subject.id, candidate.key, candidate.value)
            prop = Property(
                id=stable_id("prop", *key), entity_id=subject.id, key=candidate.key,
                value=candidate.value, confidence=candidate.confidence,
                method=candidate.method, evidence=normalize_name(record.get("text")),
                source_record_id=record_id,
            )
            self.properties.setdefault(key, prop)
            if candidate.key == "description" and not subject.description:
                subject.description = candidate.value
            self.method_counts[candidate.method] += 1
        for candidate in outcome.relations:
            self._add_relation(record, candidate)
        if self.use_llm and record.get("object") is None and record.get("predicate") in {"病因", "易感人群", "传播方式"}:
            self._consume_llm(record)

    def _add_relation(self, record: dict[str, Any], candidate: CandidateRelation) -> None:
        reason = validate_relation(candidate)
        if reason:
            self.reject(record, reason, candidate.method)
            return
        record_id = str(record.get("id", ""))
        source = self.entity(candidate.source, candidate.source_type, record_id)
        target = self.entity(candidate.target, candidate.target_type, record_id)
        key = (source.id, candidate.relation, target.id)
        relation = Relation(
            id=stable_id("rel", *key), source_id=source.id, target_id=target.id,
            relation=candidate.relation, confidence=candidate.confidence,
            method=candidate.method, evidence=candidate.evidence,
            source_record_id=record_id,
        )
        self.relations.setdefault(key, relation)
        self.method_counts[candidate.method] += 1

    def _consume_llm(self, record: dict[str, Any]) -> None:
        from .llm import extract
        try:
            result = extract(record)
        except Exception as exc:  # preserve the failed record and continue the batch
            self.reject(record, str(exc), "llm")
            return
        subject = normalize_name(record.get("subject") or record.get("category_name"))
        text = normalize_name(record.get("text"))
        for item in result.get("relations", []):
            evidence = normalize_name(item.get("evidence"))
            if not evidence or evidence not in text:
                self.reject(record, "LLM evidence 不在原文中", "llm")
                continue
            self._add_relation(record, CandidateRelation(
                source=subject, source_type="Disease", relation=item.get("predicate", ""),
                target=normalize_name(item.get("target")), target_type=item.get("target_type", ""),
                confidence=float(item.get("confidence", 0)), method="llm", evidence=evidence,
            ))

    def build(self, records: Iterable[dict[str, Any]]) -> BuildReport:
        total = 0
        processed = 0
        for total, record in enumerate(records, start=1):
            try:
                self.consume(record)
                processed += 1
            except Exception as exc:
                self.reject(record, f"未捕获处理错误：{exc}", "pipeline")
        return BuildReport(
            records_total=total, records_processed=processed,
            entities=len(self.entities), properties=len(self.properties), relations=len(self.relations),
            rejected=len(self.rejected), methods=dict(sorted(self.method_counts.items())),
            entity_types=dict(sorted(Counter(x.type for x in self.entities.values()).items())),
            relation_types=dict(sorted(Counter(x.relation for x in self.relations.values()).items())),
        )


def read_jsonl(path: Path, limit: int | None = None) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle):
            if limit is not None and index >= limit:
                break
            if line.strip():
                yield json.loads(line)


def write_jsonl(path: Path, items: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for item in items:
            handle.write(json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n")


SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS entities (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 aliases_json TEXT NOT NULL DEFAULT '[]', source_record_ids_json TEXT NOT NULL DEFAULT '[]',
 UNIQUE(type, name)
);
CREATE TABLE IF NOT EXISTS properties (
 id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES entities(id), key TEXT NOT NULL, value TEXT NOT NULL,
 confidence REAL NOT NULL, method TEXT NOT NULL, evidence TEXT NOT NULL, source_record_id TEXT NOT NULL,
 UNIQUE(entity_id, key, value)
);
CREATE TABLE IF NOT EXISTS relations (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES entities(id), target_id TEXT NOT NULL REFERENCES entities(id),
 relation TEXT NOT NULL, confidence REAL NOT NULL, method TEXT NOT NULL, evidence TEXT NOT NULL,
 source_record_id TEXT NOT NULL, UNIQUE(source_id, relation, target_id)
);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
"""


def write_database(path: Path, builder: KnowledgeBuilder) -> None:
    if path.exists():
        path.unlink()
    connection = sqlite3.connect(path)
    try:
        connection.executescript(SCHEMA)
        connection.executemany(
            "INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?)",
            [(x.id, x.name, x.type, x.description, json.dumps(x.aliases, ensure_ascii=False),
              json.dumps(x.source_record_ids, ensure_ascii=False)) for x in builder.entities.values()],
        )
        connection.executemany(
            "INSERT INTO properties VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(x.id, x.entity_id, x.key, x.value, x.confidence, x.method, x.evidence, x.source_record_id)
             for x in builder.properties.values()],
        )
        connection.executemany(
            "INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [(x.id, x.source_id, x.target_id, x.relation, x.confidence, x.method, x.evidence,
              x.source_record_id) for x in builder.relations.values()],
        )
        connection.commit()
    finally:
        connection.close()


def run_pipeline(input_path: Path, output_dir: Path, database_path: Path,
                 use_llm: bool = False, limit: int | None = None) -> BuildReport:
    output_dir.mkdir(parents=True, exist_ok=True)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    builder = KnowledgeBuilder(use_llm=use_llm)
    report = builder.build(read_jsonl(input_path, limit))
    write_jsonl(output_dir / "entities.jsonl", (x.to_dict() for x in builder.entities.values()))
    write_jsonl(output_dir / "properties.jsonl", (x.to_dict() for x in builder.properties.values()))
    write_jsonl(output_dir / "relations.jsonl", (x.to_dict() for x in builder.relations.values()))
    write_jsonl(output_dir / "rejected.jsonl", iter(builder.rejected))
    (output_dir / "extraction_report.json").write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    write_database(database_path, builder)
    return report

