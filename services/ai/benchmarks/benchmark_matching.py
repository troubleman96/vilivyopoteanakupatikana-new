#!/usr/bin/env python3
"""Synthetic pre-launch matching benchmark; never use real reports or PII."""

from __future__ import annotations

import argparse
import json
import random
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path


CASES = [
    {
        "name": "english",
        "query": {
            "record_id": "bench-en-query",
            "category": "backpack",
            "description": "black backpack with orange zipper found near a reading desk",
            "observed_date": "2026-09-12",
            "location": "Example University library",
        },
        "positive": {
            "record_id": "bench-en-positive",
            "category": "backpack",
            "description": "dark backpack with orange zip discovered beside the library study table",
            "observed_date": "2026-09-13",
            "location": "Example University library",
        },
    },
    {
        "name": "swahili",
        "query": {
            "record_id": "bench-sw-query",
            "category": "simu",
            "description": "Nimepoteza simu nyeusi yenye kioo kilichopasuka karibu na maktaba.",
            "observed_date": "2026-09-12",
            "location": "Maktaba ya Example University",
        },
        "positive": {
            "record_id": "bench-sw-positive",
            "category": "simu",
            "description": "Simu ya rangi nyeusi ilipatikana karibu na maktaba; skrini ina ufa.",
            "observed_date": "2026-09-13",
            "location": "Maktaba ya Example University",
        },
    },
    {
        "name": "code_switching",
        "query": {
            "record_id": "bench-cs-query",
            "category": "chupa ya maji",
            "description": "Lost my blue chupa ya maji with stickers near the hostel.",
            "observed_date": "2026-09-12",
            "location": "Example University hostel",
        },
        "positive": {
            "record_id": "bench-cs-positive",
            "category": "chupa ya maji",
            "description": "Chupa ya maji blue with stickers found by the hosteli.",
            "observed_date": "2026-09-13",
            "location": "Example University hostel",
        },
    },
    {
        "name": "typos",
        "query": {
            "record_id": "bench-ty-query",
            "category": "wallet",
            "description": "gray walet with small brass snap and stiched edge",
            "observed_date": "2026-09-12",
            "location": "Example University laboratory",
        },
        "positive": {
            "record_id": "bench-ty-positive",
            "category": "wallet",
            "description": "grey wallet with a small brass clasp and stitched border",
            "observed_date": "2026-09-13",
            "location": "Example University laboratory",
        },
    },
    {
        "name": "near_duplicates",
        "query": {
            "record_id": "bench-nd-query",
            "category": "bottle",
            "description": "matte green 750 ml water bottle with screw top and worn white label",
            "observed_date": "2026-09-12",
            "location": "Example University sports hall",
        },
        "positive": {
            "record_id": "bench-nd-positive",
            "category": "bottle",
            "description": "green matte bottle 750ml, threaded cap and faded pale label",
            "observed_date": "2026-09-12",
            "location": "Example University sports hall",
        },
    },
]

DISTRACTOR_TEXT = [
    ("umbrella", "folding red umbrella with wooden handle"),
    ("keys", "small silver keyring with a yellow tag"),
    ("notebook", "spiral notebook with blank blue cover"),
    ("headphones", "wired headphones with one black ear cushion"),
    ("jacket", "light jacket found by the cafeteria"),
    ("kitabu", "kitabu cha bluu kilicho na kurasa tupu"),
    ("kofia", "kofia nyekundu ilipatikana karibu na uwanja"),
    ("bag", "black bag with a plain zipper and no visible tag"),
    ("chaja", "chaja nyeupe ya simu iliyopatikana darasani"),
    ("bottle", "clear plastic bottle with a blue lid"),
    ("calculator", "scientific calculator with gray buttons"),
    ("glasses", "reading glasses in a dark hard case"),
]


def synthetic_distractors(count: int) -> list[dict[str, str]]:
    rng = random.Random(4152026)
    rows = []
    for index in range(count):
        category, description = DISTRACTOR_TEXT[index % len(DISTRACTOR_TEXT)]
        rows.append(
            {
                "record_id": f"bench-distractor-{index:04d}",
                "category": category,
                "description": f"{description}; synthetic variant {rng.randrange(100000, 999999)}",
                "observed_date": date(2026, 8, 1 + (index % 28)).isoformat(),
                "location": f"Example University area {index % 17}",
            }
        )
    return rows


def call_service(base_url: str, payload: dict, timeout: float) -> dict:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/v1/matches",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read(512).decode("utf-8", errors="replace")
        raise RuntimeError(f"Matching service returned HTTP {error.code}: {detail}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:18090")
    parser.add_argument("--distractors", type=int, default=1000)
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    args = parser.parse_args()
    if args.distractors < 1000:
        parser.error("--distractors must be at least 1000")
    distractors = synthetic_distractors(args.distractors)
    report = {
        "dataset": "synthetic_only",
        "distractors_per_case": args.distractors,
        "cases": [],
    }
    for case in CASES:
        payload = {
            "query": case["query"],
            "candidates": [case["positive"], *distractors],
        }
        started = time.monotonic()
        result = call_service(args.base_url, payload, args.timeout)
        elapsed = round(time.monotonic() - started, 3)
        suggestions = result.get("suggestions", [])
        positions = [
            suggestion["rank"]
            for suggestion in suggestions
            if suggestion.get("candidate_id") == case["positive"]["record_id"]
        ]
        report["cases"].append(
            {
                "name": case["name"],
                "candidate_count": len(payload["candidates"]),
                "top_five_hit": bool(positions),
                "positive_rank": positions[0] if positions else None,
                "returned_count": len(suggestions),
                "ranking": result.get("ranking"),
                "elapsed_seconds": elapsed,
                "top_five_ids": [item.get("candidate_id") for item in suggestions],
            }
        )
    report["summary"] = {
        "top_five_hits": sum(item["top_five_hit"] for item in report["cases"]),
        "case_count": len(report["cases"]),
        "all_top_five": all(item["top_five_hit"] for item in report["cases"]),
        "max_elapsed_seconds": max(item["elapsed_seconds"] for item in report["cases"]),
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if report["summary"]["all_top_five"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
