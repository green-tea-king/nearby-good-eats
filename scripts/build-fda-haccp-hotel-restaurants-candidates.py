import json
import re
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = REPO_ROOT / "tmp" / "fda-haccp-hotel-restaurants.pdf"
OUT_PATH = REPO_ROOT / "assets" / "fda-haccp-hotel-restaurants-2026-candidates.json"
REPORT_PATH = REPO_ROOT / "assets" / "fda-haccp-hotel-restaurants-2026-import-report.json"

SOURCE_PAGE_URL = "https://www.fda.gov.tw/TC/site.aspx?sid=325"
SOURCE_FILE_URL = "https://www.fda.gov.tw/tc/includes/GetFile.ashx?id=f638226216741466806&iid=12559&type=3"
SOURCE_NAME = "衛生機關執行旅館業附設餐廳實施食品安全管制系統符合性參考名單"
CERTIFIER = "衛生福利部食品藥物管理署"
TAIPEI_TZ = timezone(timedelta(hours=8))

SOURCE_CITIES = [
    "台中市",
    "台北市",
    "台東縣",
    "台南市",
    "宜蘭縣",
    "花蓮縣",
    "南投縣",
    "屏東縣",
    "桃園市",
    "高雄市",
    "新北市",
    "新竹市",
]

DISTRICT_RE = re.compile(
    r"^(?:基隆市|台北市|新北市|桃園市|台中市|台南市|高雄市|新竹市|嘉義市)"
    r"([^\s]{1,8}(?:區|鎮|鄉))|"
    r"^(?:新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|澎湖縣)"
    r"([^\s]{1,8}(?:市|鎮|鄉))"
)
ROW_START_RE = re.compile(r"^(\d+)\s+(" + "|".join(map(re.escape, SOURCE_CITIES)) + r")\s*(.*)$")
ADDRESS_START_RE = re.compile(r"^(?:" + "|".join(map(re.escape, SOURCE_CITIES)) + r")")


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def taipei_date() -> str:
    return datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def join_name_parts(parts: list[str]) -> str:
    merged = ""
    for part in parts:
        value = normalize_text(part)
        if not value:
            continue
        if (
            merged
            and re.search(r"[A-Za-z0-9)]$", merged)
            and re.match(r"^[A-Za-z0-9(]", value)
        ):
            merged += " "
        merged += value
    return normalize_text(merged)


def extract_district(address: str) -> str:
    match = DISTRICT_RE.search(normalize_text(address))
    if not match:
        return ""
    return match.group(1) or match.group(2) or ""


def read_pdf_lines() -> list[str]:
    reader = PdfReader(str(PDF_PATH))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    return [normalize_text(line) for line in text.splitlines() if normalize_text(line)]


def split_rows(lines: list[str]) -> list[dict]:
    rows = []
    current = None
    started = False

    for line in lines:
        if not started:
            if ROW_START_RE.match(line):
                started = True
            else:
                continue

        match = ROW_START_RE.match(line)
        if match:
            if current:
                rows.append(current)
            seq, city, remainder = match.groups()
            current = {"seq": int(seq), "city": city, "parts": []}
            if remainder:
                current["parts"].append(remainder)
            continue

        if current:
            current["parts"].append(line)

    if current:
        rows.append(current)
    return rows


def find_address_start(parts: list[str]) -> int | None:
    for idx, part in enumerate(parts):
        if ADDRESS_START_RE.match(part):
            return idx
    return None


def find_category_start(parts: list[str], address_start: int) -> int | None:
    for idx in range(address_start + 1, len(parts)):
        probe = "".join(parts[idx : min(len(parts), idx + 3)])
        if (
            "旅館附設餐廳" in probe
            and ("國際觀光" in probe or "五星級" in probe)
            and (probe.startswith("國際觀光") or probe.startswith("五星級"))
        ):
            return idx
    return None


def normalize_level(parts: list[str]) -> str:
    value = normalize_text("".join(parts))
    return value.replace("國際觀光/五星級旅館附設餐廳", "國際觀光/五星級旅館附設餐廳")


def split_name_and_address_inline(value: str) -> tuple[str, str]:
    normalized = normalize_text(value)
    for city in SOURCE_CITIES:
        idx = normalized.find(city)
        if idx > 0:
            return normalize_text(normalized[:idx]), normalize_text(normalized[idx:])
    return normalized, ""


def parse_row(row: dict, extracted_at: str) -> dict | None:
    parts = [normalize_text(part) for part in row["parts"] if normalize_text(part)]
    if not parts:
        return None

    address_start = find_address_start(parts)
    category_probe_start = address_start if address_start is not None else 0
    category_start = find_category_start(parts, category_probe_start)
    if category_start is None:
        return None

    if address_start is None:
        inline_name, inline_address = split_name_and_address_inline(parts[0])
        if not inline_address:
            return None
        name = inline_name
        address = normalize_text(" ".join([inline_address, *parts[1:category_start]]))
    elif address_start == 0:
        inline_name, inline_address = split_name_and_address_inline(parts[0])
        if not inline_address:
            return None
        name = inline_name
        address = normalize_text(" ".join([inline_address, *parts[1:category_start]]))
    else:
        name = join_name_parts(parts[:address_start])
        address = normalize_text(" ".join(parts[address_start:category_start]))
    level = normalize_level(parts[category_start:])

    if not name or not address or "旅館附設餐廳" not in level:
        return None

    return {
        "name": name,
        "city": row["city"],
        "district": extract_district(address),
        "address": address,
        "cuisine": "",
        "aliases": [],
        "awards": [
            {
                "guide": "fdahaccp",
                "year": "年份待確認",
                "level": level,
                "awardName": "旅館業附設餐廳 HACCP 符合性參考名單",
                "certType": "hotel_restaurant_haccp",
                "sourceName": SOURCE_NAME,
                "certifier": CERTIFIER,
                "extractedAt": extracted_at,
                "notes": "名單說明涵蓋 109-111 年查核合格或複查合格業者，但未提供各店獨立年份，故標示為年份待確認。",
                "url": SOURCE_FILE_URL,
            }
        ],
        "importConfidence": "high",
        "sourceMeta": {
            "sequence": row["seq"],
            "sourcePageUrl": SOURCE_PAGE_URL,
        },
    }


def main():
    extracted_at = taipei_date()
    generated_at = now_utc_iso()
    lines = read_pdf_lines()
    rows = split_rows(lines)

    restaurants = []
    errors = []
    seen = set()

    for row in rows:
        candidate = parse_row(row, extracted_at)
        if not candidate:
            errors.append(
                {
                    "sequence": row["seq"],
                    "city": row["city"],
                    "parts": row["parts"],
                }
            )
            continue
        key = (candidate["city"], candidate["name"], candidate["address"])
        if key in seen:
            continue
        seen.add(key)
        restaurants.append(candidate)

    payload = {
        "version": "fda-haccp-hotel-restaurants-2026-candidates",
        "generatedAt": generated_at,
        "sourcePageUrl": SOURCE_PAGE_URL,
        "sourceFileUrl": SOURCE_FILE_URL,
        "policy": {
            "runtimeExternalLookup": False,
            "importMode": "official_pdf_batch",
            "nationalCertificationList": True,
            "notes": [
                "資料來源為食藥署公開 PDF，批次整理後供本地內建資料庫使用。",
                "名單說明涵蓋 109-111 年查核合格或複查合格旅館附設餐廳。",
                "因原始資料未提供店家逐筆年份，year 一律標示為年份待確認。",
            ],
        },
        "restaurants": restaurants,
    }
    report = {
        "generatedAt": generated_at,
        "sourcePageUrl": SOURCE_PAGE_URL,
        "sourceFileUrl": SOURCE_FILE_URL,
        "rowsDetected": len(rows),
        "candidates": len(restaurants),
        "errors": errors,
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
