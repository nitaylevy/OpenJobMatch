from datetime import datetime, timezone
import html
from bs4 import BeautifulSoup

def clean_html_to_text(raw_html: str) -> str:
    """Decodes HTML entities and strips tags into clean, human-readable text."""
    if not raw_html:
        return ""
    unescaped = html.unescape(raw_html)
    soup = BeautifulSoup(unescaped, "html.parser")
    return soup.get_text(separator="\n", strip=True)

def format_relative_time(dt: datetime) -> str:
    """Returns a readable relative time string like '3 hours ago' or '2 days ago'."""
    now = datetime.now(timezone.utc)
    diff = now - dt

    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days > 1 else ''} ago"