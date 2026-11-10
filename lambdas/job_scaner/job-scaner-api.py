import json
import os
import re
import boto3
from botocore.config import Config

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
BUCKET_NAME = "daily-scanned-jobs"
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

def parse_list_to_dict(items: list | None) -> dict:
    if not isinstance(items, (list, tuple)):
        return {}

    result = {}
    for item in items:
        item = str(item).strip()
        match = KV_REGEX.match(item)
        if not match:
            continue

        key = match.group(1).strip()
        val = match.group(2).strip()

        if key in result:
            if isinstance(result[key], list):
                result[key].append(val)
            else:
                result[key] = [result[key], val]
        else:
            result[key] = val

    return result

def row_to_json_record(row: dict) -> dict:
    record = row.copy()

    # Flatten mandatory fields[cite: 1]
    record.update(parse_list_to_dict(record.pop("mandatory", [])))

    # Flatten advantages fields (prefixed if keys collide)[cite: 1]
    adv_dict = parse_list_to_dict(record.pop("advantages", []))
    for k, v in adv_dict.items():
        key_name = f"Advantage - {k}" if k in record else k
        record[key_name] = v

    return record

# ==============================================================================
# Lambda Handler
# ==============================================================================
def lambda_handler(event, context):
    batch_item_failures = []
    skipped_count = 0
    
    # Check if invoked via SQS
    records = event.get("Records", [])
    
    # Fallback to direct invocation if testing via console/boto3
    if not records:
        records = [{"body": json.dumps(event), "messageId": "direct-call"}]

    for record in records:
        message_id = record.get("messageId")
        try:
            body = json.loads(record["body"])

            job_id = body.get("job_id")
            job_company = body.get("job_company")
            raw_text = body.get("job_description", "")

            # Validation check: skip if job_id or job_company is missing/empty
            if not job_id or not job_company or not str(job_id).strip() or not str(job_company).strip():
                print(f"Skipping record {message_id}: missing job_id or job_company.")
                skipped_count += 1
                continue

            # Clean whitespace
            job_id = str(job_id).strip()
            job_company = str(job_company).strip()

            # Step 1: Normalize inline advantages
            text = extract_and_move_advantages(raw_text)

            # Step 2: Detect section boundaries
            markers = detect_section_start_lines(text)

            # Step 3: Slice sections
            sliced_sections = slice_job_sections(text, markers)

            # Step 4: Clean final sections safely
            responsibilities = str(sliced_sections.get("responsibilities") or "").strip()
            nice_to_have = str(sliced_sections.get("nice_to_have") or "").strip()
            must_have = str(sliced_sections.get("must_have") or "").strip()

            if nice_to_have and nice_to_have.upper() not in ["NONE", "NAN"]:
                nice_to_have = truncate_unrelated_tail(nice_to_have)
            elif must_have and must_have.upper() not in ["NONE", "NAN"]:
                must_have = truncate_unrelated_tail(must_have)

            # Step 5: Run Extraction Pipelines
            mandatory_list = run_single_extraction_pipeline(must_have, MANDATORY_STEPS)
            advantages_list = run_single_extraction_pipeline(nice_to_have, ADVANTAGE_STEPS)

            row = {
                "job_id": job_id,
                "job_company": job_company,
                "responsibilities": responsibilities,
                "mandatory": mandatory_list,
                "advantages": advantages_list,
            }

            processed_record = row_to_json_record(row)

            s3_key = f"{job_company}/{job_id}.json"
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Body=json.dumps(processed_record, ensure_ascii=False, indent=2),
                ContentType="application/json"
            )

        except Exception as e:
            print(f"Error processing record {message_id}: {str(e)}")
            # Report failure so SQS can retry this specific message
            batch_item_failures.append({"itemIdentifier": message_id})

    print(f"Batch completed: {skipped_count} record(s) skipped due to missing job_id or job_company.")

    # Return partial batch failure format for SQS
    return {"batchItemFailures": batch_item_failures}