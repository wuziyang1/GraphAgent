"""Optional LLM enrichment through the OpenAI Responses API.

The core project never requires an API key. Enable this module explicitly with
``--llm`` and set OPENAI_API_KEY plus OPENAI_MODEL.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any


OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string", "enum": ["Pathogen", "Cause", "Population", "TransmissionMode"]},
                },
                "required": ["name", "type"],
            },
        },
        "relations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "source": {"type": "string"},
                    "predicate": {"type": "string", "enum": ["CAUSED_BY", "SUSCEPTIBLE_GROUP", "SPREADS_BY"]},
                    "target": {"type": "string"},
                    "target_type": {"type": "string", "enum": ["Pathogen", "Cause", "Population", "TransmissionMode"]},
                    "evidence": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["source", "predicate", "target", "target_type", "evidence", "confidence"],
            },
        },
    },
    "required": ["entities", "relations"],
}


def _output_text(response: dict[str, Any]) -> str:
    texts: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                texts.append(content.get("text", ""))
    if not texts:
        raise ValueError("模型响应中没有 output_text")
    return "".join(texts)


def extract(record: dict[str, Any], timeout: int = 60) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_MODEL")
    if not api_key or not model:
        raise RuntimeError("启用 LLM 时必须设置 OPENAI_API_KEY 和 OPENAI_MODEL")
    prompt = (
        "从医学文本中抽取有原文证据的关系。禁止使用外部常识；无法确认则返回空数组。"
        "evidence 必须是原文中的连续片段。疾病主实体已给出。\n"
        f"疾病：{record.get('subject') or record.get('category_name')}\n"
        f"事实类型：{record.get('predicate')}\n"
        f"文本：{record.get('text')}"
    )
    payload = {
        "model": model,
        "input": prompt,
        "store": False,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "medical_knowledge_extraction",
                "strict": True,
                "schema": OUTPUT_SCHEMA,
            }
        },
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM 请求失败（HTTP {exc.code}）：{detail[:500]}") from exc
    return json.loads(_output_text(body))

