import re
from datetime import datetime
from dateutil import parser

# --- Helper Functions ---
DATE_TOKEN_PATTERN = re.compile(
    r"(?i)\b(?:"
    r"(?:present|current|now)|"
    r"(?:\d{1,2}[\/.-]\d{4})|"
    r"(?:\d{4}[\/.-]\d{1,2})|"
    r"(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4})|"
    r"(?:\d{4})"
    r")\b"
)

def calculate_years(date_str: str) -> float:
    if not date_str or not isinstance(date_str, str):
        return 0.0

    # 1. Clean en-dashes, em-dashes, and multiple spaces
    normalized = (
        date_str.replace("–", "-").replace("—", "-").replace("~", "-")
    )

    # 2. Extract start and end tokens
    tokens = DATE_TOKEN_PATTERN.findall(normalized)

    # If we couldn't isolate exactly 2 date endpoints, fallback to splitting
    if len(tokens) >= 2:
        start_raw, end_raw = tokens[0].strip(), tokens[1].strip()
    else:
        # Fallback to delimiter split for unexpected formats
        parts = re.split(
            r"\s+(?:to|until|thru|-)\s+|\s*[-–—]\s*",
            normalized.strip(),
            flags=re.IGNORECASE,
        )
        if len(parts) != 2:
            return 0.0
        start_raw, end_raw = parts[0].strip(), parts[1].strip()

    try:
        today = datetime.today()
        default_date = datetime(today.year, 1, 1)

        start_date = parser.parse(start_raw, default=default_date)

        if end_raw.lower() in ["present", "current", "now"]:
            end_date = today
        else:
            end_date = parser.parse(end_raw, default=default_date)

        # Handle negative ranges if dates were inverted
        if end_date < start_date:
            return 0.0

        # Calculate duration in years
        duration = (end_date - start_date).days / 365.25
        return round(max(0.0, duration), 1)

    except Exception:
        return 0.0

# Comprehensive patterns for major resume sections
EDU_HEADER_PATTERN = re.compile(
    r"(?im)^\s*(?:education|academic(?:s|\s+background|\s+history|\s+qualifications)?|qualifications|educational\s+background)\b.*$"
)

EXP_HEADER_PATTERN = re.compile(
    r"(?im)^\s*(?:work\s+experience|professional\s+experience|employment\s+history|experience|work\s+history|career\s+history|professional\s+background)\b.*$"
)

# Any standard major section header that signals the end of the education block
ANY_SECTION_HEADER_PATTERN = re.compile(
    r"(?im)^\s*(?:"
    r"experience|work\s+experience|professional\s+experience|employment\s+history|work\s+history|"
    r"skills|technical\s+skills|core\s+competencies|tools\s+and\s+technologies|"
    r"projects|personal\s+projects|academic\s+projects|"
    r"certifications?|licenses?|courses?|"
    r"awards?|honors?|achievements?|"
    r"publications?|research|"
    r"languages?|interests?|volunteer|activities"
    r")\b.*$"
)

def remove_education_section(text: str) -> dict:
    """Finds experience and education section headers, removes the entire education

    block (from its header up to the next major section or EOF), and returns
    the cleaned text along with the detected headers.
    """
    if not text or not isinstance(text, str):
        return {
            "cleaned_text": "",
            "education_headers": [],
            "experience_headers": [],
        }

    # 1. Detect all Experience and Education headers
    edu_matches = list(EDU_HEADER_PATTERN.finditer(text))
    exp_matches = list(EXP_HEADER_PATTERN.finditer(text))

    detected_edu = [m.group(0).strip() for m in edu_matches]
    detected_exp = [m.group(0).strip() for m in exp_matches]

    # If no education section found, return original text unchanged
    if not edu_matches:
        return {
            "cleaned_text": text.strip(),
            "education_headers": [],
            "experience_headers": detected_exp,
        }

    # 2. Slice out each detected education block
    # Process from bottom to top so character indices remain valid
    all_headers = list(ANY_SECTION_HEADER_PATTERN.finditer(text))
    cleaned = text

    for edu_m in reversed(edu_matches):
        edu_start = edu_m.start()

        # Find the next major section header that begins AFTER this education header
        next_headers = [h for h in all_headers if h.start() > edu_m.end()]

        if next_headers:
            # Cut up to the start of the next section
            edu_end = next_headers[0].start()
            cleaned = cleaned[:edu_start] + cleaned[edu_end:]
        else:
            # Education is the last section; cut to EOF
            cleaned = cleaned[:edu_start]

    # 3. Clean up leftover redundant whitespace/newlines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    return {
        "cleaned_text": cleaned,
        "education_headers": detected_edu,
        "experience_headers": detected_exp,
    }

# Comprehensive patterns for summary/objective section headers
SUMMARY_HEADER_PATTERN = re.compile(
    r"(?im)^\s*(?:"
    r"professional\s+summary|career\s+summary|executive\s+summary|personal\s+summary|summary\s+of\s+qualifications|"
    r"career\s+objective|professional\s+objective|objective|"
    r"about\s+me|profile|professional\s+profile|personal\s+profile|bio|overview|summary"
    r")\b.*$"
)

# Standard section headers signaling the end of the summary block
ANY_SECTION_HEADER_AFTER_SUMMARY_PATTERN = re.compile(
    r"(?im)^\s*(?:"
    r"experience|work\s+experience|professional\s+experience|employment\s+history|work\s+history|career\s+history|"
    r"education|academic(?:s|\s+background|\s+history|\s+qualifications)?|qualifications|educational\s+background|"
    r"skills|technical\s+skills|core\s+competencies|tools\s+and\s+technologies|areas\s+of\s+expertise|"
    r"projects|personal\s+projects|academic\s+projects|"
    r"certifications?|licenses?|courses?|"
    r"awards?|honors?|achievements?|"
    r"publications?|research|"
    r"languages?|interests?|volunteer|activities"
    r")\b.*$"
)

def extract_summary_section(text: str, include_header: bool = False) -> dict:
    """Detects a summary/profile/objective header in a resume, extracts the
    text between that header and the next major section (or EOF), and returns
    the extracted content, the detected header, and the match boundaries.
    """
    if not text or not isinstance(text, str):
        return {
            "summary_text": "",
            "header": None,
            "has_summary": False,
        }

    match = SUMMARY_HEADER_PATTERN.search(text)
    if not match:
        return {
            "summary_text": "",
            "header": None,
            "has_summary": False,
        }

    detected_header = match.group(0).strip()
    
    # Text begins either from the header itself or right after the header line
    content_start = match.start() if include_header else match.end()

    # Find the next major section header that begins after this summary header
    all_following_headers = [
        h for h in ANY_SECTION_HEADER_AFTER_SUMMARY_PATTERN.finditer(text)
        if h.start() > match.end()
    ]

    if all_following_headers:
        content_end = all_following_headers[0].start()
        raw_summary = text[content_start:content_end]
    else:
        raw_summary = text[content_start:]

    # Clean up redundant linebreaks and surrounding whitespace
    cleaned_summary = re.sub(r"[ \t]+", " ", raw_summary)
    cleaned_summary = re.sub(r"\n{3,}", "\n\n", cleaned_summary).strip()

    return {
        "summary_text": cleaned_summary,
        "header": detected_header,
        "has_summary": bool(cleaned_summary),
    }

# Extraction patterns for contact info & profile URLs
EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)

PHONE_PATTERN = re.compile(
    r"(?:\+\d{1,3}[-.\s]*)?"
    r"(?:\(?\d{2,4}\)?[-.\s]*)?"
    r"\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{1,4})?\b"
)

LINKEDIN_PATTERN = re.compile(
    r"(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub|profile)\/[A-Za-z0-9_-]+(?:\/)?",
    re.IGNORECASE,
)

GITHUB_PATTERN = re.compile(
    r"(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_-]+)(?:\/)?",
    re.IGNORECASE,
)

# Reserved GitHub paths to avoid false-positive usernames
GITHUB_EXCLUDED_PATHS = {
    "features", "pricing", "marketplace", "explore", "topics", "trending", 
    "collections", "events", "security", "customer-stories", "about"
}

# Standard resume headers that signal the end of the top contact block
HEADER_BREAK_PATTERN = re.compile(
    r"(?im)^\s*(?:"
    r"summary|profile|about|experience|education|skills|projects|certifications"
    r")\b.*$"
)


def extract_candidate_contact_info(text: str) -> dict:
    """Extracts candidate's full name, phone number, email address, LinkedIn URL,
    and GitHub URL from raw resume text.
    """
    if not text or not isinstance(text, str):
        return {
            "full_name": None,
            "email": None,
            "phone": None,
            "linkedin": None,
            "github": None,
        }

    # 1. Email extraction
    email_match = EMAIL_PATTERN.search(text)
    email = email_match.group(0).strip() if email_match else None

    # 2. LinkedIn URL extraction
    linkedin_match = LINKEDIN_PATTERN.search(text)
    linkedin = linkedin_match.group(0).strip() if linkedin_match else None

    # 3. GitHub URL extraction
    github = None
    for gh_match in GITHUB_PATTERN.finditer(text):
        username = gh_match.group(1).lower()
        if username not in GITHUB_EXCLUDED_PATHS:
            github = gh_match.group(0).strip()
            break

    # 4. Phone number extraction (validates length between 7 and 15 digits)
    phone = None
    for match in PHONE_PATTERN.finditer(text):
        candidate_phone = match.group(0).strip()
        digits_only = re.sub(r"\D", "", candidate_phone)
        if 7 <= len(digits_only) <= 15:
            phone = candidate_phone
            break

    # 5. Name extraction from top header section (first 10-15 lines before any major section)
    lines = [line.strip() for line in text.strip().splitlines() if line.strip()]
    full_name = None

    for line in lines[:15]:
        # Stop scanning if we hit an email, link, or major resume section header
        if HEADER_BREAK_PATTERN.match(line):
            break
        if EMAIL_PATTERN.search(line) or "linkedin.com" in line.lower() or "github.com" in line.lower():
            continue

        # Strip title prefixes/suffixes (e.g., Dr., Ph.D., MBA, Jr.)
        cleaned_line = re.sub(r"(?i)\b(mr|mrs|ms|dr|prof|phd|mba|bsc|msc|jr|sr|iii|ii)\b\.?", "", line).strip()
        
        # Valid name heuristic: 2 to 4 capitalized/alphabetic words, no digits or symbols
        tokens = cleaned_line.split()
        if 2 <= len(tokens) <= 4:
            if all(re.match(r"^[A-Za-zÀ-ÖØ-öø-ÿ'-]+$", t) for t in tokens):
                full_name = " ".join(tokens)
                break

    return {
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "github": github,
    }