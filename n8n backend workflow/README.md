# Automated Job Aggregator & CV Matcher Workflow

An automated n8n workflow that parses CVs/resumes, aggregates job postings from applicant tracking systems (Greenhouse & Comeet), computes job-match scores, and delivers scheduled email digests.

---

## Architecture Overview

<img width="3746" height="1706" alt="workflow" src="https://github.com/user-attachments/assets/b981e054-8f9c-4c6b-95d5-925e48a1ba4f" />


The workflow consists of four modular sub-flows running within n8n:

```text
[Webhook: POST /github-image-trigger]
        │
        ▼
  [AWS Lambda] ──► [Return CV JSON Response]

[Schedule Trigger: Hourly]
        │
        ├──► [Extract Greenhouse Jobs] ──┐
        └──► [Extract Comeet Jobs]     ──┴──► [Merge] ──► [MongoDB: Upsert Jobs]

[Webhook: POST /github-jobs-trigger]
        │
        ▼
  [MongoDB: Filter Jobs] ──► [Python: Score & Sort] ──► [MongoDB: Update Scores] ──► [Return Top-K Jobs]

[Schedule Trigger: Hourly Notifications]
        │
        ▼
  [MongoDB: Fetch New Jobs] ──► [Python: Format HTML] ──► [Gmail: Send Notification]
```

---

## Sub-Flows & Endpoints

### 1. CV Parsing Pipeline
* **Trigger:** Webhook (`POST /github-image-trigger`)
* **Process:** 
  1. Accepts base64-encoded resume images (`imageBase64`).
  2. Forwards payload to AWS Lambda (`resume-parser-api`).
  3. Returns parsed, structured JSON to the caller.

### 2. Job Ingestion & Normalization
* **Trigger:** Scheduled interval (Hourly)
* **Process:**
  1. Concurrently scrapes/extracts new job listings from Greenhouse and Comeet via Python code nodes.
  2. Merges listings into a unified format.
  3. Updates/persists new records into the MongoDB `Job Posts` collection.

### 3. Job Recommendation & Scoring Engine
* **Trigger:** Webhook (`POST /github-jobs-trigger`)
* **Process:**
  1. Fetches candidate job posts from MongoDB based on query criteria.
  2. Runs custom Python logic to score and rank top matching opportunities (`Scores & Sort`).
  3. Persists individual scoring metadata into MongoDB.
  4. Returns the sorted `Top-K` matching jobs to the client.

### 4. Hourly Digest Notifications
* **Trigger:** Scheduled interval (Hourly)
* **Process:**
  1. Queries MongoDB for jobs published within the previous hour.
  2. Formats matching jobs into a responsive HTML table.
  3. Dispatches an email notification via Gmail.
