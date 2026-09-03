from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from backend.api import KnowledgeRepository
from backend.extraction import extract_by_rule
from backend.pipeline import run_pipeline


class ExtractionTests(unittest.TestCase):
    def test_relation_record(self) -> None:
        result = extract_by_rule({
            "subject": "百日咳", "predicate": "相关症状", "object": "痉挛性咳嗽",
            "text": "百日咳的相关症状包括痉挛性咳嗽。",
        })
        self.assertEqual(result.relations[0].relation, "HAS_SYMPTOM")
        self.assertEqual(result.relations[0].target_type, "Symptom")

    def test_property_record(self) -> None:
        result = extract_by_rule({
            "subject": "百日咳", "predicate": "治疗周期", "object": None,
            "text": "百日咳的治疗周期通常为1-2个月。",
        })
        self.assertEqual(result.properties[0].key, "treatment_period")
        self.assertEqual(result.properties[0].value, "1-2个月")


class PipelineTests(unittest.TestCase):
    def test_build_and_query(self) -> None:
        records = [
            {"id": "1", "category_name": "百日咳", "subject": "百日咳", "predicate": "疾病简介",
             "object": None, "text": "百日咳是一种呼吸道传染病。"},
            {"id": "2", "category_name": "百日咳", "subject": "百日咳", "predicate": "相关症状",
             "object": "咳嗽", "text": "百日咳的相关症状包括咳嗽。"},
        ]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input.jsonl"
            source.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records), encoding="utf-8")
            report = run_pipeline(source, root / "artifacts", root / "knowledge.db")
            self.assertEqual(report.entities, 2)
            self.assertEqual(report.relations, 1)
            repository = KnowledgeRepository(root / "knowledge.db")
            result = repository.search("百日咳", None, 1, 20)
            self.assertEqual(result["pagination"]["total"], 1)
            graph = repository.overview(50, None)
            self.assertEqual(len(graph["nodes"]), 2)


if __name__ == "__main__":
    unittest.main()

