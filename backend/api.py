from __future__ import annotations

import json
import math
import sqlite3
import urllib.parse
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Iterator


class ApiProblem(Exception):
    def __init__(self, code: int, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def entity_summary(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "type": row["type"]}


class KnowledgeRepository:
    def __init__(self, database_path: Path):
        self.database_path = database_path

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
        finally:
            connection.close()

    def stats(self) -> dict[str, Any]:
        with self.connect() as db:
            entities = db.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
            relations = db.execute("SELECT COUNT(*) FROM relations").fetchone()[0]
            entity_dist = dict(db.execute("SELECT type, COUNT(*) FROM entities GROUP BY type").fetchall())
            relation_dist = dict(db.execute("SELECT relation, COUNT(*) FROM relations GROUP BY relation").fetchall())
        return {
            "entity_count": entities, "relation_count": relations,
            "entity_type_distribution": entity_dist,
            "relation_type_distribution": relation_dist,
            "last_updated": datetime.fromtimestamp(self.database_path.stat().st_mtime, timezone.utc).isoformat(),
        }

    def _graph_payload(self, db: sqlite3.Connection, ids: list[str], total: tuple[int, int]) -> dict[str, Any]:
        if not ids:
            return {"nodes": [], "edges": [], "total_nodes": total[0], "total_edges": total[1], "truncated": False}
        marks = ",".join("?" for _ in ids)
        nodes = db.execute(
            f"""SELECT e.id, e.name, e.type, COUNT(r.id) degree FROM entities e
            LEFT JOIN relations r ON r.source_id=e.id OR r.target_id=e.id
            WHERE e.id IN ({marks}) GROUP BY e.id ORDER BY degree DESC, e.name""", ids
        ).fetchall()
        edges = db.execute(
            f"SELECT * FROM relations WHERE source_id IN ({marks}) AND target_id IN ({marks})",
            ids + ids,
        ).fetchall()
        return {
            "nodes": [{"id": n["id"], "name": n["name"], "type": n["type"], "degree": n["degree"]} for n in nodes],
            "edges": [{"id": e["id"], "source": e["source_id"], "target": e["target_id"],
                       "relation": e["relation"], "weight": e["confidence"]} for e in edges],
            "total_nodes": total[0], "total_edges": total[1], "truncated": len(ids) < total[0],
        }

    def overview(self, limit: int, entity_type: str | None) -> dict[str, Any]:
        with self.connect() as db:
            total = (db.execute("SELECT COUNT(*) FROM entities").fetchone()[0],
                     db.execute("SELECT COUNT(*) FROM relations").fetchone()[0])
            sql = """SELECT e.id, COUNT(r.id) degree FROM entities e
                LEFT JOIN relations r ON r.source_id=e.id OR r.target_id=e.id"""
            args: list[Any] = []
            if entity_type:
                sql += " WHERE e.type=?"
                args.append(entity_type)
            sql += " GROUP BY e.id ORDER BY degree DESC, e.name LIMIT ?"
            args.append(limit)
            ids = [r["id"] for r in db.execute(sql, args)]
            return self._graph_payload(db, ids, total)

    def expand(self, entity_id: str, depth: int, limit: int) -> dict[str, Any]:
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM entities WHERE id=?", (entity_id,)).fetchone():
                raise ApiProblem(40401, "实体不存在", 404)
            total = (db.execute("SELECT COUNT(*) FROM entities").fetchone()[0],
                     db.execute("SELECT COUNT(*) FROM relations").fetchone()[0])
            visited = {entity_id}
            frontier = deque([(entity_id, 0)])
            while frontier and len(visited) < limit:
                current, level = frontier.popleft()
                if level >= depth:
                    continue
                rows = db.execute(
                    "SELECT source_id, target_id FROM relations WHERE source_id=? OR target_id=?", (current, current)
                )
                for row in rows:
                    other = row["target_id"] if row["source_id"] == current else row["source_id"]
                    if other not in visited:
                        visited.add(other)
                        frontier.append((other, level + 1))
                    if len(visited) >= limit:
                        break
            return self._graph_payload(db, list(visited), total)

    def entity(self, entity_id: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute("SELECT * FROM entities WHERE id=?", (entity_id,)).fetchone()
            if not row:
                raise ApiProblem(40401, "实体不存在", 404)
            props = db.execute("SELECT key, value FROM properties WHERE entity_id=? ORDER BY key", (entity_id,))
            out_count = db.execute("SELECT COUNT(*) FROM relations WHERE source_id=?", (entity_id,)).fetchone()[0]
            in_count = db.execute("SELECT COUNT(*) FROM relations WHERE target_id=?", (entity_id,)).fetchone()[0]
            return {
                "entity": {**entity_summary(row), "description": row["description"],
                           "properties": [{"key": p["key"], "value": p["value"]} for p in props]},
                "stats": {"out_relation_count": out_count, "in_relation_count": in_count,
                          "total": out_count + in_count},
            }

    def relations(self, entity_id: str, direction: str, page: int, page_size: int) -> dict[str, Any]:
        with self.connect() as db:
            if not db.execute("SELECT 1 FROM entities WHERE id=?", (entity_id,)).fetchone():
                raise ApiProblem(40401, "实体不存在", 404)
            clauses = {"out": "r.source_id=?", "in": "r.target_id=?", "both": "(r.source_id=? OR r.target_id=?)"}
            params: list[Any] = [entity_id, entity_id] if direction == "both" else [entity_id]
            where = clauses[direction]
            total = db.execute(f"SELECT COUNT(*) FROM relations r WHERE {where}", params).fetchone()[0]
            rows = db.execute(
                f"""SELECT r.*, s.name source_name, s.type source_type, t.name target_name, t.type target_type
                FROM relations r JOIN entities s ON s.id=r.source_id JOIN entities t ON t.id=r.target_id
                WHERE {where} ORDER BY r.relation, r.id LIMIT ? OFFSET ?""",
                params + [page_size, (page - 1) * page_size],
            )
            items = [{
                "id": r["id"],
                "source": {"id": r["source_id"], "name": r["source_name"], "type": r["source_type"]},
                "target": {"id": r["target_id"], "name": r["target_name"], "type": r["target_type"]},
                "relation": r["relation"], "confidence": r["confidence"],
            } for r in rows]
            return {"pagination": pagination(page, page_size, total), "items": items}

    def search(self, keyword: str, entity_type: str | None, page: int, page_size: int) -> dict[str, Any]:
        pattern = f"%{keyword}%"
        with self.connect() as db:
            filters = ["(e.name LIKE ? OR e.description LIKE ? OR EXISTS (SELECT 1 FROM properties p WHERE p.entity_id=e.id AND p.value LIKE ?))"]
            params: list[Any] = [pattern, pattern, pattern]
            if entity_type:
                filters.append("e.type=?")
                params.append(entity_type)
            where = " AND ".join(filters)
            total = db.execute(f"SELECT COUNT(*) FROM entities e WHERE {where}", params).fetchone()[0]
            rows = db.execute(
                f"""SELECT e.* FROM entities e WHERE {where}
                ORDER BY CASE WHEN e.name=? THEN 0 WHEN e.name LIKE ? THEN 1 ELSE 2 END, e.name
                LIMIT ? OFFSET ?""", params + [keyword, f"{keyword}%", page_size, (page - 1) * page_size]
            ).fetchall()
            items = []
            for row in rows:
                field = "name" if keyword in row["name"] else "description"
                if field == "description" and keyword not in row["description"]:
                    field = "properties"
                score = 1.0 if row["name"] == keyword else 0.9 if row["name"].startswith(keyword) else 0.8 if field == "name" else 0.6 if field == "description" else 0.5
                items.append({"entity": {**entity_summary(row), "description": row["description"]},
                              "matched_field": field, "score": score})
            return {"pagination": pagination(page, page_size, total), "items": items}


def pagination(page: int, page_size: int, total: int) -> dict[str, int]:
    return {"page": page, "page_size": page_size, "total": total,
            "total_pages": math.ceil(total / page_size) if total else 0}


def integer(params: dict[str, list[str]], name: str, default: int, low: int, high: int) -> int:
    try:
        value = int(params.get(name, [str(default)])[0])
    except ValueError as exc:
        raise ApiProblem(40001, f"{name} 必须是整数", 400) from exc
    if not low <= value <= high:
        raise ApiProblem(40002, f"{name} 必须在 {low} 到 {high} 之间", 400)
    return value


def create_handler(repository: KnowledgeRepository) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "GraphAgent/1.0"

        def send_json(self, status: int, code: int, message: str, data: Any) -> None:
            body = json.dumps({"code": code, "message": message, "data": data}, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:  # noqa: N802
            self.send_json(204, 0, "ok", None)

        def do_GET(self) -> None:  # noqa: N802
            try:
                parsed = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
                path = parsed.path.rstrip("/")
                if path == "/api/v1/health":
                    data = {"status": "ok", "time": datetime.now(timezone.utc).isoformat(), "version": "v1"}
                elif path == "/api/v1/graph/stats":
                    data = repository.stats()
                elif path == "/api/v1/graph/overview":
                    data = repository.overview(integer(params, "limit", 50, 1, 500), first(params, "entity_type"))
                elif path == "/api/v1/graph/expand":
                    entity_id = required(params, "entity_id")
                    data = repository.expand(entity_id, integer(params, "depth", 1, 1, 2), integer(params, "limit", 50, 1, 500))
                elif path.startswith("/api/v1/entities/") and path.endswith("/relations"):
                    entity_id = urllib.parse.unquote(path.split("/")[-2])
                    direction = first(params, "direction") or "both"
                    if direction not in {"out", "in", "both"}:
                        raise ApiProblem(40001, "direction 必须为 out、in 或 both", 400)
                    data = repository.relations(entity_id, direction, integer(params, "page", 1, 1, 1_000_000), integer(params, "page_size", 20, 1, 100))
                elif path.startswith("/api/v1/entities/"):
                    data = repository.entity(urllib.parse.unquote(path.split("/")[-1]))
                elif path == "/api/v1/search":
                    keyword = required(params, "keyword").strip()
                    if not keyword:
                        raise ApiProblem(40001, "keyword 不能为空", 400)
                    data = repository.search(keyword, first(params, "entity_type"), integer(params, "page", 1, 1, 1_000_000), integer(params, "page_size", 20, 1, 100))
                else:
                    raise ApiProblem(40400, "接口不存在", 404)
                self.send_json(200, 0, "ok", data)
            except ApiProblem as exc:
                self.send_json(exc.status, exc.code, exc.message, None)
            except Exception as exc:
                self.send_json(500, 50000, "服务器内部错误", {"detail": str(exc)})

        def log_message(self, fmt: str, *args: Any) -> None:
            print(f"[api] {self.address_string()} {fmt % args}")

    return Handler


def first(params: dict[str, list[str]], name: str) -> str | None:
    values = params.get(name)
    return values[0] if values else None


def required(params: dict[str, list[str]], name: str) -> str:
    value = first(params, name)
    if value is None or not value.strip():
        raise ApiProblem(40001, f"{name} 不能为空", 400)
    return value


def serve(database_path: Path, host: str = "127.0.0.1", port: int = 8000) -> None:
    if not database_path.exists():
        raise FileNotFoundError(f"知识库不存在：{database_path}；请先运行 build")
    server = ThreadingHTTPServer((host, port), create_handler(KnowledgeRepository(database_path)))
    print(f"GraphAgent API: http://{host}:{port}/api/v1/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
