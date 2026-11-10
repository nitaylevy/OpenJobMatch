import re
from datetime import datetime
from dateutil import parser
from typing import Any, Optional, List, Dict
from dataclasses import dataclass
from prompts import (
    JOB_TITLE_EXTRACTION_SYSTEM_PROMPT,
    EDUCATION_EXTRACTION_SYSTEM_PROMPT,
    SKILLS_EXTRACTION_SYSTEM_PROMPT,
    WORK_EXPERIENCE_EXTRACTION_SYSTEM_PROMPT,
    EXPERIENCE_AND_JOB_TITLE_EXTRACTION_SYSTEM_PROMPT
)
from utils import (
    calculate_years,
)

@dataclass
class BedrockConfig:
    bedrock_runtime: Any
    model_name: str
    max_generation_tokens: int

# --- LLM Extraction Functions ---
def extract_skills_from_text(text: str, cfg: BedrockConfig) -> list[str]:
    user_prompt = f"Based on the following resume text, please return a list of names of skills and tools I know:\n\n<resume>\n{text}\n</resume>"
    bedrock_response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": SKILLS_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": cfg.max_generation_tokens}
    )
    raw_text = bedrock_response['output']['message']['content'][0]['text']
    
    skills = []
    seen = set()
    for line in raw_text.splitlines():
        cleaned = re.sub(r"^\s*([*\-•]|\d+\.)\s*", "", line).strip()
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            skills.append(cleaned)
    return skills

def extract_career_info(text: str, cfg: BedrockConfig) -> dict:
    user_prompt = f"Extract the applicant's headline job title and work experience from the following resume:\n\n<resume>\n{text}\n</resume>"
    response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": EXPERIENCE_AND_JOB_TITLE_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": cfg.max_generation_tokens, "temperature": 0.0},
    )
    raw_text = response["output"]["message"]["content"][0]["text"]
    
    title_match = re.search(r"JOB TITLE:\s*(.*?)(?=\n+EXPERIENCE:|$)", raw_text, re.IGNORECASE | re.DOTALL)
    job_title = title_match.group(1).strip() if title_match and title_match.group(1).strip().lower() != "none" else None

    experience, seen_experiences = [], set()
    exp_match = re.search(r"EXPERIENCE:\s*(.*)", raw_text, re.IGNORECASE | re.DOTALL)
    
    if exp_match:
        for line in exp_match.group(1).splitlines():
            match = re.match(r"^[\*\-•]?\s*(.*?):\s*(.+)$", line.strip(), re.IGNORECASE)
            if match:
                role, dates = match.group(1).strip(), match.group(2).strip()
                if role.lower() != "none" and (entry_key := (role.lower(), dates.lower())) not in seen_experiences:
                    seen_experiences.add(entry_key)
                    experience.append({
                        "role": role, 
                        "dates": dates, 
                        "years": calculate_years(dates)
                    })
    return {"job_title": job_title, "experience": experience}

def extract_education(text: str, cfg: BedrockConfig) -> list[dict]:
    user_prompt = f"Extract all education records from the following resume:\n\n<resume>\n{text}\n</resume>"
    response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": EDUCATION_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": cfg.max_generation_tokens, "temperature": 0.0},
    )
    raw_text = response["output"]["message"]["content"][0]["text"]

    education_entries = []
    seen = set()
    pattern = re.compile(
        r"^[\*\-•]?\s*Institution Type:\s*(?P<institution_type>[^|]+)\s*\|\s*"
        r"Degree Type:\s*(?P<degree_type>[^|]+)\s*\|\s*"
        r"Degree Name:\s*(?P<degree_name>[^|]+)\s*\|\s*"
        r"GPA:\s*(?P<gpa>[^|]+)\s*\|\s*"
        r"Date:\s*(?P<date>.+)$",
        re.IGNORECASE,
    )
    ongoing_keywords = ["present", "current", "currently", "now", "in progress"]
    invalid_tokens = {"none", "other", "null", "n/a", ""}

    for line in raw_text.splitlines():
        line = line.strip()
        if not line or line.lower().startswith("- none"):
            continue
        match = pattern.match(line)
        if match:
            entry = {k: v.strip() for k, v in match.groupdict().items()}

            # Normalize 'none' string values to None
            for key in ["gpa", "date"]:
                if entry[key].lower() == "none":
                    entry[key] = None

            # --- FILTER STEP ---
            # Check whether degree_type, institution_type, and date are all null/None/Other
            def is_empty_or_other(val):
                return val is None or str(val).strip().lower() in invalid_tokens

            if (
                is_empty_or_other(entry.get("degree_type"))
                and is_empty_or_other(entry.get("institution_type"))
                and is_empty_or_other(entry.get("date"))
            ):
                continue  # Omit entry completely

            entry.update({
                "degree_status": None,
                "current_study_year": None,
                "semesters_left": None,
            })

            if entry["date"]:
                # 1. Look for date tokens (e.g. ['2021', '08/2025'] or ['08/2025', '02/2027'])
                tokens = re.findall(
                    r"(?i)\b(?:present|current|now|\d{1,2}[\/.-]\d{4}|\d{4}[\/.-]\d{1,2}|\d{4})\b",
                    entry["date"],
                )

                if len(tokens) >= 2:
                    start_str, end_str = tokens[0], tokens[1]
                else:
                    parts = re.split(
                        r"\s+to\s+|\s*-\s*", entry["date"].strip(), flags=re.IGNORECASE
                    )
                    start_str = parts[0].strip() if len(parts) >= 1 else None
                    end_str = parts[1].strip() if len(parts) == 2 else parts[0].strip()

                if end_str and any(kw in end_str.lower() for kw in ongoing_keywords):
                    entry["degree_status"] = "Currently Studying"
                elif start_str and end_str:
                    try:
                        default_date = datetime(datetime.today().year, 1, 1)
                        start_date = parser.parse(start_str, default=default_date)
                        end_date = parser.parse(end_str, default=default_date)
                        today = datetime.today()

                        if end_date > today:
                            entry["degree_status"] = "Currently Studying"
                            entry["current_study_year"] = max(
                                1, today.year - start_date.year + 1
                            )
                            entry["semesters_left"] = max(
                                0, (end_date.year - today.year) * 2
                            )
                        else:
                            entry["degree_status"] = "Graduated"
                    except Exception:
                        pass

            dedup_key = (
                str(entry["institution_type"]).lower(),
                str(entry["degree_type"]).lower(),
                str(entry["degree_name"]).lower(),
                str(entry["date"]).lower(),
            )
            if dedup_key not in seen:
                seen.add(dedup_key)
                education_entries.append(entry)

    return education_entries

def extract_headline_job_title(text: str, cfg: BedrockConfig) -> Optional[str]:
    """
    Extracts the primary headline job title using JOB_TITLE_EXTRACTION_SYSTEM_PROMPT.
    """
    user_prompt = (
        "Extract the applicant's headline job title from the following resume:\n\n"
        f"<resume>\n{text}\n</resume>"
    )
    response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": JOB_TITLE_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": cfg.max_generation_tokens, "temperature": 0.0},
    )
    raw_text = response["output"]["message"]["content"][0]["text"]

    match = re.search(r"JOB TITLE:\s*(.*)", raw_text, re.IGNORECASE | re.DOTALL)
    if match:
        extracted = match.group(1).strip()
        if extracted and extracted.lower() != "none":
            return extracted
    return None


def extract_work_experience(text: str, cfg: BedrockConfig) -> List[Dict[str, Any]]:
    """
    Extracts structured work experience entries (role, dates, description, bullet points)
    using WORK_EXPERIENCE_EXTRACTION_SYSTEM_PROMPT.
    """
    user_prompt = (
        "Extract the applicant's work experience from the following resume:\n\n"
        f"<resume>\n{text}\n</resume>"
    )
    response = cfg.bedrock_runtime.converse(
        modelId=cfg.model_name,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": WORK_EXPERIENCE_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": cfg.max_generation_tokens, "temperature": 0.0},
    )
    raw_text = response["output"]["message"]["content"][0]["text"]

    # Match the block after EXPERIENCE:
    exp_match = re.search(r"EXPERIENCE:\s*(.*)", raw_text, re.IGNORECASE | re.DOTALL)
    if not exp_match:
        return []

    exp_body = exp_match.group(1).strip()
    if exp_body.lower() == "none" or exp_body.lower().startswith("- none"):
        return []

    # Split into individual role blocks starting with "- ROLE:"
    role_blocks = re.split(r"(?m)^-\s*ROLE:\s*", exp_body)

    experience = []
    seen_experiences = set()

    for block in role_blocks:
        if not block.strip():
            continue

        lines = block.splitlines()
        role = lines[0].strip()

        if role.lower() == "none" or not role:
            continue

        # Extract DATES
        dates_match = re.search(r"^\s*DATES:\s*(.*)$", block, re.MULTILINE | re.IGNORECASE)
        dates = dates_match.group(1).strip() if dates_match else "No dates provided"

        # Deduplication check
        entry_key = (role.lower(), dates.lower())
        if entry_key in seen_experiences:
            continue
        seen_experiences.add(entry_key)

        # Extract DESCRIPTION
        desc_match = re.search(
            r"^\s*DESCRIPTION:\s*(.*?)(?=^\s*BULLETS:|\Z)",
            block,
            re.MULTILINE | re.DOTALL | re.IGNORECASE,
        )
        description = None
        if desc_match:
            desc_val = desc_match.group(1).strip()
            if desc_val and desc_val.lower() != "none":
                description = desc_val

        # Extract BULLETS
        bullets = []
        bullets_match = re.search(r"^\s*BULLETS:\s*(.*)", block, re.MULTILINE | re.DOTALL | re.IGNORECASE)
        if bullets_match:
            for line in bullets_match.group(1).splitlines():
                clean_line = line.strip()
                if clean_line.startswith("*"):
                    item = clean_line.lstrip("*").strip()
                    if item and item.lower() != "none":
                        bullets.append(item)

        experience.append({
            "role": role,
            "dates": dates,
            "years": calculate_years(dates),
            "description": description,
            "bullet_points": bullets,
        })

    return experience