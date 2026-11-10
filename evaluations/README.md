# Evaluations

This directory inspects and validates the **Gemma 3 4B** model hosted on **AWS Bedrock** across resume parsing and job listing extraction tasks.

---

## 📁 Subfolder Overview

### 1. `cv_scaner/`
* **Key Components:**
  * `bedrock.py`: Bedrock client configuration and inference logic for Gemma 3 4B.
  * `prompts.py`: Prompt engineering templates for CV entity extraction and JSON generation.
  * `textract_test.py`: Testing resume text extraction via AWS Textract.
  * `inspect_resume_scanner.ipynb`: Interactive notebook for inspecting extraction.

### 2. `data/`
* **Key Contents:**
  * `Entity Recognition in Resumes.json`: Labeled benchmark dataset for CV entity validation (download from Kaggle).
  * `my_resumes.json`: Test set of personal resume profiles (add with `textract_test.py`).
  * `demo_jobs.txt` & `job_posts.txt`: Raw job descriptions and posting samples for extraction tests.

### 3. `jobs_finder/`
* **Key Components:**
  * `aggregators.ipynb`: Notebook to test scrapers/aggregators.

### 4. `jobs_scaner/`
* **Key Components:**
  * `bedrock.py`: Model invocation scripts tailored for job post ingestion.
  * `prompts.py`: Prompt templates designed to extract specific job criteria and qualifications.
  * `inspect_job_scanner.ipynb`: Notebook to inspect and error-analyze job extraction outputs.

---

## ⚙️ Root Scripts & Environment

* `.env` / `.env.production`: AWS credentials, region definitions, and Bedrock model IDs.
* `test_lambdas.ipynb`: Evaluate Amazon SQS and deployed AWS Lambda functions.
