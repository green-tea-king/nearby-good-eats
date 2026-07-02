import json
import re
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parent.parent
TMP_DIR = REPO_ROOT / "tmp"
PDF_PATH = TMP_DIR / "taichung-golden-awards-2024.pdf"
OUT_PATH = REPO_ROOT / "assets" / "taichung-golden-awards-2024-candidates.json"
REPORT_PATH = REPO_ROOT / "assets" / "taichung-golden-awards-2024-import-report.json"

SOURCE_PAGE_URL = "https://www.fds.taichung.gov.tw/2813501/post"
SOURCE_FILE_URL = "https://www.fds.taichung.gov.tw/media/1157770/113%E5%B9%B4%E8%87%BA%E4%B8%AD%E5%B8%82%E9%87%91%E9%A5%8C%E7%8D%8E%E9%A4%90%E9%A3%B2%E8%A1%9B%E7%94%9F%E7%AE%A1%E7%90%86%E5%88%86%E7%B4%9A%E8%A9%95%E6%A0%B8%E7%8D%B2%E7%8D%8E%E5%90%8D%E5%96%AE.pdf"
SOURCE_NAME = "113年臺中市金饌獎餐飲衛生管理分級評核獲獎名單"
CERTIFIER = "臺中市食品藥物安全處"
GUIDE = "taichunggold"
TAIPEI_TZ = timezone(timedelta(hours=8))

CITY_RE = re.compile(r"^(臺中市|台中市)")
DISTRICT_RE = re.compile(r"^(?:臺中市|台中市)([^\s]{1,8}(?:區))")
LEVEL_MARKERS = {"特優", "優", "良"}
ROW_START_RE = re.compile(r"^(\d+)\s+(.+)$")


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def taipei_date() -> str:
    return datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d")


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def fetch_pdf() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    req = Request(SOURCE_FILE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as response:
        PDF_PATH.write_bytes(response.read())


def extract_city(address: str) -> str:
    match = CITY_RE.search(normalize_text(address))
    return match.group(1).replace("臺", "台") if match else ""


def extract_district(address: str) -> str:
    match = DISTRICT_RE.search(normalize_text(address))
    return match.group(1) if match else ""


def read_pdf_lines() -> list[str]:
    reader = PdfReader(str(PDF_PATH))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    return [normalize_text(line) for line in text.splitlines() if normalize_text(line)]


def collect_blocks(lines: list[str]) -> list[list[str]]:
    blocks = []
    current = []
    started = False
    for line in lines:
        if "餐飲業特優級名單" in line:
            started = True
            current = []
            continue
        if not started:
            continue
        if line.startswith("※備註") or line.startswith("註"):
            break
        if line in LEVEL_MARKERS and current:
            current.append(line)
            blocks.append(current)
            current = []
            continue
        if line.startswith("編號 業者 地址 評核等級") or line.startswith("編號 業者 地址"):
            continue
        if re.fullmatch(r"\d+", line):
            continue
        row_match = ROW_START_RE.match(line)
        is_real_row_start = False
        if row_match:
            _, rest = row_match.groups()
            rest = normalize_text(rest)
            if not re.match(r"^(號|樓|F|B\d|之\d|鄰|巷|弄)", rest):
                is_real_row_start = True

        if is_real_row_start and current:
            # previous row was malformed; flush for diagnostics
            blocks.append(current)
            current = [line]
            continue
        if is_real_row_start:
            current = [line]
            continue
        if current:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def parse_block(block: list[str]) -> dict | None:
    text = " ".join(block)
    text = re.sub(r"^(\d+)\s+", "", text)
    text = text.replace("臺", "台")
    text = text.replace("台中巿", "台中市")
    text = re.sub(r"餐飲業(?:特優級|優級|良級)名單\s*\d+\s*家$", "", text).strip()

    level_pos = -1
    level = None
    for marker in ["特優", "優", "良"]:
        pos = text.rfind(marker)
        if pos > level_pos:
            level_pos = pos
            level = marker
    if level_pos == -1 or not level:
        return None

    left = normalize_text(text[:level_pos])
    right_level = normalize_text(text[level_pos:])
    if not right_level.startswith(level):
        return None

    city_pos = left.find("台中市")
    if city_pos == -1:
        return None

    name = normalize_text(left[:city_pos])
    address = normalize_text(left[city_pos:])
    if not name or not address:
        return None

    return {
        "name": name,
        "city": extract_city(address),
        "district": extract_district(address),
        "address": address,
        "cuisine": "",
        "aliases": [],
        "awards": [
            {
                "guide": GUIDE,
                "year": "2024",
                "level": level,
                "awardName": "臺中市金饌獎餐飲衛生管理分級評核",
                "certType": "restaurant_hygiene_gold_award",
                "sourceName": SOURCE_NAME,
                "certifier": CERTIFIER,
                "extractedAt": taipei_date(),
                "notes": "僅匯入金饌獎餐飲衛生管理分級評核特優、優、良級名單；未納入同 PDF 中低碳認證 25 家名單。",
                "url": SOURCE_FILE_URL,
            }
        ],
        "importConfidence": "high",
        "sourceMeta": {
            "sourcePageUrl": SOURCE_PAGE_URL,
        },
    }


def main():
    fetch_pdf()
    lines = read_pdf_lines()
    blocks = collect_blocks(lines)

    restaurants = []
    errors = []
    seen = set()
    for block in blocks:
        row = parse_block(block)
        if not row:
            errors.append({"block": block})
            continue
        key = (row["name"], row["address"], row["awards"][0]["level"])
        if key in seen:
            continue
        seen.add(key)
        restaurants.append(row)

    payload = {
        "version": "taichung-golden-awards-2024-candidates",
        "generatedAt": now_utc_iso(),
        "sourcePageUrl": SOURCE_PAGE_URL,
        "sourceFileUrl": SOURCE_FILE_URL,
        "policy": {
            "runtimeExternalLookup": False,
            "importMode": "official_pdf_batch",
            "notes": [
                "資料來源為臺中市食品藥物安全處公開 PDF。",
                "僅匯入金饌獎餐飲衛生管理分級評核特優、優、良級名單。",
                "同份 PDF 的低碳認證 25 家未匯入，避免納入小樣本來源。",
            ],
        },
        "restaurants": restaurants,
    }
    report = {
        "generatedAt": now_utc_iso(),
        "sourcePageUrl": SOURCE_PAGE_URL,
        "sourceFileUrl": SOURCE_FILE_URL,
        "blocksDetected": len(blocks),
        "candidates": len(restaurants),
        "errors": len(errors),
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
