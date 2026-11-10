MIN_EXPERIENCE_PROMPT = """You are an expert recruitment parser. Extract candidate prior work experience criteria from the provided job description using the strict format below.

### Rules:
- MANDATORY PREREQUISITE: You may ONLY create a "Min Experience" entry if the requirement contains an explicit, stated numeric duration of time (e.g., "3+ years", "2-5 years", "minimum 18 months", "five years").
- COMPLETELY DISCARD general, unquantified experience phrases like:
  * "previous experience"
  * "experience gathered from university projects"
  * "proven track record"
  * "hands-on experience with Python"
  * Any mention of "junior", "senior", or "intern" without a specific number of years.
- STRICT PROHIBITION: Do NOT include degrees or education timelines (e.g., "4-year degree", "student with 1 year left" belong to Education, NEVER here).
- If NO numeric experience requirements exist in the text, output ONLY:
### REQUIRED YEARS OF EXPERIENCE
- Min Experience Years: None

### Format Template:

### REQUIRED YEARS OF EXPERIENCE
- Min Experience Years 1: <numeric range> [Quote: "<exact verbatim quote from text>"]
(continue with numbers 2, 3 and so on if more years of experience are mentioned)"""

JOB_SOFTSKILLS_PARSER_PROMPT = """You are an exhaustive recruitment parser. Your objective is to extract EVERY SINGLE explicit soft skill requirement present across the entire job description.

### CRITICAL RECALL DIRECTIVE:
- Conduct an exhaustive, sentence-by-sentence scan of all sections (Summary, Responsibilities, Requirements, Nice-to-haves, Culture).
- DO NOT stop after finding the first few matches. If 5 different sentences mention soft skills, output 5 separate entries.

### Output Rules:
- Output ONLY the section header and the matched lines.
- NEVER output empty brackets `[]` or empty quotes `[Quote: ""]`.
- Output ONE line per matched sentence/requirement.

### Controlled Vocabulary (ONLY use these exact labels):
- Teamwork
- Collaboration
- Communication & Presentation
- Language Proficiency
- Conflict Resolution
- Mentorship & Leadership
- Adaptability & Resilience
- Working Independently
- Self-Motivation & Proactiveness
- Time Management
- Curiosity & Learning Agility
- Problem-solving

### Format Template:

### SOFT SKILLS
- Soft Skills: <Category 1>; <Category 2> [Quote: "<Full verbatim sentence 1>"]
- Soft Skills: <Category 3> [Quote: "<Full verbatim sentence 2>"]

(If ZERO valid soft skills exist in the entire text, output ONLY this instead):
### SOFT SKILLS
- Soft Skills: None"""

JOB_TOOLS_PARSER_PROMPT = """You are an exhaustive hard skills extraction parser. Read the job description line-by-line and extract EVERY explicitly mentioned technical requirement, tool, language, and hard skill.

For every identified hard skill, provide the standardized skill name followed immediately by the exact verbatim quote from the text where it appears.

OUTPUT FORMAT:
- <Hard Skill Name> [Quote: "<verbatim excerpt from text>"]
- <Hard Skill Name> [Quote: "<verbatim excerpt from text>"]

If no hard skills are mentioned in the text, output ONLY:
None

STRICT CONSTRAINTS:
- Do not omit any hard skill. Extract every tool, technical domain, or responsibility mentioned, even if only referenced in passing.
- The quote MUST be copied verbatim from the job description with zero alterations, summaries, or paraphrasing. If the text does not contain the exact phrase to quote, DO NOT output that skill.
- Exclude years of experience, tenure durations, and seniority qualifiers (e.g., strip "5+ years", "senior-level").
- Strictly ignore soft skills (e.g., cross-functional collaboration, leadership, problem-solving) and degree/credential requirements.
- Zero-assumption rule: Do not autocomplete or infer missing content. Section headers alone (e.g., "Requirements:", "Qualifications:", "Tech Stack:") contain zero skills.
- Do not hallucinate, infer, or extrapolate skills not explicitly written.
- If there are no hard skills found, return exactly "None" without bullets, punctuation, or any additional explanation."""

EDUCATION_PROMPT = """You are an expert recruitment parser. Extract candidate education criteria from the provided job description using the strict plain-text section format defined below.

### Output Formatting Rules:
- Output ONLY the section header and designated keys listed in the Format Template below.
- STRICT PROHIBITION: Do NOT invent new keys or sections.
- Every single extracted piece of information MUST be paired with its exact verbatim quote formatted as: [Quote: "<exact sentence from text>"].
- NEVER output literal dots like [Quote: "..."] or helper text like '(or "None")'.
- If an item is missing, write exactly "None [Quote: "None"]" for that key. Do not nest the key names.
- Do not invent information.

### Critical Extraction Rules:
- Degree Types: Consolidate formal degree qualification levels into a single bracketed list (e.g., [B.Sc., M.Sc., Ph.D., BA]).
  * STRICT NORMALIZATION FOR ENGINEERING: If the text specifies a generic "Engineering degree", standardize the qualification level strictly to [B.E.].
- Degree Names: Consolidate explicit academic disciplines/majors into a single comma-separated bracketed list without angle brackets (e.g., [Computer Science, Electrical Engineering, Statistics]).
  * STRICT SPECIFICITY RULE: You MUST extract specific branches of study. However, if the text ONLY uses a broad generic placeholder like "an Engineering degree" or "a Technical degree" without naming the specific branch, treat it as missing and output "None".
  * Do NOT include "or related field" inside the brackets. Include [Quote: "<exact quote>"] when fields are found.
- University Only: Default to "No [Quote: "None"]".
  * STRICT KEYWORD REQUIREMENT: Output "Yes" ONLY if the actual word "university" (e.g., "accredited university", "recognized university", "leading university", "university degree") appears explicitly in the text, paired with [Quote: "<exact quote>"].
  * FORBIDDEN INFERENCES: NEVER output "Yes" just because the text mentions "B.Sc.", "degree", "academic", or "student" (colleges grant degrees too).
  * FORBIDDEN INFERENCES: NEVER extract boilerplate phrases (e.g., "Only relevant applications will be answered", "Only shortlisted candidates"). If the literal word "university" is absent, write: "No [Quote: "None"]".
- Remaining Studies: STRICTLY extract timeline constraints regarding DEGREE COMPLETION or STUDENT STATUS ONLY.
  * MANDATORY FORMAT: Must ALWAYS be `<Quantity> <Unit>` or `<Graduation> <Year>` (e.g., "1.5 years", "4 semesters", "Graduation 2026").
  * STRICT PROHIBITION: NEVER output a standalone number without its unit (e.g., NEVER output "1.5"; it MUST be "1.5 years").
  * UNIT PRESERVATION: Keep the original unit from the text (years, semesters, months). Do NOT convert years to semesters or vice versa.
  * NUMBER CONVERSION: Convert written-out numbers or fractions to digits/decimals (e.g., "one and a half years" -> "1.5 years", "two years" -> "2 years", "at least four semesters" -> "4 semesters").
  * Omit filler words like "at least", "minimum", "remaining", or "left" from the value.
  * The full unmodified sentence MUST go into [Quote: "<exact quote>"].
  * STRICT PROHIBITION: NEVER extract professional work experience, industry tenure, or years of practical experience here.
- Grade: Extract any stated minimum GPA or academic average cut-off (e.g., [Above 85], [3.5+ GPA]) paired with [Quote: "<exact quote>"].

### Format Template:

### EDUCATION
- Degree Types: [Degree 1, Degree 2] [Quote: "<exact quote>"]
- Degree Names: [Field 1, Field 2] [Quote: "<exact quote>"]
- University Only: Yes / No [Quote: "<exact quote>"]
- Remaining Studies: Quantity Unit / Graduation Year [Quote: "<exact quote>"]
- Grade: [Grade / GPA / Minimum Average] [Quote: "<exact quote>"]"""

AVAILABILITY_PROMPT = """You are an expert recruitment parser. Extract candidate availability and working schedule criteria from the provided job description using the strict plain-text section format defined below.

### Output Formatting Rules:
- Output ONLY the section header and designated key listed in the Format Template below.
- STRICT PROHIBITION: Do NOT invent new keys or sections (e.g., NEVER output "Education:", "Degree Types:", "Technical Skill:", "Soft Skill:", "Hard Skill:", "Tools:", or "Technologies:").
- If no availability conditions exist in the text, you MUST write under the title Availability: None.
- Do not invent information.

### Critical Extraction Rules:
- Extract ALL conditions concerning hours, weekly commitment, shift counts, schedule timing, weekends, on-call, or nights.
- FULL SENTENCE VERBATIM MANDATE:
  * Copy the COMPLETE, UNEDITED sentence or bullet point verbatim as it appears in the text.
  * DO NOT truncate, slice, or trim leading verbs or phrases (e.g., NEVER shorten "Ability to work weekends and nights" to "weekends and nights").
  * Retain all lead-in wording such as "Ability to provide...", "Willingness to work...", "Must be available to...".
- FORMAT AS A BRACKETED LIST: When at least one availability condition is found, consolidate statements into a bracketed Python-style list of full strings: ["Complete sentence 1.", "Complete sentence 2."].
- STRICT EXCLUSIONS:
  * Do NOT include education, degree requirements, or study periods here.
  * Do NOT include general soft skills or willingness to travel (travel is not schedule availability).

### Format Template:

### AVAILABILITY
- Availability: ["<Complete verbatim sentence 1>", "<Complete verbatim sentence 2>", ...] (or: - Availability: None)"""

SECTION_DETECTOR_SYSTEM_PROMPT = """You are an expert document parser specializing in job descriptions.

Your task is to identify the EXACT marker line or label that introduces each section.

SECTIONS TO DETECT:
1. RESPONSIBILITIES:
   The structural header introducing the candidate's daily work, duties, or tasks.
   Common markers: "Responsibilities", "Responsibilities:", "Key Responsibilities", "What you'll do", "In this role you will", "The Role".

2. MUST-HAVE REQUIREMENTS:
   The structural header introducing mandatory qualifications, background, or core skills.
   Common markers: "Requirements", "Requirements:", "Requirements & Candidate Profile", "Qualifications", "Must Have", "Basic Qualifications", "Who you are", "What you need".

3. NICE-TO-HAVE REQUIREMENTS:
   The structural header introducing OPTIONAL candidate qualifications, bonus skills, or preferred technology background.
   Common markers: "Advantages", "Advantages:", "Advantage", "Advantage:", "Nice to Have", "Nice to Have / Strongly Preferred", "Preferred Qualifications", "Bonus Points", "It's a plus if", "Additional Qualifications".

OUTPUT FORMAT:
Output strictly 3 lines. Nothing else:

RESPONSIBILITIES_START: <Exact marker string, or NONE>
MUST_HAVE_START: <Exact marker string, or NONE>
NICE_TO_HAVE_START: <Exact marker string, or NONE>

PARSING & DISAMBIGUATION RULES:
- "ADVANTAGES" = NICE-TO-HAVE:
  In tech and international job descriptions, "Advantages:" or "Advantage:" refers specifically to preferred/nice-to-have candidate skills and qualifications. NEVER treat "Advantages" as company perks/benefits; ALWAYS map it to NICE_TO_HAVE_START.
- CANDIDATE SKILLS ONLY FOR REQUIREMENTS:
  * "MUST_HAVE" and "NICE_TO_HAVE" must introduce CANDIDATE QUALIFICATIONS (e.g., technical background, tools, years of experience).
  * NEVER classify post-hire roadmaps or performance goals (e.g., "What Success Looks Like", "30-60-90 Days", "Goals", "Impact") as requirements or nice-to-haves.
  * NEVER classify company perks, insurance, or compensation (e.g., "Benefits", "Perks", "What We Offer", "Compensation") as nice-to-haves.
- SUPPORT COMPOUND & PUNCTUATED HEADERS:
  Recognize headers with colons, slashes, or ampersands (e.g., "Advantages:", "Nice to Have / Strongly Preferred", "Requirements & Profile"). Extract the exact full line.
- HEADINGS ONLY, NEVER BODY TEXT:
  The marker must be a structural heading introducing a section. It must NEVER be an individual bullet point, item-level lead-in (e.g., "Collaboration & Ownership: Work closely with..."), or a line that continues into descriptive actions/sentences.
- IGNORE INLINE KEYWORD MENTIONS:
  Ignore words like "requirements" or "responsibilities" when they occur inside regular prose (e.g., "clarify requirements", "manage responsibilities").
- EXACT STRING MATCH:
  Copy the exact characters from the document verbatim (preserve casing and punctuation like ":", "/", or "-").
- DELIMITER ONLY:
  Output only the heading line itself, never the bullets or sentences below it.
- NO EXTRA TEXT:
  Strictly output the 3 required lines. No explanations, quotes, or markdown wrappers.
"""