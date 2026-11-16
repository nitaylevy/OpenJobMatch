import json
import os
import re
import boto3
from botocore.config import Config
import uuid
from datetime import datetime, timezone

# Local Application / Internal Modules (Must be bundled with the Lambda)
from bedrock import BedrockConfig, extract_single_section
from prompts import (
    AVAILABILITY_PROMPT,
    EDUCATION_PROMPT,
    JOB_SOFTSKILLS_PARSER_PROMPT,
    JOB_TOOLS_PARSER_PROMPT,
    MIN_EXPERIENCE_PROMPT,
)
from utils import (
    extract_and_move_advantages,
    omit_quoted_sentences,
    slice_job_sections,
    validate_education,
    validate_min_experience_years,
    validate_soft_skills,
    validate_hard_skills,
    detect_section_start_lines,
    truncate_unrelated_tail,
)

# ==============================================================================
# Global Configuration (Initialized during Lambda cold start)
# ==============================================================================
REGION = os.environ.get("AWS_DEFAULT_REGION", "eu-west-1")
MODEL_NAME = os.environ.get("MODEL_NAME", "google.gemma-3-4b-it")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "weekly-jobs")
MAX_GENERATION_TOKENS = 768

boto_config = Config(
    retries={'max_attempts': 5, 'mode': 'standard'},
    max_pool_connections=50 
)
bedrock_runtime = boto3.client('bedrock-runtime', region_name=REGION, config=boto_config)
s3_client = boto3.client('s3', region_name=REGION)

config = BedrockConfig(
    bedrock_runtime=bedrock_runtime,
    model_name=MODEL_NAME,
    max_generation_tokens=MAX_GENERATION_TOKENS,
)

KV_REGEX = re.compile(r"^([^:]+):\s*(.*)$")

# ==============================================================================
# Pipeline Definitions
# ==============================================================================
MANDATORY_STEPS = [
    ("Pass 1: Education",     EDUCATION_PROMPT,             ["EDUCATION"],                    validate_education,               None),
    ("Pass 2: Availability",  AVAILABILITY_PROMPT,          ["AVAILABILITY"],                 None,                             None),
    ("Pass 3: Min Exp",       MIN_EXPERIENCE_PROMPT,        ["REQUIRED YEARS OF EXPERIENCE"], validate_min_experience_years,    None),
    ("Pass 4: Soft Skills",   JOB_SOFTSKILLS_PARSER_PROMPT, ["SOFT SKILLS"],                  validate_soft_skills,             None),
    ("Pass 5: Hard Skills",   JOB_TOOLS_PARSER_PROMPT,      None,                             validate_hard_skills,             None),
]

ADVANTAGE_STEPS = [
    ("Pass 1: Education",             EDUCATION_PROMPT,             ["EDUCATION"],            validate_education,               None),
    ("Pass 2: Advantage Soft Skills", JOB_SOFTSKILLS_PARSER_PROMPT, ["SOFT SKILLS"],          validate_soft_skills,             None),
    ("Pass 3: Advantage Hard Skills", JOB_TOOLS_PARSER_PROMPT,      None,                     validate_hard_skills,             None)
]

# ==============================================================================
# Helper Functions
# ==============================================================================
def merge_qualifications(base_list: list[str], new_list: list[str]) -> list[str]:
    """Appends newly extracted items to the base list[cite: 1]."""
    base = base_list if isinstance(base_list, list) else []
    added = new_list if isinstance(new_list, list) else []

    valid_added = [
        item for item in added
        if item.strip() and "Soft Skills Sentence: None" not in item
    ]
    return base + valid_added

def run_single_extraction_pipeline(text: str, steps: list) -> list[str]:
    """Iteratively extracts criteria from a single text block without using Pandas[cite: 1]."""
    working_text = text or ""
    results = []

    for step in steps:
        prompt = step[1]
        sections = step[2]
        validation_fn = step[3] if len(step) > 3 else None
        user_template = step[4] if len(step) > 4 else None

        # 1. Standard section extraction
        extracted = extract_single_section(
            text=working_text, 
            system_prompt=prompt, 
            cfg=config,
            allowed_sections=sections, 
            user_template=user_template
        )
        
        # 2. Apply validation function if provided
        if validation_fn:
            extracted = validation_fn(extracted, working_text)

        # 3. Omit extracted sentences from remaining text
        working_text = omit_quoted_sentences(working_text, extracted)

        # 4. Accumulate extracted results
        results = merge_qualifications(results, extracted)

    return results

MIN_EXP_KEY_REGEX = re.compile(r"^Min Experience Years(?:\s+\d+)?$", re.IGNORECASE)

ARRAY_FIELDS = (
    "Hard Skills",
    "Advantage - Hard Skills",
    "Min Experience Years",
    "Soft Skills",
    "Advantage - Soft Skills",
)

def _is_empty_token(val) -> bool:
    if val is None:
        return True
    s = str(val).strip()
    return s.upper() in ("", "NONE", "NAN") or s.lower().startswith("none [quote:")

def ensure_string_list(val) -> list[str]:
    """Normalizes None, 'None', a single string, or a list into a clean list[str]."""
    if _is_empty_token(val):
        return []
    if isinstance(val, (list, tuple)):
        return [str(v).strip() for v in val if not _is_empty_token(v)]
    return [str(val).strip()]

def parse_list_to_dict(items: list | None) -> dict:
    if not isinstance(items, (list, tuple)):
        return {}

    result = {}
    for item in items:
        item = str(item).strip()
        match = KV_REGEX.match(item)
        if not match:
            continue

        raw_key = match.group(1).strip()
        val = match.group(2).strip()

        # Collapse "Min Experience Years 1", "Min Experience Years 2", etc. into "Min Experience Years"
        if MIN_EXP_KEY_REGEX.match(raw_key):
            key = "Min Experience Years"
            if not _is_empty_token(val):
                result.setdefault(key, []).append(val)
            else:
                result.setdefault(key, [])
            continue

        if raw_key in result:
            if isinstance(result[raw_key], list):
                result[raw_key].append(val)
            else:
                result[raw_key] = [result[raw_key], val]
        else:
            result[raw_key] = val

    return result

def row_to_json_record(row: dict) -> dict:
    record = row.copy()

    # Flatten mandatory fields
    record.update(parse_list_to_dict(record.pop("mandatory", [])))

    # Flatten advantages fields (prefixed if keys collide)
    adv_dict = parse_list_to_dict(record.pop("advantages", []))
    for k, v in adv_dict.items():
        key_name = f"Advantage - {k}" if k in record else k
        record[key_name] = v

    # Guarantee array fields are always lists (even if missing, single-valued, or "None")
    for field in ARRAY_FIELDS:
        record[field] = ensure_string_list(record.get(field))

    return record

# ==============================================================================
# Lambda Handler
# ==============================================================================
def lambda_handler(event, context):
    batch_item_failures = []
    skipped_count = 0
    athena_records = []

    records = event.get("Records") or [{"body": json.dumps(event), "messageId": "direct-call"}]

    for record in records:
        message_id = record.get("messageId")
        try:
            body = json.loads(record["body"])

            job_id = str(body.get("id") or "").strip()
            job_company = str(body.get("company") or "").strip()
            raw_text = body.get("content_full") or ""

            if not job_id or not job_company:
                print(f"Skipping record {message_id}: missing id or company.")
                skipped_count += 1
                continue

            # Step 1–4: Clean and slice sections
            text = extract_and_move_advantages(raw_text)
            markers = detect_section_start_lines(text)
            sliced_sections = slice_job_sections(text, markers)

            responsibilities = str(sliced_sections.get("responsibilities") or "").strip()
            nice_to_have = str(sliced_sections.get("nice_to_have") or "").strip()
            must_have = str(sliced_sections.get("must_have") or "").strip()

            if nice_to_have and nice_to_have.upper() not in ["NONE", "NAN"]:
                nice_to_have = truncate_unrelated_tail(nice_to_have)
            elif must_have and must_have.upper() not in ["NONE", "NAN"]:
                must_have = truncate_unrelated_tail(must_have)

            # Step 5: Extraction pipelines
            row = {
                "job_id": job_id,
                "job_company": job_company,
                "responsibilities": responsibilities,
                "mandatory": run_single_extraction_pipeline(must_have, MANDATORY_STEPS),
                "advantages": run_single_extraction_pipeline(nice_to_have, ADVANTAGE_STEPS),
            }

            athena_records.append(row_to_json_record(row))

        except Exception as e:
            print(f"Error processing record {message_id}: {e}")
            batch_item_failures.append({"itemIdentifier": message_id})

    if athena_records:
        now = datetime.now(timezone.utc)
        athena_key = (
            f"scanned_jobs/year={now:%Y}/month={now:%m}/day={now:%d}/"
            f"scanned_{now:%H%M%S}_{uuid.uuid4().hex[:6]}.jsonl"
        )
        jsonl_content = "\n".join(json.dumps(rec, ensure_ascii=False) for rec in athena_records)

        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=athena_key,
            Body=jsonl_content.encode("utf-8"),
            ContentType="application/jsonlines"
        )
        print(f"Uploaded {len(athena_records)} scanned jobs to {athena_key}")

    print(f"Batch completed: {skipped_count} skipped.")
    return {"batchItemFailures": batch_item_failures}