import requests
from datetime import datetime, timezone, timedelta
from utils import clean_html_to_text, format_relative_time

ISRAEL_KEYWORDS = {
    "israel", "ישראל", "il",
    "tel aviv", "tel-aviv", "tlv",
    "herzliya", "herzelia", "herzliya pituach",
    "ramat gan", "ramat-gan",
    "givatayim", "giv'atayim",
    "holon", "bat yam", "bat-yam",
    "rishon lezion", "rishon le-zion", "rishon le zion",
    "petah tikva", "petach tikva", "petah-tikva", "petach-tikva",
    "bnei brak", "bene beraq",
    "ra'anana", "raanana", "kfar saba", "kfar-saba", "hod hasharon",
    "netanya", "kfar netter", "shefayim", "yakum", "glil yam",
    "kfar yona", "kadima", "even yehuda",
    "jerusalem", "beit shemesh", "modi'in", "modiin", "maccabim", "reut",
    "rehovot", "nes ziona", "ness ziona", "lod", "ramla", "ramlah",
    "kiryat gat", "ashdod", "ashkelon", "yavne",
    "haifa", "matam", "yokneam", "yoqneam", "yokne'am",
    "caesarea", "hadera", "zichron yaakov", "zikhron ya'akov",
    "tirat carmel", "tirat karmel", "misgav", "migdal haemek", "migdal ha'emek",
    "afula", "carmiel", "karmiel", "nahariya", "akko", "acre",
    "nazareth", "tiberias",
    "beer sheva", "beersheba", "beer-sheva", "be'er sheva",
    "omer", "dimona", "sderot", "eilat",
    "gush dan", "sharon", "merkaz", "galil", "negev",
    "shfela", "arava"
}

def is_israel_location(location_name: str) -> bool:
    if not location_name:
        return False
    loc_lower = location_name.lower()
    return any(keyword in loc_lower for keyword in ISRAEL_KEYWORDS)

def fetch_greenhouse_jobs(
    board_tokens: list[str],
    timeframe: str = "week",
    filter_israel: bool = True,
    include_full_text: bool = True
) -> list[dict]:
    now = datetime.now(timezone.utc)
    delta = timedelta(days=1) if timeframe == "today" else timedelta(days=7)
    cutoff_time = now - delta

    results = []

    for token in board_tokens:
        url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
        params = {"content": "true"} if include_full_text else {}

        try:
            response = requests.get(url, params=params, timeout=20)
            if response.status_code == 404:
                print(f"[{token}] Board not found.")
                continue
            response.raise_for_status()

            data = response.json()
            jobs = data.get("jobs", [])

            for job in jobs:
                raw_updated_at = job.get("updated_at")
                if not raw_updated_at:
                    continue

                updated_at_dt = datetime.fromisoformat(raw_updated_at)
                if updated_at_dt < cutoff_time:
                    continue

                location_name = (job.get("location") or {}).get("name", "")
                if filter_israel and not is_israel_location(location_name):
                    continue

                raw_content = job.get("content", "")
                clean_description = clean_html_to_text(raw_content) if include_full_text else ""

                results.append({
                    "id": job.get("id"),
                    "company": token,
                    "title": job.get("title"),
                    "location": location_name,
                    "updated_at_formatted": updated_at_dt.strftime("%Y-%m-%d %H:%M UTC"),
                    "time_ago": format_relative_time(updated_at_dt),
                    "url": job.get("absolute_url"),
                    "content_full": clean_description
                })

        except requests.RequestException as e:
            print(f"Error fetching board '{token}': {e}")

    return results