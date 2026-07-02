import json
import re
from datetime import UTC, datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parent.parent
TMP_DIR = REPO_ROOT / "tmp"
OUT_PATH = REPO_ROOT / "assets" / "amot-traceability-awards-2026-candidates.json"
REPORT_PATH = REPO_ROOT / "assets" / "amot-traceability-awards-2026-import-report.json"

AWARD_URL = "https://www.amot.org.tw/news/detail/114/"
REST_URL = "https://www.amot.org.tw/rest/?id=1"
AWARD_TMP = TMP_DIR / "amot-news-114.html"
REST_TMP = TMP_DIR / "amot-rest-id1.html"
GUIDE = "amottrace"
SOURCE_NAME = "AMOT 第十一屆星級溯源餐廳評鑑"
CERTIFIER = "台灣農業跨領域發展協會 AMOT"
TAIPEI_TZ = timezone(timedelta(hours=8))

DISTRICT_RE = re.compile(
    r"^(?:基隆市|台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|新竹市|嘉義市|"
    r"屏東市|宜蘭市|花蓮市|台東市|臺東市|斗六市|苗栗市|彰化市|南投市)"
    r"([^\s]{1,8}(?:區|鎮|鄉))|"
    r"^(?:新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣)"
    r"([^\s]{1,8}(?:市|鎮|鄉))|"
    r"^(屏東市|宜蘭市|花蓮市|台東市|臺東市|斗六市|苗栗市|彰化市|南投市)"
)
CITY_RE = re.compile(
    r"^(基隆市|台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|新竹市|嘉義市|"
    r"新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|"
    r"屏東市|宜蘭市|花蓮市|台東市|臺東市|斗六市|苗栗市|彰化市|南投市)"
)

SECTION_TO_LEVEL = {
    "一星溯源餐廳": "一星",
    "二星溯源餐廳": "二星",
    "三星溯源餐廳": "三星",
}

ALIAS_MAP = {
    "水月囍樓有限公司": "水月囍樓",
    "和德昌股份有限公司-麥當勞授權發展商": "麥當勞",
    "台北六福萬怡酒店": "台北六福萬怡酒店 粵亮廣式料理餐廳",
    "雲品溫泉酒店日月潭": "雲品溫泉酒店 KEN CAN by Ken Chan",
    "大地酒店月兒彎彎涮涮鍋": "大地酒店-月兒彎彎",
    "伊府將 鍋燒": "伊府將鍋燒",
    "六兄弟實業有限公司(茶自點)": "茶自點複合式餐飲",
    "Saikabo韓國旬彩料理": "SAIKABO",
    "立川漁場休閒農場 五餅二魚餐廳": "五餅二魚餐廳",
    "立川漁場休閒農場 五餅二魚餐廳\"": "五餅二魚餐廳",
    "古坑服務區：國道食堂（豐味棧）": "古坑服務區：國道食堂（豐味棧）",
    "第一銀行 員工餐廳": "第一商業銀行股份有限公司 員工餐廳",
    "臻好食客棧-機場店": "臻好食客棧-關西店",
}


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def taipei_date() -> str:
    return datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d")


def normalize_text(value: str) -> str:
    value = unescape(value or "")
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("\u3000", " ").replace("&nbsp;", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_address(value: str) -> str:
    text = normalize_text(value)
    text = re.sub(r"^[\(\[]?\d{3,5}[\)\]]?\s*", "", text)
    return text


def normalize_name_key(value: str) -> str:
    text = normalize_text(value)
    text = text.replace("臺", "台")
    text = text.replace("（", "(").replace("）", ")")
    text = text.replace("‧", "").replace("・", "").replace("－", "-")
    text = re.sub(r"有限公司|股份有限公司|有限責任|財團法人", "", text)
    text = re.sub(r"[\s\"'()\-:：,，.。&＋+]", "", text)
    return text.lower()


def fetch(url: str, out_path: Path) -> str:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=20) as response:
        data = response.read()
    out_path.write_bytes(data)
    return data.decode("utf-8", "replace")


def extract_city(address: str) -> str:
    clean = normalize_address(address)
    match = CITY_RE.search(clean)
    if not match:
        return ""
    city = match.group(1).replace("臺", "台")
    county_city_map = {
        "屏東市": "屏東縣",
        "宜蘭市": "宜蘭縣",
        "花蓮市": "花蓮縣",
        "台東市": "台東縣",
        "斗六市": "雲林縣",
        "苗栗市": "苗栗縣",
        "彰化市": "彰化縣",
        "南投市": "南投縣",
    }
    return county_city_map.get(city, city)


def extract_district(address: str) -> str:
    clean = normalize_address(address).replace("臺", "台")
    match = DISTRICT_RE.search(clean)
    if not match:
        return ""
    return match.group(1) or match.group(2) or match.group(3) or ""


def parse_restaurants(html: str) -> list[dict]:
    pattern = re.compile(
        r"<h4>(?P<name>.*?)</h4>.*?地址:\s*(?P<address>.*?)</a><br/>\s*"
        r".*?料理種類:\s*(?P<cuisine>.*?)<br/>",
        re.S,
    )
    restaurants = []
    for match in pattern.finditer(html):
        name = normalize_text(match.group("name"))
        address = normalize_text(match.group("address"))
        cuisine = normalize_text(match.group("cuisine"))
        restaurants.append(
            {
                "name": name,
                "city": extract_city(address),
                "district": extract_district(address),
                "address": address,
                "cuisine": cuisine,
                "matchKey": normalize_name_key(name),
            }
        )
    return restaurants


def parse_awards(html: str) -> list[dict]:
    paragraphs = [
        normalize_text(item)
        for item in re.findall(r"<p[^>]*>(.*?)</p>", html, re.S)
    ]
    awards = []
    current_level = None
    for text in paragraphs:
        if not text or text == "Powered by Froala Editor":
            continue
        if text.startswith(">>"):
            section = text[2:]
            if section in SECTION_TO_LEVEL:
                current_level = SECTION_TO_LEVEL[section]
            else:
                current_level = None
            continue
        if current_level:
            awards.append({"rawName": text, "level": current_level})
    return awards


def build_restaurant_index(restaurants: list[dict]) -> dict:
    index = {}
    for row in restaurants:
        keys = {row["matchKey"]}
        keys.add(normalize_name_key(row["name"].replace("台北", "臺北")))
        keys.add(normalize_name_key(row["name"].replace("臺北", "台北")))
        keys.add(normalize_name_key(row["name"].replace("台中", "臺中")))
        keys.add(normalize_name_key(row["name"].replace("臺中", "台中")))
        for key in keys:
            if key:
                index.setdefault(key, []).append(row)
    return index


def choose_match(raw_name: str, rest_index: dict) -> dict | None:
    search_names = [raw_name]
    if raw_name in ALIAS_MAP:
        search_names.insert(0, ALIAS_MAP[raw_name])
    for candidate_name in search_names:
        key = normalize_name_key(candidate_name)
        matches = rest_index.get(key, [])
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            return matches[0]
    raw_key = normalize_name_key(raw_name)
    for key, rows in rest_index.items():
        if raw_key and (raw_key in key or key in raw_key):
            return rows[0]
    return None


def main():
    generated_at = now_utc_iso()
    extracted_at = taipei_date()
    awards_html = fetch(AWARD_URL, AWARD_TMP)
    rest_html = fetch(REST_URL, REST_TMP)

    rest_rows = parse_restaurants(rest_html)
    rest_index = build_restaurant_index(rest_rows)
    award_rows = parse_awards(awards_html)

    restaurants = []
    needs_manual_review = []
    seen = set()

    for award in award_rows:
        match = choose_match(award["rawName"], rest_index)
        if not match:
            needs_manual_review.append(
                {
                    "name": award["rawName"],
                    "level": award["level"],
                    "year": "2026",
                    "reason": "no_current_rest_list_match",
                    "sourceUrl": AWARD_URL,
                }
            )
            continue
        if not match["city"] or not match["district"] or normalize_address(match["address"]) == "麥當勞":
            needs_manual_review.append(
                {
                    "name": award["rawName"],
                    "level": award["level"],
                    "year": "2026",
                    "reason": "matched_rest_missing_structured_location",
                    "sourceUrl": AWARD_URL,
                }
            )
            continue
        key = (match["name"], match["address"], award["level"])
        if key in seen:
            continue
        seen.add(key)
        restaurants.append(
            {
                "name": match["name"],
                "city": match["city"],
                "district": match["district"],
                "address": match["address"],
                "cuisine": match["cuisine"],
                "aliases": sorted({award["rawName"]} - {match["name"]}),
                "awards": [
                    {
                        "guide": GUIDE,
                        "year": "2026",
                        "level": award["level"],
                        "awardName": "星級溯源餐廳",
                        "certType": "traceability_restaurant",
                        "sourceName": SOURCE_NAME,
                        "certifier": CERTIFIER,
                        "extractedAt": extracted_at,
                        "notes": "依 AMOT 第十一屆星級溯源餐廳評鑑得獎名單，地址與菜系取自 AMOT 溯源餐廳公開列表頁。",
                        "url": AWARD_URL,
                    }
                ],
                "importConfidence": "high",
                "sourceMeta": {
                    "awardSourceUrl": AWARD_URL,
                    "restSourceUrl": REST_URL,
                    "rawAwardName": award["rawName"],
                },
            }
        )

    payload = {
        "version": "amot-traceability-awards-2026-candidates",
        "generatedAt": generated_at,
        "sourceUrl": AWARD_URL,
        "policy": {
            "runtimeExternalLookup": False,
            "importMode": "public_web_batch",
            "notes": [
                "評鑑名單來自 AMOT 第十一屆星級溯源餐廳公開頁面。",
                "地址與料理種類來自 AMOT 溯源餐廳公開列表頁。",
                "僅匯入可對應到公開列表頁的餐廳；未對上者保留在待人工確認。",
            ],
        },
        "restaurants": restaurants,
        "needsManualReview": needs_manual_review,
    }
    report = {
        "generatedAt": generated_at,
        "awardUrl": AWARD_URL,
        "restUrl": REST_URL,
        "awardRows": len(award_rows),
        "restRows": len(rest_rows),
        "candidates": len(restaurants),
        "needsManualReview": len(needs_manual_review),
    }

    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
