# Job & Resume Matcher – Frontend Application

A React-based web application designed to parse resumes, configure candidate profiles, filter extracted job listings, and compute candidate-to-job match scores using client-side matching algorithms.

Built with **JavaScript**, **React**, **Material UI (MUI)**, and **Lucide React**.

---

## 🚀 Key Features

* **Resume Matcher (`ResumePage`):**
  * Upload resume files (PDF/image) for parsing.
  * Define target job search criteria (desired titles, experience limits, student positions).
  * Customize candidate profiles (skills tags, past work experience, education history).
  * Save, manage, and switch between multiple candidate profiles/searches via a slide-out drawer.

* **Job Explorer & Scoring (`JobsPage`):**
  * Browse extracted job posts (`jobs_extracted.json`).
  * Filter jobs by title, employment type, location, company, and required experience range.
  * Score and rank jobs against the active candidate profile using a dedicated scoring engine.
  * Add in-demand job skills directly back into the candidate's profile.
  * Generate referral outreach messages via helper utilities.

---

## 📁 Project Structure

```text
src/
├── assets/
│   └── jobs_extracted.json       # Demo / extracted job postings dataset
├── components/
│   ├── JobPage/
│   │   └── JobCard.jsx           # Card component displaying job details, score breakdown & actions
│   └── ResumePage/
│       ├── Header.jsx            # Top bar with actions (save search, reset, open drawer)
│       ├── ResumeUpload.jsx      # File upload dropzone/trigger for candidate CVs
│       ├── SearchCriteria.jsx    # Target titles, experience slider, and role filters
│       ├── ResumeProfile.jsx     # Editable skills list, past experience, and education
│       ├── SavedSearchesDrawer.jsx # Slide-out sidebar to switch saved search profiles
│       └── SaveSearchDialog.jsx  # Modal dialog to name and persist search presets
├── hooks/
│   ├── useJobFilters.js          # Filtering, range slicing, and score-based sorting logic
│   └── useResume.js              # State management for resume upload, criteria, and profile data
├── pages/
│   ├── JobsPage.jsx              # Extracted jobs listing and filter controls view
│   └── ResumePage.jsx            # Resume ingestion and profile configuration view
├── utils/
│   ├── scoringEngine.js          # Computes match scores between candidate profiles and job requirements
│   └── referralMessageLogic.js   # Generates personalized referral/outreach templates
├── App.jsx                       # Top-level tab navigation ("Resume Matcher" & "Extracted Jobs Data")
└── main.jsx                      # Application entry point
```
