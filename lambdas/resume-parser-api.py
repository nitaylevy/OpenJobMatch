import json
import boto3
import re
import base64
import os
from datetime import datetime
from dateutil import parser
from botocore.config import Config

# --- Core Project Configuration ---
REGION = os.environ.get("AWS_REGION", "eu-west-1")
MODEL_NAME = os.environ.get("MODEL_NAME", "google.gemma-3-4b-it")
MAX_GENERATION_TOKENS = 512

boto_config = Config(retries={'max_attempts': 5, 'mode': 'standard'})
textract_client = boto3.client('textract', region_name=REGION, config=boto_config)
bedrock_runtime = boto3.client('bedrock-runtime', region_name=REGION, config=boto_config)

# --- Prompts ---
SKILLS_EXTRACTION_SYSTEM_PROMPT = """You are an expert technical data extraction engine specialized in deep parsing of resumes and CVs.
Your task is to exhaustively extract every skill, programming language, framework, database, cloud technology, tool, methodology, and domain competency from the entire resume.
EXTRACTION SCOPE:
1. Scan EVERY section thoroughly:
   - "Skills" section.
   - "Work Experience" or "Employment History"
   - "Projects", "Education", and "Certifications".
2. Include standalone tech words and compound industry terms.
3. Include special-character skills verbatim (e.g., "C++", "C#", ".NET", "Node.js").
RULES:
- Do NOT infer unmentioned tools.
- Extract the exact technical entity, not entire descriptive sentences.
- Extract both the specific services AND the parent cloud platform/infrastructure if named.
- Do NOT output category headers, introductory text, or concluding remarks.
- Output ONLY a flat, deduplicated list where each skill begins with a single dash ("- ").
"""

EXPERIENCE_AND_JOB_TITLE_EXTRACTION_SYSTEM_PROMPT = """You are an expert resume parsing engine.
Your task is to extract the applicant's primary job title and work experience roles along with their exact date ranges.
Output format must strictly follow this plain-text structure:
JOB TITLE:
<Job title found under the applicant name/headline, or "None">
EXPERIENCE:
- <Role Name>: <date text as written>
- <Role Name>: <date text as written>
Rules:
1. Under "JOB TITLE:", state the primary job title typically appearing right under their name or in the professional summary headline. If none exists, write "None".
2. Under "EXPERIENCE:", list each qualifying role followed by its date string.
3. Every bullet must follow the format: "- Role Name: date text as written".
4. DATE PURITY: Extract ONLY the time interval/date range.
   - Strip out company names, employer names, project names, and locations.
   - Do not calculate years or alter the wording of the dates themselves.
5. If no specific job role/title is specified for an experience block, omit it completely.
6. If a role has no dates provided, use "No dates provided".
7. If no experience entries are found, output:
EXPERIENCE:
- None
8. Do not add introductory or concluding text. Output only the sections specified above.
"""

EDUCATION_EXTRACTION_SYSTEM_PROMPT = """You are an expert resume parsing engine.
Your task is to extract all education records earned or pursued by the candidate from the provided resume text into a structured, plain-text format.

Critical Scope & Disambiguation Rules:
1. Candidate Education Only:
   - Extract ONLY degrees, diplomas, or credentials earned, attended, or pursued by the candidate.
   - STRICTLY IGNORE any degrees, courses, colleges, or universities mentioned in the context of teaching, lecturing, training, assisting, or advising.
   - Do NOT extract credentials, institutions, or subjects that the candidate taught or supervised.
2. Section Boundary Enforcement:
   - Extract strictly from sections explicitly dedicated to education.
   - NEVER extract entries from work experience, employment history, or project sections.

Output Format:
For each education entry found, output exactly one bullet point following this schema:
- Institution Type: <University | College | Other> | Degree Type: <Degree Type> | Degree Name: <Degree Name> | GPA: <GPA or None> | Date: <Date text as written or None>

If no education records are found for the candidate, output:
- None

Extraction & Classification Rules:
1. Institution Type: Must be strictly one of: "University", "College", or "Other".
2. Degree Type: Map standard abbreviations and variants (e.g., "B.Sc.", "B.A.", "M.Sc.", "Ph.D.", "MBA", "Other"). Always decouple the degree acronym/level from the field of study.
3. Degree Name: Extract strictly the major, field of study, or specialization. STRIP OUT all degree acronyms, prefixes, and connector words.
4. GPA: Extract the GPA, percentage, or score verbatim if stated. If not mentioned, output "None".
5. Date (CRITICAL):
   - Extract the FULL attendance date range (start date through end date), not just the graduation/end date.
   - Note that date ranges frequently appear WITHOUT hyphens or words like 'to' (e.g., "2021 08/2025", "08/2025 02/2027", "2018 2022"). In these cases, you MUST capture BOTH tokens together (e.g., "2021 08/2025", NOT just "08/2025").
   - If only a single completion/graduation date is present, output that single date.
   - If no date is mentioned, output "None".

Formatting Rules:
- Return ONLY the bullet points separated by pipe symbols (`|`).
- Do not output introductory remarks, notes, markdown bolding, or markdown code blocks.
"""

# --- Helper Functions ---
def sanitize_resume_text(text: str) -> str:
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '', text)
    text = re.sub(r'(https?:\/\/[^\s]+|www\.[^\s]+|(?:[\w-]+\.)+(?:com|org|net|io|edu|gov|me|ai|dev|co|il)(?:\/[^\s]*)?)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'(\+?\d{1,4}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b', '', text)
    text = re.sub(r'\b[\w\.-]+@(?:\s|$)', '', text)  
    text = re.sub(r'[ \t]+', ' ', text)              
    text = re.sub(r'\n\s*\n', '\n\n', text)          
    return text.strip()

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

# --- LLM Extraction Functions ---
def extract_skills_from_text(text: str) -> list[str]:
    user_prompt = f"Based on the following resume text, please return a list of names of skills and tools I know:\n\n<resume>\n{text}\n</resume>"
    bedrock_response = bedrock_runtime.converse(
        modelId=MODEL_NAME,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": SKILLS_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": MAX_GENERATION_TOKENS}
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

def extract_career_info(text: str) -> dict:
    user_prompt = f"Extract the applicant's headline job title and work experience from the following resume:\n\n<resume>\n{text}\n</resume>"
    response = bedrock_runtime.converse(
        modelId=MODEL_NAME,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": EXPERIENCE_AND_JOB_TITLE_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": MAX_GENERATION_TOKENS, "temperature": 0.0},
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

def extract_education(text: str) -> list[dict]:
    user_prompt = f"Extract all education records from the following resume:\n\n<resume>\n{text}\n</resume>"
    response = bedrock_runtime.converse(
        modelId=MODEL_NAME,
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        system=[{"text": EDUCATION_EXTRACTION_SYSTEM_PROMPT}],
        inferenceConfig={"maxTokens": MAX_GENERATION_TOKENS, "temperature": 0.0},
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

# --- Main Lambda Handler ---
def lambda_handler(event, context):
    try:
        # 1. Parse body whether invocation comes from API Gateway or direct Lambda invoke
        body = event.get("body", event)
        if isinstance(body, str):
            body = json.loads(body)

        images_base64 = body.get("images_base64")
        if not images_base64 or not isinstance(images_base64, list):
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "error": "Missing or invalid images_base64 array in event"
                }),
            }

        extracted_text = ""

        # 2. Process each base64 page with Textract
        for b64_img in images_base64:
            image_bytes = base64.b64decode(b64_img)
            textract_response = textract_client.detect_document_text(
                Document={"Bytes": image_bytes}
            )
            for block in textract_response.get("Blocks", []):
                if block["BlockType"] == "LINE":
                    extracted_text += block["Text"] + "\n"

        # 3. Sanitize extracted text
        clean_text = sanitize_resume_text(extracted_text)

        if not clean_text:
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({
                    "job_title": None,
                    "experience": [],
                    "education": [],
                    "skills": [],
                    "message": "No text extracted from images.",
                }),
            }

        # 4. Extract Skills (uses full clean text)
        try:
            skills = extract_skills_from_text(clean_text)
        except Exception as e:
            print(f"Error in extract_skills_from_text: {str(e)}")
            skills = []

        # 5. Extract Career Info (uses text with Education stripped out)
        try:
            edu_removal_res = remove_education_section(clean_text)
            career_input_text = edu_removal_res.get("cleaned_text") or clean_text
            career_info = extract_career_info(career_input_text)
        except Exception as e:
            print(f"Error in extract_career_info: {str(e)}")
            career_info = {"job_title": None, "experience": []}

        # 6. Extract Education (uses full clean text)
        try:
            education_info = extract_education(clean_text)
        except Exception as e:
            print(f"Error in extract_education: {str(e)}")
            education_info = []

        # 7. Format successful response
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "job_title": career_info.get("job_title"),
                "experience": career_info.get("experience", []),
                "education": education_info,
                "skills": skills,
                "message": "Successfully extracted resume data.",
            }),
        }

    except Exception as e:
        print(f"Critical error processing resume: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(e)}),
        }