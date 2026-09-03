from __future__ import annotations

from dataclasses import asdict, dataclass, field
from hashlib import sha256
from typing import Any


def stable_id(prefix: str, *parts: str) -> str:
    raw = "\x1f".join(str(part) for part in parts)
    return f"{prefix}_{sha256(raw.encode('utf-8')).hexdigest()[:16]}"


@dataclass
class Entity:
    id: str
    name: str
    type: str
    description: str = ""
    aliases: list[str] = field(default_factory=list)
    source_record_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Property:
    id: str
    entity_id: str
    key: str
    value: str
    confidence: float
    method: str
    evidence: str
    source_record_id: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Relation:
    id: str
    source_id: str
    target_id: str
    relation: str
    confidence: float
    method: str
    evidence: str
    source_record_id: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

