"""Text parsing and normalization utilities for job postings."""

from __future__ import annotations

import re
import ast
from typing import TypedDict
from collections import defaultdict
import difflib
from IPython.display import HTML, display
import html

# =====================================================================
# CONSTANTS & COMPILED PATTERNS
# =====================================================================

SECTION_PARSE_PATTERNS = {
    "responsibilities_start": re.compile(
        r"^RESPONSIBILITIES_START:\s*(.+?)\s*$", re.MULTILINE
    ),
    "must_have_start": re.compile(
        r"^MUST_HAVE_START:\s*(.+?)\s*$", re.MULTILINE
    ),
    "nice_to_have_start": re.compile(
        r"^NICE_TO_HAVE_START:\s*(.+?)\s*$", re.MULTILINE
    ),
}

# =====================================================================
# 1. ADVANTAGE SECTION PREPROCESSING
# =====================================================================

# Advantage extraction patterns
BULLET_STRIP_PATTERN = re.compile(r"^\s*[-*•#]+\s*")
ADVANTAGE_HEADER_PATTERN = re.compile(r"(?im)^(?:Advantages?|Nice\s+to\s+Have)\b[\s:–—\-]*$")
MULTI_NEWLINE_PATTERN = re.compile(r"\n{3,}")

# Common prefix keywords: "Advantage", "Bonus points", "Bonus", "Nice to have"
PREFIX_KEYWORDS = (
    r"(?:advantages?|bonus\s+points?|bonus|nice\s+to\s+have|plus)"
)

# Optional qualifiers between the keyword and separator:
# e.g., ", none required", ", not required", " (optional)", " (not required)"
PREFIX_QUALIFIERS = (
    r"(?:,\s*(?:none|not)\s+required|\s*\((?:none|not\s+)?(?:required|mandatory)|optional\))?"
)

# Matches lines STARTING with advantage/bonus prefixes:
# e.g.:
# - "Bonus points: Docker experience"
# - "Bonus points, none required: Kubernetes"
# - "Advantage: React / Next.js"
# - "- Nice to have: AWS"
PREFIX_ADVANTAGE_PATTERN = re.compile(
    rf"(?im)^\s*(?:[-*•#]+\s*)?{PREFIX_KEYWORDS}{PREFIX_QUALIFIERS}\s*[:–—\-]\s*(.+?)\s*$"
)

# Pattern to cleanly strip these prefixes and their separators from extracted text
PREFIX_STRIP_PATTERN = re.compile(
    rf"(?i)^\s*(?:[-*•#]+\s*)?{PREFIX_KEYWORDS}{PREFIX_QUALIFIERS}\s*[:–—\-]\s*"
)

# Matches lines ENDING in advantage/bonus markers:
# e.g., "Docker is an advantage", "Kubernetes (bonus points)"
LINE_ADVANTAGE_PATTERN = re.compile(
    r"(?im)^\s*([^\n]+?\b(?:advantages?|nice\s+to\s+have|a\s+plus|bonus\s+points?|bonus)\b\s*[.!?)]*)\s*$"
)

# Connectors and keywords stripping from the end of lines
CONNECTOR_STRIP_PATTERN = re.compile(
    r"(?i)\s*(?:[-–—:,]|(?:\b(?:is|are|will\s+be|considered|seen\s+as)\b))"
    r".*?\(?\b(?:advantages?|nice\s+to\s+have|a\s+plus|bonus\s+points?|bonus)\b\s*[.!?)]*\s*$"
)

ADVANTAGE_WORD_STRIP_PATTERN = re.compile(
    r"(?i)\s*\(?\s*\b(?:great\s+)?(?:advantages?|nice\s+to\s+have|a\s+plus|bonus\s+points?|bonus)\b\s*[.!?)]*\s*$"
)


def extract_and_move_advantages(text: str) -> str:
    """
    Finds lines starting with 'Advantage:', 'Bonus points:', etc. (including qualifiers like
    ', none required:'), or lines ending with advantage/bonus markers.
    
    Removes them from their original location and consolidates them under an
    'Advantages:' section at the end without the prefixes attached.
    """
    if not isinstance(text, str) or not text.strip():
        return text

    extracted_advantages: list[str] = []

    # 1. Handle lines STARTING with "Advantage:", "Bonus points:", etc.
    for match in PREFIX_ADVANTAGE_PATTERN.finditer(text):
        content = match.group(1).strip()
        if content:
            # Strip bullets if any were attached to the content itself
            cleaned_item = BULLET_STRIP_PATTERN.sub("", content).strip()
            if cleaned_item:
                extracted_advantages.append(cleaned_item)

    # Remove matched prefix lines from text
    cleaned = PREFIX_ADVANTAGE_PATTERN.sub("", text)

    # 2. Handle lines ENDING with advantage markers
    for match in LINE_ADVANTAGE_PATTERN.finditer(cleaned):
        clause = match.group(1).strip()
        if not clause:
            continue

        item = BULLET_STRIP_PATTERN.sub("", clause)
        item = CONNECTOR_STRIP_PATTERN.sub("", item).strip()
        item = ADVANTAGE_WORD_STRIP_PATTERN.sub("", item).strip()

        # Extra safety check to strip prefix if it was missed
        item = PREFIX_STRIP_PATTERN.sub("", item).strip()

        if item:
            extracted_advantages.append(item)

    # Remove matched suffix lines from text
    cleaned = LINE_ADVANTAGE_PATTERN.sub("", cleaned)

    if not extracted_advantages:
        return text

    # Condense leftover extra empty lines
    cleaned = MULTI_NEWLINE_PATTERN.sub("\n\n", cleaned).strip()

    adv_lines = "\n".join(f"- {item}" for item in extracted_advantages)

    # Append under existing header or create a new "Advantages:" section
    if ADVANTAGE_HEADER_PATTERN.search(cleaned):
        return f"{cleaned}\n{adv_lines}"
    return f"{cleaned}\n\nAdvantages:\n{adv_lines}"


# =====================================================================
# 2. JOB SECTION SLICING
# =====================================================================


def detect_section_start_lines(text: str) -> dict[str, str]:
    """Finds the exact starting marker lines for RESPONSIBILITIES, MUST_HAVE,

    and NICE_TO_HAVE sections in a job description using keyword heuristics.

    Returns a dictionary mapping section keys to the exact line found, or 'NONE'.
    If responsibilities_start cannot be found, it defaults to the first line.
    """
    results = {
        "responsibilities_start": "NONE",
        "must_have_start": "NONE",
        "nice_to_have_start": "NONE",
    }

    if not text or not text.strip():
        return results

    # 1. Phrases explicitly excluded (perks, compensation, meta titles, post-hire roadmaps/milestones)
    DISALLOWED_HEADER_PATTERNS = [
        # Document-level meta headers (excluding "job description" so it can match)
        r"^(?:\s*[-*•#]+\s*)?(?:job|position|requisition)\s+(?:posting|details|id|information)[\s:–—\-?]*$",
        r"^(?:\s*[-*•#]+\s*)?about\s+(?:the\s+)?(?:job|role|position)[\s:–—\-?]*$",
        # Post-hire roadmaps, metrics, perks
        r"\bwhat\s+success\s+looks?\s+like\b",
        r"\b(first\s+)?(30|60|90)[\s\-_]*(day|days)\b",
        r"\b(key\s+metrics|kpis|performance\s+goals)\b",
        r"\b(business|measurable)\s+impact\b",
        r"\b(benefits|perks|compensation|what\s+we\s+offer)\b",
        r"\babout\s+(us|the\s+company|our\s+team)\b",
    ]
    disallowed_regex = re.compile(
        "|".join(DISALLOWED_HEADER_PATTERNS), re.IGNORECASE
    )

    # 2. Section Keyword Patterns
    # Nice-to-Have
    NICE_TO_HAVE_PATTERNS = [
        r"^(?:\s*[-*•#]+\s*)?advantages?\b[\s:–—\-?]*$",
        r"\b(nice\s+to\s+have|strongly\s+preferred|preferred\s+qualifications?|preferred\s+skills?)\b",
        r"\b(bonus\s+points?|it'?s\s+a\s+plus\s+if|bonus\s+qualifications?)\b",
        r"\b(additional|desired|optional)\s+(qualifications?|skills?|requirements?)\b",
        r"\b(?:ways\s+to\s+)?stand\s+out(?:\s+from\s+the\s+crowd)?\b",
        r"\bhow\s+to\s+stand\s+out\b",
    ]

    # Must-Have (Supports "Job Requirements:", "You’ll fit in if you", "Who you are", etc.)
    MUST_HAVE_PATTERNS = [
        r"^(?:\s*[-*•#]+\s*)?(must\s*[-/]?\s*have|minimum\s+requirements?|basic\s+qualifications?)\b",
        r"^(?:\s*[-*•#]+\s*)?(?:(?:job|role|position|your|our|candidate|key|ideal|basic|minimum)\s+)?(requirements?|qualifications?|skills?)(\s*(?:&|and|/)\s*[\w\s]+)?[\s:–—\-?]*$",
        r"\b(all\s+you\s+(?:really\s+)?need(?:\s+is)?|what\s+you(?:'ll|\s+will)?\s+need(?:\s+to\s+succeed)?|what\s+you\s+bring)\b",
        r"\bwhat\s+we\s+(?:need|want)\s+to\s+see\b",
        r"\b(what\s+we('?re|\s+are)\s+looking\s+for|who\s+you\s+are)\b",
        r"\b(?:this\s+(?:is\s+)?(?:the\s+)?)?(?:perfect|ideal|great)\s+(?:job|role|opportunity|position)\s+for\s+(?:someone|anyone|you)(?:\s+(?:who|if))?\b",
        r"\b(?:you(?:'re|\s+are)\s+(?:a\s+)?)?(?:perfect|ideal|great)\s+fit\s+(?:if|for)\b",
        r"\byou(?:'ll|\s+will|\s+can)?\s+fit\s+(?:right\s+)?in\s+(?:if|when)\b",
        r"\bthis\s+(?:role|job|position)\s+is\s+(?:for\s+you\s+if|a\s+match\s+if)\b",
    ]

    # Responsibilities
    RESPONSIBILITIES_PATTERNS = [
        r"^(?:\s*[-*•#]+\s*)?(?:[\w\s&/,\-]+\s+)?responsibilities\b",
        r"^(?:\s*[-*•#]+\s*)?(core|key|primary|main)?\s*(contributions|duties|accountabilities|expectations)\b",
        r"^(?:\s*[-*•#]+\s*)?(?:your\s+|the\s+role['’]?s\s+|role\s*(?:&|and)\s*)?impact[\s:–—\-?]*$",
        r"^(?:\s*[-*•#]+\s*)?(?:the\s+)?(?:job|position|role|job\s+role)\s+(?:overview|summary|description)[\s:–—\-?]*$",
        r"^(?:\s*[-*•#]+\s*)?the\s+role[\s:–—\-?]*$",
        r"\bwhat\s+(?:will\s+)?(?:your|a|the)\s+(?:job|role|day|work)\s+(?:will\s+)?looks?\s+like\b",
        r"\bwhat\s+(?:(?:will\s+you|you(?:'ll|\s+will)?)\s+(?:be\s+doing|do|build|create|work\s+on|own|deliver|tackle))\b",
        r"\b(in\s+this\s+role\s+you\s+will|duties\s+and\s+responsibilities|how\s+you(?:'ll|\s+will)\s+make\s+an\s+impact|a\s+day\s+in\s+the\s+life)\b",
    ]

    nice_regex = re.compile("|".join(NICE_TO_HAVE_PATTERNS), re.IGNORECASE)
    must_regex = re.compile("|".join(MUST_HAVE_PATTERNS), re.IGNORECASE)
    resp_regex = re.compile("|".join(RESPONSIBILITIES_PATTERNS), re.IGNORECASE)

    raw_lines = [line.strip() for line in text.splitlines() if line.strip()]

    def is_valid_structural_header(line: str) -> bool:
        words = line.split()
        if len(words) > 12 or len(line) > 85:
            return False

        if line.endswith((".", ";")):
            return False

        header_text = line.rstrip(":-–— \t")

        for sep in [":", " - ", " – "]:
            if sep in header_text:
                parts = header_text.split(sep, 1)
                after_sep = parts[1].strip()
                if len(after_sep.split()) > 3:
                    return False

        if disallowed_regex.search(line):
            return False

        return True

    for line in raw_lines:
        normalized_line = line.replace("’", "'").replace("‘", "'")

        if not is_valid_structural_header(normalized_line):
            continue

        if (
            results["nice_to_have_start"] == "NONE"
            and nice_regex.search(normalized_line)
        ):
            results["nice_to_have_start"] = line
            continue

        if (
            results["must_have_start"] == "NONE"
            and must_regex.search(normalized_line)
        ):
            results["must_have_start"] = line
            continue

        if (
            results["responsibilities_start"] == "NONE"
            and resp_regex.search(normalized_line)
        ):
            results["responsibilities_start"] = line
            continue

        if all(v != "NONE" for v in results.values()):
            break

    # Fallback: if no responsibilities header was identified, default to the first line
    if results["responsibilities_start"] == "NONE" and raw_lines:
        results["responsibilities_start"] = raw_lines[0]

    return results

class JobSectionMarkers(TypedDict):
    responsibilities_start: str | None
    must_have_start: str | None
    nice_to_have_start: str | None

def slice_job_sections(
    text: str, markers: JobSectionMarkers
) -> dict[str, str | None]:
    """Slices text into responsibilities, must_have, and nice_to_have blocks

    based on the positions of detected section headers.
    """
    key_mapping = {
        "responsibilities": markers.get("responsibilities_start"),
        "must_have": markers.get("must_have_start"),
        "nice_to_have": markers.get("nice_to_have_start"),
    }

    # Locate starting character offset for each existing marker
    positions: list[tuple[int, str]] = []
    for section_name, marker_text in key_mapping.items():
        if marker_text:
            match = re.search(re.escape(marker_text.strip()), text, re.IGNORECASE)
            if match:
                positions.append((match.start(), section_name))

    positions.sort(key=lambda x: x[0])

    sections: dict[str, str | None] = {
        "responsibilities": None,
        "must_have": None,
        "nice_to_have": None,
    }

    # Slice between consecutive section markers
    for i, (start_idx, section_name) in enumerate(positions):
        end_idx = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        chunk = text[start_idx:end_idx].strip()
        sections[section_name] = chunk if chunk else None

    return sections

# Headers that introduce content outside candidate qualification scope
UNRELATED_TAIL_HEADER_PATTERNS = [
    # 1. Post-hire roadmaps & performance milestones
    r"what\s+success\s+looks?\s+like",
    r"(?:first\s+)?(?:30|60|90|180)[\s\-_]*(?:day|days)\b",
    r"(?:year\s+1|first\s+year)\s*(?:&|and)\s*beyond",
    r"performance\s+(?:goals|expectations|metrics)",
    r"key\s+(?:metrics|kpis|results|milestones)",
    r"(?:business|measurable)\s+impact",
    
    # 2. Benefits, Compensation, & Perks
    r"(?:what\s+we\s+offer|what\s+you('?ll|\s+will)\s+get)",
    r"(?:benefits|perks|compensation|rewards)(?:\s*(?:&|and|/)\s*[\w\s]+)?",
    r"why\s+(?:join\s+us|work\s+with\s+us)",
    
    # 3. Company & Culture Meta Sections
    r"about\s+(?:us|the\s+company|our\s+team|dondy)",
    r"life\s+at\s+[\w\s]+",
    r"our\s+(?:culture|values|mission)",
    
    # 4. Hiring Process & Legal / EEO Statements
    r"(?:the\s+)?hiring\s+process",
    r"(?:how\s+to\s+apply|recruitment\s+process)",
    r"(?:equal\s+opportunity|eeo|diversity)\s+(?:employer|statement)?",
]

# Compile patterns into a unified regex
UNRELATED_TAIL_REGEX = re.compile(
    r"(?:" + "|".join(UNRELATED_TAIL_HEADER_PATTERNS) + r")", 
    re.IGNORECASE
)


def truncate_unrelated_tail(section_text: str) -> str:
    """
    Detects boundaries where candidate qualifications end and unrelated tail
    content begins (e.g. 'What Success Looks Like', 30/60/90-day plans, benefits).
    
    Omits the start marker and all following text. Works on both standard newline-separated
    text and concatenated text without line breaks.
    """
    if not section_text or not isinstance(section_text, str):
        return section_text

    # Search for any unrelated section marker
    match = UNRELATED_TAIL_REGEX.search(section_text)
    if not match:
        return section_text.strip()

    cut_idx = match.start()

    # If the marker is glued directly to previous punctuation (e.g., "ownership.What Success..."),
    # we want to keep the period and truncate right after it.
    truncated = section_text[:cut_idx].rstrip(" \t\r\n-*•#:")

    return truncated

# =====================================================================
# 3. QUOTE OMISSION / TEXT SCRUBBING
# =====================================================================

QUOTE_PATTERN = re.compile(
    r'\[\s*Quote\s*:\s*["\']?(.*?)["\']?\s*\]', flags=re.IGNORECASE
)
KEY_VALUE_PATTERN = re.compile(
    r"^\s*(?:-\s*)?([A-Za-z\s]+)\s*:\s*(.*)", flags=re.IGNORECASE
)
TRAILING_QUOTE_PATTERN = re.compile(r"\[\s*Quote\s*:.*", flags=re.IGNORECASE)
MULTI_SPACE_PATTERN = re.compile(r"[^\S\r\n]+")
PARAGRAPH_COLLAPSE_PATTERN = re.compile(r"\n\s*\n+")


def _split_into_clauses(text: str) -> list[str]:
    """Splits text on sentence boundaries, commas, and common list conjunctions."""
    # Split on sentences (.?!), semicolons, commas, or " and "/" or "
    raw_parts = re.split(r"(?<=[.!?])\s+|[;,]|\s+(?:and|or)\s+", text, flags=re.IGNORECASE)
    cleaned = []
    for part in raw_parts:
        p = part.strip().strip("'\"")
        if len(p) > 3 and p.lower() != "none":
            cleaned.append(p)
    return cleaned


def _build_flexible_regex(phrase: str) -> re.Pattern:
    """Escapes literals, handles variable whitespace, and matches optional boundary punctuation."""
    stripped = re.sub(r"^[.?!,;:]+|[.?!,;:]+$", "", phrase.strip())
    words = re.split(r"\s+", stripped)
    escaped_words = [re.escape(w) for w in words if w]
    if not escaped_words:
        return re.compile(r"$^")  # Match nothing if empty
    return re.compile(r"\s+".join(escaped_words) + r"[.?!,;]?", flags=re.IGNORECASE)


def _extract_strings_from_value(value_str: str) -> list[str]:
    """Extract individual strings from bracketed list or plain string."""
    value_str = value_str.strip()
    if not value_str or value_str.lower() in ("none", "null", "[]"):
        return []

    # If formatted as a bracketed list: ["Item 1", "Item 2"]
    if value_str.startswith("[") and value_str.endswith("]"):
        try:
            parsed = ast.literal_eval(value_str)
            if isinstance(parsed, (list, tuple)):
                return [
                    str(s).strip()
                    for s in parsed
                    if str(s).strip() and str(s).strip().lower() != "none"
                ]
        except (ValueError, SyntaxError):
            matches = re.findall(r'["\'](.*?)["\']', value_str)
            if matches:
                return [m.strip() for m in matches if m.strip() and m.strip().lower() != "none"]

    # Fallback for plain single-string values
    clean_val = TRAILING_QUOTE_PATTERN.sub("", value_str).strip().strip("'\"")
    return [clean_val] if clean_val and clean_val.lower() != "none" else []


def omit_quoted_sentences(text: str | None, items: list[str] | None) -> str:
    """Extracts quotes and list items, removes matching phrases from the text,
    falling back to comma/clause-separated segments when full quotes do not match.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return ""
    if not items or not isinstance(items, list):
        return text

    candidates: set[str] = set()

    for item in items:
        item_str = str(item).strip()

        # 1. Handle [Quote: "..."]
        quote_matches = QUOTE_PATTERN.findall(item_str)
        if quote_matches:
            for q in quote_matches:
                q_clean = q.strip().strip("'\"")
                if q_clean and q_clean.lower() != "none":
                    candidates.add(q_clean)
                    # Add clause fallbacks (commas, 'or', 'and', sentences)
                    for clause in _split_into_clauses(q_clean):
                        candidates.add(clause)
            continue

        # 2. Handle key-value lines (e.g., Degree Names: [...])
        kv_match = KEY_VALUE_PATTERN.match(item_str)
        if kv_match:
            candidate_val = kv_match.group(2).strip()
            for e in _extract_strings_from_value(candidate_val):
                if len(e) > 3 and e.lower() != "none":
                    candidates.add(e)
            continue

        # 3. Direct bracketed list fallback: ["line 1", "line 2"]
        if item_str.startswith("[") and item_str.endswith("]"):
            for e in _extract_strings_from_value(item_str):
                if len(e) > 3 and e.lower() != "none":
                    candidates.add(e)
            continue

        # 4. Plain raw text fallback
        clean_item = item_str.strip("'\"")
        if clean_item and clean_item.lower() != "none":
            candidates.add(clean_item)

    if not candidates:
        return text

    # Remove candidates starting with the longest to prevent partial substring issues
    sorted_candidates = sorted(candidates, key=len, reverse=True)

    modified_text = text
    for phrase in sorted_candidates:
        pattern = _build_flexible_regex(phrase)
        modified_text = pattern.sub("", modified_text)

    # Clean up empty bullets, leftover punctuation artifacts, and extra whitespace
    modified_text = re.sub(r"^\s*[-*•]\s*$", "", modified_text, flags=re.MULTILINE)
    modified_text = re.sub(r"^[,\s]+|[,\s]+$", "", modified_text)
    modified_text = MULTI_SPACE_PATTERN.sub(" ", modified_text)
    modified_text = PARAGRAPH_COLLAPSE_PATTERN.sub("\n\n", modified_text)

    return modified_text.strip()

# =====================================================================
# 4. Validation
# =====================================================================

def validate_min_experience_years(extracted_lines: list[str], source_text: str) -> list[str]:
    """
    Validates the extracted Min Experience Years output by checking if the quote 
    actually contains words related to 'years' or 'months'.
    If not, the entry is removed. If no valid entries remain, returns 'None'.
    Works natively with lists of strings from the extraction pipeline.
    """
    none_response = ["Min Experience Years: None"]
    
    if not extracted_lines:
        return none_response

    # Join to string for easier regex matching across the block
    extracted_text = "\n".join(extracted_lines)
    
    if "Min Experience Years: None" in extracted_text:
        return none_response

    # Matches: "- Min Experience Years 1: <value> [Quote: "<quote>"]" or without dash
    line_pattern = re.compile(
        r"(?:-\s*)?Min\s+Experience\s+Years(?:\s+\d+)?\s*:\s*(.*?)\s*\[Quote:\s*[\"']?(.*?)[\"']?\]", 
        flags=re.IGNORECASE
    )
    
    # Check for years or months duration keywords
    duration_keyword_pattern = re.compile(
        r"\b(year|years|yr|yrs|month|months|mo|mos)\b", 
        flags=re.IGNORECASE
    )

    valid_entries = []
    
    # Extract and validate each line
    for match in line_pattern.finditer(extracted_text):
        value = match.group(1).strip()
        quote = match.group(2).strip()
        
        # If the quote actually mentions a duration, keep it
        if duration_keyword_pattern.search(quote):
            valid_entries.append((value, quote))
            
    # If we filtered everything out, return the standard None structure
    if not valid_entries:
        return none_response
        
    # Reconstruct the list of strings with the valid entries sequentially renumbered
    output_lines = []
    for idx, (val, quote) in enumerate(valid_entries, start=1):
        output_lines.append(f"Min Experience Years {idx}: {val} [Quote: \"{quote}\"]")
        
    return output_lines


def validate_soft_skills(
    extracted_lines: list[str], source_text: str = ""
) -> list[str]:
    none_response = ["Soft Skills: None"]

    if not extracted_lines:
        return none_response

    extracted_text = "\n".join(extracted_lines)

    # 1. Reject if explicitly None
    if re.search(
        r"Soft\s+Skills\s*:\s*\[?\s*None\s*\]?", extracted_text, re.IGNORECASE
    ):
        if not re.search(
            r"\[Quote:\s*[\"']?.+?[\"']?\]", extracted_text, re.IGNORECASE
        ):
            return none_response

    # 2. Extract Category block and Quote block
    line_pattern = re.compile(
        r"(?:[-*•]\s*)?Soft\s+Skills\s*:\s*\[?(.*?)\]?\s*\[Quote:\s*(.*?)\s*\]",
        flags=re.IGNORECASE | re.DOTALL,
    )

    matches = list(line_pattern.finditer(extracted_text))
    if not matches:
        return none_response

    category_patterns = {
        "Teamwork": r"\bteam(s|work|mate[s]?)?\b",
        "Collaboration": r"\bcollaborat",
        "Communication & Presentation": (
            r"\b(communicat\w*|present\w*|articulat\w*|verbal\w*|written|speak\w*|talk\w*)\b"
        ),
        "Language Proficiency": (
            r"\b(english|hebrew|spanish|french|german|mandarin|arabic|russian|japanese|"
            r"language[s]?|fluent|fluency|bilingual|multilingual|native|proficien\w*)\b"
        ),
        "Conflict Resolution": r"\b(conflict\w*|resolv\w*|mediat\w*)\b",
        "Mentorship & Leadership": r"\b(mentor\w*|lead(er|ership|ing)?|coach\w*|guid\w*|direct\w*)\b",
        "Adaptability & Resilience": (
            r"\b(adapt\w*|resilien\w*|flexib\w*|chang\w*|dynamic|client-facing|\bSLA\b)"
        ),
        "Working Independently": r"\b(autonom\w*|independen\w*|unsupervis\w*|self-manag\w*)\b",
        "Self-Motivation & Proactiveness": (
            r"\b(motivat\w*|proactiv\w*|driven|initiativ\w*|self-start\w*|self-driv\w*)\b"
        ),
        "Time Management": r"\b(time|priorit\w*|deadlin\w*|organiz\w*|multitask\w*)\b",
        "Curiosity & Learning Agility": (
            r"\b(curios\w*|(?<!scikit-)learn\w*|agil\w*|inquisit\w*|growth)\b"
        ),
        "Problem-solving": r"\b(problem[-\s]?solv\w*|troubleshoot\w*|analyt\w*|debug\w*)\b",
    }

    seen_quotes = set()
    clean_source = (
        re.sub(r"\s+", " ", source_text).lower() if source_text else ""
    )

    # Map category -> list of unique quote sentences
    cat_to_quotes: dict[str, list[str]] = defaultdict(list)

    for match in matches:
        raw_categories = match.group(1).strip()
        raw_quotes = match.group(2).strip()

        line_categories = [
            c.strip() for c in re.split(r"[;,]", raw_categories) if c.strip()
        ]

        # Strip outer quotes, split multiple quotes by delimiter
        unwrapped = raw_quotes.strip(" \"'“”")
        parts = re.split(r'["\'“”]?\s*;\s*["\'“”]?', unwrapped)

        found_quotes = []
        for p in parts:
            p_clean = p.strip(" \"'“”")
            if p_clean:
                found_quotes.append(p_clean)

        for sentence in found_quotes:
            sentence_clean = sentence.strip()
            if not sentence_clean:
                continue

            # Check presence in source text if provided
            if clean_source:
                clean_sentence = re.sub(r"\s+", " ", sentence_clean).lower()
                if clean_sentence not in clean_source:
                    continue

            # Assign quotes to each matching category
            for cat in line_categories:
                # Find a matching key in category_patterns
                lookup_key = next(
                    (
                        k
                        for k in category_patterns
                        if k.lower().replace("-", " ")
                        == cat.lower().replace("-", " ")
                    ),
                    None,  # No fallback category
                )

                # If it's not one of your predefined categories, skip it
                if not lookup_key:
                    continue

                pattern = category_patterns[lookup_key]

                if re.search(pattern, sentence_clean, re.IGNORECASE):
                    # Prevent duplicate quotes under the exact same category
                    if (
                        sentence_clean.lower()
                        not in [q.lower() for q in cat_to_quotes[cat]]
                    ):
                        cat_to_quotes[cat].append(sentence_clean)

    if not cat_to_quotes:
        return none_response

    # Format into consolidated lines with period-separated quotes
    validated_lines = []
    for cat, quotes in cat_to_quotes.items():
        # Ensure each quote ends with a period before joining
        normalized_quotes = [q.rstrip(" .") + "." for q in quotes]
        joined_quotes = " ".join(normalized_quotes)
        validated_lines.append(f'Soft Skills: {cat} [Quote: "{joined_quotes}"]')

    return validated_lines

DEGREE_TYPES_PATTERN = re.compile(
    r"^(\s*(?:-\s*)?)Degree\s+Types\s*:\s*\[(.*?)\]\s*(\[Quote:\s*[\"']?(.*?)[\"']?\])",
    flags=re.IGNORECASE,
)
DEGREE_NAMES_PATTERN = re.compile(
    r"^(?:\s*-\s*)?Degree\s+Names\s*:\s*(?:\[.*?\]|None)\s*\[Quote:\s*[\"']?(.*?)[\"']?\]",
    flags=re.IGNORECASE,
)
REMAINING_STUDIES_PATTERN = re.compile(
    r"^(\s*(?:-\s*)?)Remaining\s+Studies\s*:\s*(.*?)\s*\[Quote:\s*[\"']?(.*?)[\"']?\]",
    flags=re.IGNORECASE,
)
GRADE_PATTERN = re.compile(
    r"^(\s*(?:-\s*)?)Grade\s*:\s*(.*?)\s*\[Quote:\s*[\"']?(.*?)[\"']?\]",
    flags=re.IGNORECASE,
)
FLEXIBILITY_PATTERN = re.compile(
    r"\b(related|similar|equivalent|relevant)\b(.*?)(?=[.?!;\n]|$)",
    flags=re.IGNORECASE,
)
# Matches quotes that only consist of numbers/punctuation and 'year(s)' or 'yr(s)'
ONLY_YEARS_PATTERN = re.compile(
    r"^[\s\d\+\-\./]*(?:yr|yrs|year|years)[\s\d\+\-\./]*$",
    flags=re.IGNORECASE,
)
# Explicit educational progress indicators (excludes generic standalone "year")
STUDY_INDICATOR_PATTERN = re.compile(
    r"\b(remaining|studies|study|semester|semesters|student|graduation|graduate|expected)\b",
    flags=re.IGNORECASE,
)
GRADE_KEYWORDS_PATTERN = re.compile(
    r"\b(grade|grades|gpa|score|scores|marks|cum laude|honors|honours|distinction|average|cgpa)\b",
    flags=re.IGNORECASE,
)
EXPERIENCE_KEYWORDS_PATTERN = re.compile(
    r"\b(experience|industry|track record|proven)\b",
    flags=re.IGNORECASE,
)

DEGREE_REPLACEMENTS = [
    (re.compile(r"\bb\.?s\.?\b(?!\w)", flags=re.IGNORECASE), "B.Sc."),
    (re.compile(r"\bm\.?s\.?\b(?!\w)", flags=re.IGNORECASE), "M.Sc."),
]


def _normalize_degree_types(types_str: str) -> str:
    """Replaces B.S. with B.Sc. and M.S. with M.Sc. while preserving spacing/structure."""
    for pattern, replacement in DEGREE_REPLACEMENTS:
        types_str = pattern.sub(replacement, types_str)
    return types_str


def _get_context_from_source(quote: str, text: str, window_size: int = 150) -> str:
    if not quote or quote.lower() in {"none", ""}:
        anchor = re.search(
            r"\b(b\.?s\.?c|m\.?s\.?c|b\.?a|m\.?a|ph\.?d|degree|bachelor|master|university)\b",
            text,
            re.IGNORECASE,
        )
        if anchor:
            idx = anchor.start()
            return text[max(0, idx - window_size) : min(len(text), idx + window_size)]
        return ""

    idx = text.lower().find(quote.lower())
    if idx != -1:
        start = max(0, idx - window_size)
        end = min(len(text), idx + len(quote) + window_size)
        return text[start:end]

    return quote


def validate_education(extracted_lines: list[str], source_text: str) -> list[str]:
    """Validates the extracted Education output.

    - Normalizes Degree Types: [B.S., M.S.] -> [B.Sc., M.Sc.].
    - Finds the 'Degree Types' or 'Degree Names' quote to check for flexibility.
    - Replaces 'Remaining Studies' with None if the value matches the quote,
      if the quote refers to work experience, if it is only an isolated year duration,
      or if explicit study/semester keywords are absent.
    - Ensures 'Grade' lines refer to academic metrics.
    """
    if not extracted_lines:
        return []

    # 1. Extract the best Degree quote to find flexibility context
    degree_quote = ""
    for line in extracted_lines:
        match_types = DEGREE_TYPES_PATTERN.search(line)
        if match_types:
            degree_quote = match_types.group(4).strip()
            break
        match_names = DEGREE_NAMES_PATTERN.search(line)
        if match_names:
            degree_quote = match_names.group(1).strip()
            break

    degree_context_text = _get_context_from_source(degree_quote, source_text)

    # 2. Check for flexibility in context
    matched_flex_quote = None
    if degree_context_text:
        flex_match = FLEXIBILITY_PATTERN.search(degree_context_text)
        if flex_match:
            matched_flex_quote = (flex_match.group(1) + flex_match.group(2)).strip()

    output_lines = []
    injected = False

    for line in extracted_lines:
        # Check and normalize Degree Types
        types_match = DEGREE_TYPES_PATTERN.search(line)
        if types_match:
            prefix = types_match.group(1) or ""
            raw_types = types_match.group(2)
            quote_block = types_match.group(3)
            normalized_types = _normalize_degree_types(raw_types)
            line = f"{prefix}Degree Types: [{normalized_types}] {quote_block}"

        # Check and validate Remaining Studies
        rem_match = REMAINING_STUDIES_PATTERN.search(line)
        if rem_match:
            prefix = rem_match.group(1) or ""
            text_val = rem_match.group(2).strip()
            quote_val = rem_match.group(3).strip()

            norm_text = re.sub(r"[\s\"'“”.,;:!?-]", "", text_val).lower()
            norm_quote = re.sub(r"[\s\"'“”.,;:!?-]", "", quote_val).lower()

            rem_context = _get_context_from_source(quote_val, source_text, window_size=100)

            # Invalidate if the quote is just an isolated number + year (e.g. "1+ year", "2 years")
            quote_is_only_years = bool(ONLY_YEARS_PATTERN.fullmatch(quote_val.strip()))

            quote_has_studies = bool(STUDY_INDICATOR_PATTERN.search(quote_val))
            context_has_studies = bool(STUDY_INDICATOR_PATTERN.search(rem_context))
            quote_is_work_exp = bool(EXPERIENCE_KEYWORDS_PATTERN.search(quote_val))

            is_invalid = (
                quote_val.lower() in {"none", ""}
                or norm_text == norm_quote
                or quote_is_work_exp
                or quote_is_only_years
                or not (quote_has_studies or context_has_studies)
            )

            if is_invalid:
                line = f'{prefix}Remaining Studies: None [Quote: "None"]'

        # Check and validate Grade
        grade_match = GRADE_PATTERN.search(line)
        if grade_match:
            prefix = grade_match.group(1) or ""
            quote_val = grade_match.group(3).strip()

            grade_context = _get_context_from_source(quote_val, source_text, window_size=80)
            target_check = grade_context if grade_context else quote_val

            has_grade_keywords = bool(GRADE_KEYWORDS_PATTERN.search(target_check))
            quote_is_exp = bool(EXPERIENCE_KEYWORDS_PATTERN.search(quote_val))

            if not has_grade_keywords or quote_is_exp:
                line = f'{prefix}Grade: None [Quote: "None"]'

        output_lines.append(line)

        # Inject Flexibility right after Degree Names
        if DEGREE_NAMES_PATTERN.search(line):
            has_dash = line.lstrip().startswith("-")
            prefix = "- " if has_dash else ""
            if matched_flex_quote:
                output_lines.append(
                    f'{prefix}Accepting Related Degrees or Experience: Yes [Quote: "{matched_flex_quote}"]'
                )
            else:
                output_lines.append(
                    f'{prefix}Accepting Related Degrees or Experience: No [Quote: "None"]'
                )
            injected = True

    # Fallback injection if Degree Names was missing from output
    if not injected:
        has_dash = any(l.lstrip().startswith("-") for l in extracted_lines)
        prefix = "- " if has_dash else ""
        if matched_flex_quote:
            output_lines.append(
                f'{prefix}Accepting Related Degrees or Experience: Yes [Quote: "{matched_flex_quote}"]'
            )
        else:
            output_lines.append(
                f'{prefix}Accepting Related Degrees or Experience: No [Quote: "None"]'
            )

    return output_lines

SKILL_QUOTE_PATTERN = re.compile(
    r"^(.*?)\s*\[Quote:\s*[\"']?(.*?)[\"']?\s*\]$",
    re.IGNORECASE | re.DOTALL,
)

def validate_hard_skills(extracted_lines: list[str], source_text: str) -> list[str]:
    # Maps normalized skill name -> (original_line, quote_length)
    best_skills: dict[str, tuple[str, int]] = {}

    for line in extracted_lines:
        cleaned = line.strip()
        if not cleaned:
            continue

        if cleaned.startswith(("- ", "* ")):
            cleaned = cleaned[2:].strip()

        match = SKILL_QUOTE_PATTERN.match(cleaned)
        if match:
            skill_name = match.group(1).strip()
            quote = match.group(2).strip()
            quote_len = len(quote)
        else:
            skill_name = cleaned
            quote_len = 0

        key = skill_name.lower()

        if key not in best_skills or quote_len > best_skills[key][1]:
            best_skills[key] = (cleaned, quote_len)

    return [f"Hard Skills: [{line}]" for line, _ in best_skills.values()]

TRAILING_PUNCT = " \t\r\n\"'“”‘’.,;:!?[](){}"
IGNORE_WORDS = {"none", "no", "n/a", "null", "...", "[]", ""}

STYLES = {
    "mand": {
        "bg": "rgba(230, 155, 0, 0.32)",
        "border": "rgba(230, 155, 0, 0.5)",
        "color": "#ffe082",
        "badge": "#e69b00",
        "title": "Mandatory Requirements",
    },
    "adv": {
        "bg": "rgba(59, 130, 246, 0.28)",
        "border": "rgba(59, 130, 246, 0.5)",
        "color": "#93c5fd",
        "badge": "#3b82f6",
        "title": "Advantages / Nice-to-Have",
    },
}

def _clean_token(text: str) -> str:
    """Removes outer punctuation, quotes, and brackets."""
    return text.strip(TRAILING_PUNCT)

def _extract_tokens_from_item(item_str: str) -> list[str]:
    """Parses quotes, 'Hard Skill: [Domain: a, b]', or standard lists into pure keywords."""
    s = re.sub(r"^[\s*•\-–—]+\s*", "", str(item_str).strip())
    if not s or s.lower() in IGNORE_WORDS:
        return []

    # 1. Quote format: [Quote: "..."]
    quote_match = re.search(r'\[Quote:\s*["“]?([^"”\]]+)["”]?\]', s, flags=re.IGNORECASE)
    if quote_match:
        return [
            token
            for part in re.split(r"[;/]", quote_match.group(1))
            if (token := _clean_token(part)) and token.lower() not in IGNORE_WORDS
        ]

    # 2. Hard Skill: [...] or Domain: [...] wrapper -> peel off to the deepest content
    # If wrapped in Hard Skill: [...], extract the content inside brackets
    bracket_inner = re.search(r"\[(.*)\]", s)
    if bracket_inner:
        s = bracket_inner.group(1).strip()

    # If there is a domain label (e.g., 'Programming Languages: Python, C++' or 'Names: Python')
    # we take what is after the LAST colon to get the actual values
    if ":" in s:
        s = s.rsplit(":", 1)[1]

    # 3. Split remaining text on commas/semicolons
    tokens = []
    for chunk in re.split(r"[,;]", s):
        clean = _clean_token(chunk)
        if clean and clean.lower() not in IGNORE_WORDS:
            tokens.append(clean)
    return tokens

def display_job_comparison(
    df,
    idx: int,
    text_col: str,
    mand_col: str | None = None,
    adv_col: str | None = None,
):
    if idx not in df.index:
        print(f"Index {idx} not found in DataFrame.")
        return

    row = df.loc[idx]
    original_text = str(row[text_col]) if row[text_col] is not None else ""

    # 1. Extract target phrases per category
    targets = []
    for col, category in [(mand_col, "mand"), (adv_col, "adv")]:
        if col and col in df.columns and row[col]:
            for item in row[col]:
                for token in _extract_tokens_from_item(item):
                    targets.append((token, category))

    # Sort descending by length so longer phrases get prioritized over sub-words
    targets.sort(key=lambda x: len(x[0]), reverse=True)

    # 2. Match non-overlapping spans
    occupied_indices = set()
    chosen_spans = []

    for phrase, category in targets:
        escaped = re.escape(phrase)
        prefix = r"(?:\b|(?<=[^a-zA-Z0-9]))" if phrase[0].isalnum() else r"(?<![a-zA-Z0-9])"
        suffix = r"(?:\b|(?=[^a-zA-Z0-9]))" if phrase[-1].isalnum() else rf"(?![a-zA-Z0-9]|{re.escape(phrase[-1])})"
        pattern = re.compile(rf"{prefix}({escaped}){suffix}", flags=re.IGNORECASE)

        for m in pattern.finditer(original_text):
            span_range = range(*m.span(1))
            if not occupied_indices.isdisjoint(span_range):
                continue
            occupied_indices.update(span_range)
            chosen_spans.append((m.start(1), m.end(1), category))

    # 3. Build highlighted text
    chosen_spans.sort(key=lambda x: x[0])
    html_pieces = []
    curr_idx = 0

    for start, end, category in chosen_spans:
        if start > curr_idx:
            html_pieces.append(html.escape(original_text[curr_idx:start]))

        style = STYLES[category]
        matched_text = html.escape(original_text[start:end])
        html_pieces.append(
            f'<mark style="background-color: {style["bg"]}; color: {style["color"]}; '
            f'padding: 2px 5px; border-radius: 4px; border: 1px solid {style["border"]}; '
            f'font-weight: 600;">{matched_text}</mark>'
        )
        curr_idx = end

    if curr_idx < len(original_text):
        html_pieces.append(html.escape(original_text[curr_idx:]))

    highlighted_text = "".join(html_pieces)

    # 4. Build layout boxes & legend
    legend_items = []
    box_items = []

    for col, cat in [(mand_col, "mand"), (adv_col, "adv")]:
        if not (col and col in df.columns):
            continue
        cfg = STYLES[cat]
        items = row[col] or []
        list_html = (
            "".join(f'<li style="margin-bottom: 6px;">{html.escape(str(x))}</li>' for x in items)
            or '<li style="color: #888;">None</li>'
        )
        legend_items.append(
            f'<span><span style="display:inline-block; width:10px; height:10px; background:{cfg["badge"]}; '
            f'border-radius:2px; margin-right:4px;"></span> {cfg["title"].split()[0]}</span>'
        )
        box_items.append(
            f'<div style="flex: 1; min-width: 280px; background: #252526; padding: 16px; border-radius: 8px; '
            f'border: 1px solid #444; border-left: 5px solid {cfg["badge"]};">'
            f'<h3 style="margin: 0 0 12px 0; color: {cfg["color"]}; font-size: 16px; font-weight: 600;">{cfg["title"]}</h3>'
            f'<ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #e6e6e6;">{list_html}</ul>'
            f'</div>'
        )

    # 5. Render final HTML
    html_output = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.7; max-width: 1200px; padding: 24px; 
                background-color: #1e1e1e; color: #e0e0e0; 
                border: 1px solid #383838; border-radius: 10px;">
        <h2 style="margin-top: 0; color: #ffffff; font-size: 24px; border-bottom: 1px solid #383838; padding-bottom: 10px;">
            Job Index {idx} — Requirements Comparison
        </h2>
        <div style="display: flex; gap: 14px; margin-bottom: 16px; font-size: 13px;">
            {" ".join(legend_items)}
        </div>
        <div style="display: flex; gap: 16px; margin: 0 0 28px 0; flex-wrap: wrap;">
            {"".join(box_items)}
        </div>
        <h3 style="color: #9cdcfe; margin-bottom: 10px; font-size: 18px;">Original Text Highlights</h3>
        <div style="background: #141414; border: 1px solid #333333; padding: 20px; 
                    border-radius: 8px; white-space: pre-wrap; font-size: 15px; 
                    font-family: 'Consolas', 'Fira Code', monospace; color: #e0e0e0; line-height: 1.8;">{highlighted_text}</div>
    </div>
    """

    display(HTML(html_output))