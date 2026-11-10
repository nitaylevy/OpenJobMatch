import re
from typing import TypedDict, Any
from dataclasses import dataclass

@dataclass
class BedrockConfig:
    bedrock_runtime: Any  # boto3 bedrock-runtime client instance
    model_name: str
    max_generation_tokens: int

class JobSectionMarkers(TypedDict):
    responsibilities_start: str | None
    must_have_start: str | None
    nice_to_have_start: str | None

def detect_job_section_start(text: str, system_prompt: str, section_parse_patterns: dict, cfg: BedrockConfig) -> JobSectionMarkers:

    user_prompt = (
        f"Detect the section starts in this job posting:\n\n"
        f"<job_post>\n{text}\n</job_post>"
    )

    bedrock_response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": system_prompt}],
        inferenceConfig={"maxTokens": 200, "temperature": 0.0},
    )

    raw_output = bedrock_response["output"]["message"]["content"][0][
        "text"
    ].strip()

    def sanitize(match: re.Match | None) -> str | None:
        if not match:
            return None
        val = match.group(1).strip().strip("\"'")
        return None if val.upper() == "NONE" else val

    return {
        key: sanitize(pattern.search(raw_output))
        for key, pattern in section_parse_patterns.items()
    }

DEFAULT_USER_TEMPLATE = (
    "Extract the requirements from the following job description according to the specified format:\n\n"
    "<text>\n{text}\n</text>"
)

def extract_single_section(
    text: str | None,
    system_prompt: str,
    cfg: BedrockConfig,
    allowed_sections: list[str] | None = None,
    user_template: str | None = None,
) -> list[str]:

    if not text or not isinstance(text, str) or not text.strip():
        return []

    template = user_template or DEFAULT_USER_TEMPLATE
        
    if "{text}" in template:
        user_prompt = template.format(text=text)
    else:
        user_prompt = f"{template}\n\n<text>\n{text}\n</text>"

    bedrock_response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": system_prompt}],
        inferenceConfig={"maxTokens": cfg.max_generation_tokens, "temperature": 0.0},
    )

    raw_text = bedrock_response["output"]["message"]["content"][0]["text"]

    # Normalize allowed sections for case-insensitive matching
    allowed_set = {s.strip().upper() for s in allowed_sections} if allowed_sections else None

    extracted_items: list[str] = []
    seen = set()
    
    # If allowed_sections is specified, default to False until an allowed header is encountered
    is_active_section = allowed_set is None

    for line in raw_text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue

        # Check if line is a Markdown header (e.g., "### EDUCATION")
        header_match = re.match(r"^#{1,6}\s*(.+)$", trimmed)
        if header_match:
            if allowed_set is not None:
                header_title = header_match.group(1).strip().upper()
                # Activate collection only if this header matches the allowed list
                is_active_section = header_title in allowed_set
            continue

        # If we are currently under an unapproved section, skip its bullet points
        if not is_active_section:
            continue

        # Strip bullet characters
        cleaned = re.sub(r"^\s*([*\-•]|\d+\.)\s*", "", trimmed).strip()

        # Skip empty lines, 'none' place-holders, or leftover markers
        if not cleaned or cleaned.lower() == "none":
            continue

        # Deduplicate
        cleaned_lower = cleaned.lower()
        if cleaned_lower not in seen:
            seen.add(cleaned_lower)
            extracted_items.append(cleaned)

    return extracted_items
