import requests
import re
import json
from datetime import datetime, timezone, timedelta
from utils import clean_html_to_text, format_relative_time

POSITIONS_RE = re.compile(r"\bCOMPANY_POSITIONS_DATA\s*=\s*")

def fetch_comeet_jobs(slug: str, company_id: str, location_filter: str | None = None, timeframe: str | None = None) -> list:
    r = requests.get(f"https://www.comeet.com/jobs/{slug}/{company_id}", timeout=30)
    r.raise_for_status()
    page_html = r.text
    
    if not re.search(r"\bCOMPANY_DATA\s*=", page_html):
        raise ValueError(f"No company data found. Check slug '{slug}' and ID '{company_id}'.")

    match = POSITIONS_RE.search(page_html)
    if not match:
        raise ValueError("COMPANY_POSITIONS_DATA not found: the page layout may have changed.")
    
    positions, _ = json.JSONDecoder().raw_decode(page_html, match.end())

    groups = {}
    for p in positions:
        groups.setdefault(p["uid"].split("-")[0], []).append(p)

    now = datetime.now(timezone.utc)
    cutoff_time = None
    if timeframe == "today":
        cutoff_time = now - timedelta(days=1)
    elif timeframe == "week":
        cutoff_time = now - timedelta(days=7)

    jobs = []
    for base, rows in groups.items():
        primary = next((p for p in rows if p["uid"] == base), rows[0])
        
        raw_updated = primary.get("time_updated")
        updated_dt = None
        
        if raw_updated:
            clean_updated = raw_updated.replace("Z", "+00:00")
            try:
                updated_dt = datetime.fromisoformat(clean_updated)
            except ValueError:
                pass
        
        if cutoff_time and updated_dt and updated_dt < cutoff_time:
            continue
        
        locations = []
        israel_match = False
        for p in rows:
            loc = p.get("location") or {}
            place = loc.get("city") or loc.get("name")
            country = loc.get("country") or ""
            if place and place.lower() != "remote":
                locations.append({"place": place, "country": country})
                
            if location_filter:
                if location_filter.lower() in country.lower():
                    israel_match = True

        if location_filter and not israel_match:
            continue

        sections = sorted(primary.get("custom_fields", {}).get("details") or [], key=lambda d: d.get("order", 0))
        html_desc = "".join(
            (f"<h3>{s['name']}</h3>" if s.get("name") else "") + s["value"]
            for s in sections if (s.get("value") or "").strip()
        )

        time_ago_str = format_relative_time(updated_dt) if updated_dt else "Unknown"
        full_text = clean_html_to_text(html_desc)

        jobs.append({
            "id": base,
            "company": slug,
            "title": primary.get("name"),
            "location": " | ".join([f"{l.get('place', '')}, {l.get('country', '')}".strip(", ") for l in locations]),
            "employment_type": primary.get("employment_type"),
            "updated_at_formatted": updated_dt.strftime("%Y-%m-%d %H:%M UTC") if updated_dt else raw_updated,
            "time_ago": time_ago_str,
            "url": primary.get("url_comeet_hosted_page") or primary.get("url_active_page"),
            "content_full": full_text
        })
        
    return jobs