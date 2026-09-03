from __future__ import annotations

import argparse
import json
from pathlib import Path

from .api import serve
from .pipeline import run_pipeline


ROOT = Path(__file__).resolve().parents[1]


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="GraphAgent 医学知识抽取与查询服务")
    sub = result.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="从 JSONL 抽取知识并构建 SQLite 知识库")
    build.add_argument("--input", type=Path, default=ROOT / "data" / "r_medical_real_texts_3000.jsonl")
    build.add_argument("--output", type=Path, default=ROOT / "artifacts")
    build.add_argument("--database", type=Path, default=ROOT / "knowledge.db")
    build.add_argument("--limit", type=int)
    build.add_argument("--llm", action="store_true", help="对病因/人群/传播文本启用可选 LLM 补充抽取")
    api = sub.add_parser("serve", help="启动与 docs/api.md 一致的 REST API")
    api.add_argument("--database", type=Path, default=ROOT / "knowledge.db")
    api.add_argument("--host", default="127.0.0.1")
    api.add_argument("--port", type=int, default=8000)
    return result


def main() -> None:
    args = parser().parse_args()
    if args.command == "build":
        report = run_pipeline(args.input, args.output, args.database, args.llm, args.limit)
        print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    else:
        serve(args.database, args.host, args.port)


if __name__ == "__main__":
    main()

