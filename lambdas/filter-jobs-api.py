import json
import os
import re
import boto3

BUCKET_NAME = os.environ.get("BUCKET_NAME", "weekly-jobs")
LATEST_JOBS_KEY = os.environ.get("LATEST_JOBS_KEY", "exports/latest_jobs.json")

s3_client = boto3.client("s3")

# Warm container cache (avoids re-downloading latest_jobs.json if S3 ETag hasn't changed)
_CACHE = {"etag": None, "jobs": []}

EXP_NUMBER_REGEX = re.compile(r"(\d+(?:\.\d+)?)")

def _load_latest_jobs() -> list[dict]:
    """Loads exports/latest_jobs.json from S3, using ETag caching across warm invocations."""
    head = s3_client.head_object(Bucket=BUCKET_NAME, Key=LATEST_JOBS_KEY)
    etag = head.get("ETag")

    if _CACHE["etag"] == etag and _CACHE["jobs"]:
        return _CACHE["jobs"]

    obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=LATEST_JOBS_KEY)
    jobs = json.loads(obj["Body"].read().decode("utf-8"))

    # Pre-sort newest first using fetched_date and updated_at_formatted
    jobs.sort(
        key=lambda j: (
            str(j.get("fetched_date") or ""),
            str(j.get("updated_at_formatted") or ""),
        ),
        reverse=True,
    )

    _CACHE["etag"] = etag
    _CACHE["jobs"] = jobs
    return jobs

def _extract_required_years(exp_list: list[str] | None) -> float | None:
    """
    Extracts the minimum years number from entries like:
    '3+ [Quote: "3+ years of experience as a SQL Server DBA."]'
    Returns None if no numeric experience requirement is present.
    """
    if not exp_list:
        return None

    years = []
    for entry in exp_list:
        # Look at the leading token before '[Quote:' first, then fallback to full string
        prefix = str(entry).split("[Quote:")[0]
        match = EXP_NUMBER_REGEX.search(prefix) or EXP_NUMBER_REGEX.search(str(entry))
        if match:
            years.append(float(match.group(1)))

    return min(years) if years else None

def _matches_any_substring(haystack: str, needles: list[str]) -> bool:
    haystack_lower = haystack.lower()
    return any(needle.lower() in haystack_lower for needle in needles)

def filter_jobs(jobs: list[dict], filters: dict) -> list[dict]:
    companies = [c.strip().lower() for c in (filters.get("companies") or []) if str(c).strip()]
    titles = [t.strip() for t in (filters.get("job_titles") or []) if str(t).strip()]
    emp_types = [e.strip().lower() for e in (filters.get("employment_type") or []) if str(e).strip()]
    locations = [loc.strip() for loc in (filters.get("locations") or []) if str(loc).strip()]

    min_exp = filters.get("min_experience")
    max_exp = filters.get("max_experience")
    min_exp = float(min_exp) if min_exp is not None and str(min_exp).strip() != "" else None
    max_exp = float(max_exp) if max_exp is not None and str(max_exp).strip() != "" else None

    limit = int(filters.get("limit") or 200)
    matched = []

    for job in jobs:
        # 1. Companies filter (exact case-insensitive match)
        if companies:
            job_company = str(job.get("company") or "").strip().lower()
            if job_company not in companies:
                continue

        # 2. Employment type filter (substring or exact match, case-insensitive)
        if emp_types:
            job_emp = str(job.get("employment_type") or "").strip().lower()
            if not any(et in job_emp for et in emp_types):
                continue

        # 3. Locations filter (case-insensitive substring match, e.g. "Tel Aviv", "Hybrid", "Remote")
        if locations:
            job_loc = str(job.get("location") or "")
            if not _matches_any_substring(job_loc, locations):
                continue

        # 4. Job titles filter (matches if ANY title appears in title OR content_full)
        if titles:
            title_text = str(job.get("title") or "")
            content_text = str(job.get("content_full") or "")
            if not (_matches_any_substring(title_text, titles) or _matches_any_substring(content_text, titles)):
                continue

        # 5. Min / Max experience filter
        if min_exp is not None or max_exp is not None:
            req_years = _extract_required_years(job.get("min_experience_years"))
            if min_exp is not None and (req_years is None or req_years < min_exp):
                continue
            if max_exp is not None and req_years is not None and req_years > max_exp:
                continue

        matched.append(job)
        if len(matched) >= limit:
            break

    return matched

def lambda_handler(event, context):
    # Support both API Gateway / Function URL (event["body"]) and direct boto3/console invoke
    if isinstance(event.get("body"), str):
        filters = json.loads(event["body"] or "{}")
    elif isinstance(event.get("body"), dict):
        filters = event["body"]
    else:
        filters = event or {}

    try:
        all_jobs = _load_latest_jobs()
        results = filter_jobs(all_jobs, filters)

        response_payload = {
            "count": len(results),
            "jobs": results,
        }

        # Return HTTP format if invoked via API Gateway / Lambda Function URL
        if "requestContext" in event or "httpMethod" in event:
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(response_payload, ensure_ascii=False),
            }

        return response_payload

    except Exception as e:
        print(f"Error filtering jobs: {e}")
        if "requestContext" in event or "httpMethod" in event:
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": str(e)}),
            }
        raise