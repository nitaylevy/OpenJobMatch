# Open Job Match (OJM)

I built this open-source project to answer a simple question: **can a lightweight, open-weight LLM function as a reliable, transparent ATS?**

Open Job Match is an end-to-end job matching platform built around `google.gemma-3-4b-it`. Instead of relying on proprietary black-box scoring or expensive frontier models, I wanted to see how far careful prompt engineering, structured extraction, and lean architecture could go in matching resumes to job postings.

This repository documents the entire build, including:

- **Evaluation Notebooks:** Evaluation runs with inspection over final results using gathered job posts and the Kaggle open-source resume dataset "Resume Entities for NER".
- **Prompt Engineering:** The production system prompts and output schemas that drive the parsing and scoring pipeline.
- **AWS Backend:** Amazon SQS and AWS Lambda functions handling request orchestration and model inference via Amazon Bedrock.
- **Backend Automation:** Included optional n8n workflows for powering data ingestion, parsing, and pipeline orchestration.
- **Frontend App:** A React-based interface demo for uploading resumes, building candidate profiles, and inspecting match breakdowns.

## Table of Contents

- [Official Page](#official-page)
- [Features](#features)
- [Running Locally](#running-locally)
- [Screenshots](#screenshots)

## Official Page

[https://nitaylevy.github.io/OpenJobMatch/](https://nitaylevy.github.io/OpenJobMatch/) - Check out demo!

## Features

### 1. Search By Resume
- **Resume Parsing:** Upload a candidate resume (PDF or Image) to extract and pre-fill search criteria automatically.
- **Custom Search Criteria:** Define target job titles, years of experience required, seniority levels, and employment types.
- **Resume Profile Management:** Add and edit job experience, technical skills, soft skills, and educational background.
- **Saved Searches:** Save multiple profile presets (e.g., "Frontend Developer Profile", "Data Scientist Profile") and quickly switch between them using the sidebar drawer.

### 2. Job Explorer
- **Smart Matching:** Select a saved resume profile to see how well it aligns with available job postings. 
- **Scoring System:** Displays a "Core Match" percentage and a "Bonus Fit" percentage for each job based on your profile's skills and experience.
- **Advanced Filtering:** Filter the extracted job dataset by:
  * Job Titles
  * Employment Type (Full-time, Part-time)
  * Experience Required (Slider)
  * Locations
  * Companies
- **Actionable Insights:** Directly apply to jobs, generate referral messages, or find leads straight from the job cards.

## Running Locally

### Prerequisites
- Node.js (v18 or higher recommended) and npm
- Python 3.12+ and `pip`
- Rename .env.production to .env and update keys
---
## 1. Python Virtual Environment Setup

```bash
# Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Frontend Setup

The frontend is built with React. To run the local development server:

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Once started, open your browser at the local address shown in the terminal (typically `http://localhost:5173`).

### 3. Evaluations Setup

#### Step 1: Install Dependencies

```bash
cd evaluations

# Install required Python packages
pip install -r requirements.txt
```

#### Step 2: Download the Kaggle Benchmark Dataset

For resume scan evaluations, download the open-source Kaggle dataset [Resume Entities for NER](https://www.kaggle.com/datasets/dataturks/resume-entities-for-ner).

#### Step 3: Ingest Custom Resumes

To parse and add your own resumes into the evaluation dataset:

1. Place your source resume documents (PDFs or images) in the data folder.
2. Run `textract_test.py` located in the `cv_scanner/` directory to extract the text using PyMuPDF and Amazon Textract. When done, save it in the data folder.

## Screenshots

### Search By Resume Profile
<img width="800" alt="Search By Resume Profile" src="https://github.com/user-attachments/assets/2311acd2-e54d-4907-b0d0-b5ffdfeac9be" />
<br/>
<br/>
<img width="800" alt="Resume Profile Details" src="https://github.com/user-attachments/assets/2767863f-5068-4fb8-a54d-3c576857812e" />

### Extracted Jobs & Match Scoring
<img width="800" alt="Extracted Jobs and Match Scoring" src="https://github.com/user-attachments/assets/09bbf6e5-a655-497c-944f-8cb9993a9f80" />
