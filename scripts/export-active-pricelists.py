#!/usr/bin/env python3
"""Read-only, one-time export of active S.O.K. price lists from legacy SQLite."""

from __future__ import annotations

import argparse
import datetime as dt
import decimal
import hashlib
import json
import pathlib
import sqlite3
import sys
from typing import Any


FORMAT = "sok-active-pricelists"
FORMAT_VERSION = 1
TYPES = ("rury", "studnie", "preco")
OVERRIDE_PREFIX = "pricelist_active_override_"
MONEY_FIELDS = {
    "pricelist_item_rury": ("price", "transport"),
    "pricelist_item_studnie": (
        "price", "transport", "cena1", "cena2", "cena3", "doplataPEHD",
        "doplataZelbet", "doplataDrabNierdzewna", "malowanieWewnetrzne",
        "malowanieZewnetrzne",
    ),
    "pricelist_item_preco_kinety": ("cena",),
}
FLOAT_FIELDS = {
    "pricelist_item_rury": ("weight", "area"),
    "pricelist_item_studnie": ("weight", "area", "areaExt"),
}
TABLES = {
    "pricelist_item_rury": "PricelistItemRury",
    "pricelist_item_studnie": "PricelistItemStudnie",
    "pricelist_item_preco_konfig": "PricelistItemPrecoKonfig",
    "pricelist_item_preco_kinety": "PricelistItemPrecoKinety",
    "pricelist_item_preco_zakresy": "PricelistItemPrecoZakresy",
}
REQUIRED_TABLES = {
    "rury": ("PricelistItemRury",),
    "studnie": ("PricelistItemStudnie",),
    "preco": (
        "PricelistItemPrecoKonfig",
        "PricelistItemPrecoKinety",
        "PricelistItemPrecoZakresy",
    ),
}


def utc_datetime(value: str) -> dt.datetime:
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"Niepoprawny timestamp effectiveFrom: {value!r}") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"effectiveFrom bez strefy czasowej: {value!r}")
    return parsed.astimezone(dt.timezone.utc)


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    rows = connection.execute(f'PRAGMA table_info("{table}")').fetchall()
    if not rows:
        raise ValueError(f"Brak wymaganej tabeli {table}")
    return {str(row[1]) for row in rows}


def required_columns(connection: sqlite3.Connection, table: str, columns: tuple[str, ...]) -> None:
    actual = table_columns(connection, table)
    missing = sorted(set(columns) - actual)
    if missing:
        raise ValueError(f"Tabela {table} niezgodna ze schematem; brak kolumn: {', '.join(missing)}")


def decimal_text(value: Any, field: str) -> str | None:
    if value is None:
        return None
    parsed = decimal.Decimal(str(value))
    quantized = parsed.quantize(decimal.Decimal("0.01"), rounding=decimal.ROUND_HALF_UP)
    if parsed != quantized:
        raise ValueError(f"Kwota {field} ma więcej niż 2 miejsca dziesiętne: {value!r}")
    return format(quantized, ".2f")


def export(source: pathlib.Path, exported_at: dt.datetime) -> dict[str, Any]:
    uri = f"{source.resolve().as_uri()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True, isolation_level=None)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only = ON")
        connection.execute("BEGIN")
        required_columns(connection, "PricelistVersion", (
            "id", "type", "seq", "version", "status", "effectiveFrom", "createdBy",
            "note", "labelOverride", "sha256", "createdAt", "updatedAt", "approvedBy",
            "approvedAt", "approvalStatus",
        ))
        required_columns(connection, "settings", ("key", "value"))
        expected_item_columns = {
            "PricelistItemRury": ("id", "versionId", "name", "category", "price", "transport", "weight", "area"),
            "PricelistItemStudnie": (
                "id", "versionId", "name", "category", "componentType", "dn", "height", "weight",
                "price", "area", "areaExt", "transport", "magazynWL", "magazynKLB",
                "formaStandardowa", "formaStandardowaKLB", "active", "zapasDol", "zapasGora",
                "zapasDolMin", "zapasGoraMin", "spocznikH", "hMin1", "hMax1", "hMin2",
                "hMax2", "hMin3", "hMax3", "cena1", "cena2", "cena3", "doplataPEHD",
                "doplataZelbet", "doplataDrabNierdzewna", "malowanieWewnetrzne", "malowanieZewnetrzne",
            ),
            "PricelistItemPrecoKonfig": ("id", "versionId", "key", "value"),
            "PricelistItemPrecoKinety": ("id", "versionId", "order", "dn", "wellDn", "height", "cena"),
            "PricelistItemPrecoZakresy": ("id", "versionId", "order", "label", "min", "max", "grupy", "wellDn"),
        }
        for table, columns in expected_item_columns.items():
            required_columns(connection, table, columns)

        versions = [dict(row) for row in connection.execute('SELECT * FROM "PricelistVersion"')]
        overrides = {
            str(row["key"])[len(OVERRIDE_PREFIX):]: str(row["value"])
            for row in connection.execute('SELECT "key", "value" FROM "settings"')
            if str(row["key"]).startswith(OVERRIDE_PREFIX) and row["value"]
        }
        by_id = {str(row["id"]): row for row in versions}
        selected: dict[str, dict[str, Any]] = {}
        for price_type in TYPES:
            valid = [
                row for row in versions
                if row["type"] == price_type
                and row["status"] == "APPROVED"
                and utc_datetime(str(row["effectiveFrom"])) <= exported_at
            ]
            pinned = by_id.get(overrides.get(price_type, ""))
            if pinned and pinned["type"] == price_type and pinned["status"] == "APPROVED" and utc_datetime(str(pinned["effectiveFrom"])) <= exported_at:
                chosen = pinned
            else:
                chosen = max(valid, key=lambda row: (utc_datetime(str(row["effectiveFrom"])), int(row["seq"])), default=None)
            if chosen is None:
                raise ValueError(f"Brak aktywnej wersji cennika dla typu {price_type}")
            selected[price_type] = dict(chosen)

        items: dict[str, dict[str, list[dict[str, Any]]]] = {}
        counts: dict[str, int] = {}
        for price_type, version in selected.items():
            items[price_type] = {}
            for table, model_name in TABLES.items():
                rows = [dict(row) for row in connection.execute(
                    f'SELECT * FROM "{model_name}" WHERE "versionId" = ? ORDER BY rowid', (version["id"],)
                )]
                for row in rows:
                    for field in MONEY_FIELDS.get(table, ()):
                        row[field] = decimal_text(row[field], f"{model_name}.{field}")
                    for field in FLOAT_FIELDS.get(table, ()):
                        value = row[field]
                        if value is not None:
                            number = float(value)
                            if not (number == number and abs(number) != float("inf")):
                                raise ValueError(f"Niepoprawna miara {model_name}.{field}: {value!r}")
                            row[field] = repr(number)
                items[price_type][table] = rows
                counts[f"{price_type}.{table}"] = len(rows)
            for model_name in REQUIRED_TABLES[price_type]:
                table = next(key for key, value in TABLES.items() if value == model_name)
                if counts[f"{price_type}.{table}"] == 0:
                    raise ValueError(
                        f"Aktywny cennik {price_type} ({version['id']}) ma pustą tabelę {model_name}"
                    )

        payload = {
            "format": FORMAT,
            "formatVersion": FORMAT_VERSION,
            "exportedAt": exported_at.isoformat().replace("+00:00", "Z"),
            "sourceSchema": "legacy-sqlite",
            "versions": selected,
            "activeOverrides": {
                price_type: overrides[price_type]
                for price_type, version in selected.items()
                if overrides.get(price_type) == version["id"]
            },
            "items": items,
            "counts": counts,
        }
        digest = hashlib.sha256(canonical_json(payload)).hexdigest()
        connection.execute("COMMIT")
        return {**payload, "sha256": digest}
    except Exception:
        if connection.in_transaction:
            connection.execute("ROLLBACK")
        raise
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=pathlib.Path, help="Jawna ścieżka do starego pliku SQLite")
    parser.add_argument("--output", required=True, type=pathlib.Path, help="Plik JSON artefaktu (zapis atomowy)")
    parser.add_argument("--at", help="Czas aktywności ISO-8601; domyślnie bieżący UTC")
    parser.add_argument("--dry-run", action="store_true", help="Pokaż liczniki i SHA-256 bez zapisu artefaktu")
    args = parser.parse_args()
    try:
        if not args.source.is_file():
            raise ValueError(f"Źródłowy plik nie istnieje: {args.source}")
        at = utc_datetime(args.at) if args.at else dt.datetime.now(dt.timezone.utc)
        artifact = export(args.source, at)
        summary = {key: artifact[key] for key in ("format", "formatVersion", "exportedAt", "counts", "sha256")}
        if args.dry_run:
            print(json.dumps(summary, ensure_ascii=False, indent=2))
            return 0
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(args.output.suffix + ".tmp")
        temporary.write_bytes(json.dumps(artifact, ensure_ascii=False, sort_keys=True, indent=2).encode("utf-8") + b"\n")
        temporary.replace(args.output)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    except (OSError, sqlite3.Error, ValueError, decimal.InvalidOperation) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
