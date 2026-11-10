import { useState, useMemo, useEffect } from 'react';
import { calculateJobMatch } from '../utils/scoringEngine';

export default function useJobFilters(jobsData, activeProfile) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [experienceRange, setExperienceRange] = useState([0, 10]);
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [jobTitleFilter, setJobTitleFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  useEffect(() => {
    if (!activeProfile) {
      // Reset all filters when returning to "No selection"
      setExperienceRange([0, 10]);
      setEmploymentTypeFilter('all');
      setJobTitleFilter('');
      setLocationFilter('');
      setCompanyFilter('');
      return;
    }

    // Reset non-profile filters (location & company) when switching profiles
    setLocationFilter('');
    setCompanyFilter('');

    // 1. Target Job Titles
    const rawTitles = 
      activeProfile.targetJobTitles ||
      activeProfile.jobTitles ||
      activeProfile.targetRoles ||
      activeProfile.job_title ||
      '';

    if (Array.isArray(rawTitles) && rawTitles.length > 0) {
      setJobTitleFilter(rawTitles.join(', '));
    } else if (typeof rawTitles === 'string' && rawTitles.trim()) {
      setJobTitleFilter(rawTitles.trim());
    } else {
      setJobTitleFilter('');
    }

    // 2. Years of Experience Required Range
    if (Array.isArray(activeProfile.experienceRange) && activeProfile.experienceRange.length === 2) {
      const min = Math.max(0, Math.min(10, Number(activeProfile.experienceRange[0]) || 0));
      const max = Math.max(min, Math.min(10, Number(activeProfile.experienceRange[1]) || 10));
      setExperienceRange([min, max]);
    } else if (Array.isArray(activeProfile.jobExperiences)) {
      const totalCandidateYears = activeProfile.jobExperiences.reduce((sum, exp) => {
        const y = parseFloat(String(exp.years).replace('+', '')) || 0;
        return sum + y;
      }, 0);
      setExperienceRange([0, Math.min(10, Math.ceil(totalCandidateYears))]);
    } else {
      setExperienceRange([0, 10]);
    }

    // 3. Employment Type
    const rawEmp = activeProfile.employmentType || activeProfile.employment_type || [];
    const empList = (Array.isArray(rawEmp) ? rawEmp : [rawEmp]).map(e => String(e).toLowerCase());

    const wantsFull = empList.some(e => e.includes('full'));
    const wantsPart = empList.some(e => e.includes('part'));

    if (wantsFull && !wantsPart) {
      setEmploymentTypeFilter('full-time');
    } else if (wantsPart && !wantsFull) {
      setEmploymentTypeFilter('part-time');
    } else {
      setEmploymentTypeFilter('all');
    }
  }, [activeProfile]);

  const resetFilters = () => {
    setExperienceRange([0, 10]);
    setEmploymentTypeFilter('all');
    setJobTitleFilter('');
    setLocationFilter('');
    setCompanyFilter('');
  };

  const hasActiveFilters = useMemo(() => {
    return (
      experienceRange[0] > 0 ||
      experienceRange[1] < 10 ||
      employmentTypeFilter !== 'all' ||
      jobTitleFilter.trim() !== '' ||
      locationFilter.trim() !== '' ||
      companyFilter.trim() !== ''
    );
  }, [experienceRange, employmentTypeFilter, jobTitleFilter, locationFilter, companyFilter]);

  const filteredAndSortedJobs = useMemo(() => {
    const [minExp, maxExp] = experienceRange;

    const filtered = jobsData.filter((job) => {
      const rawJobTitle = String(
        job.job_title || job["Job Title"] || job.title || ''
      );
      const rawJobDescription = String(
        job.text || job.description || job["Full Description"] || ''
      );

      // --- 1. JOB TITLE / TARGET TITLE FILTER ---
      if (jobTitleFilter && jobTitleFilter.trim()) {
        const targetPhrases = jobTitleFilter
          .split(/[,|/]/)
          .map(t => t.trim().toLowerCase())
          .filter(Boolean);

        const normalizedTitle = rawJobTitle
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const normalizedDescription = rawJobDescription
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const matchesTarget = targetPhrases.some(phrase => {
          const cleanPhrase = phrase
            .replace(/&/g, ' and ')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (!cleanPhrase) return false;

          const words = cleanPhrase.split(/\s+/).filter(Boolean);

          // A) Matches "X ... Y" in title (e.g. "Data Platform Engineer" for "Data Engineer")
          const titlePattern = words.map(w => `\\b${w}\\b`).join('.*?');
          const titleRegex = new RegExp(titlePattern, 'i');
          const matchesTitle = titleRegex.test(normalizedTitle);

          // B) Strictly consecutive phrase in text description (e.g. exact "Data Engineer")
          const descriptionPattern = `\\b${words.join('\\s+')}\\b`;
          const descriptionRegex = new RegExp(descriptionPattern, 'i');
          const matchesDescription = descriptionRegex.test(normalizedDescription);

          return matchesTitle || matchesDescription;
        });

        if (!matchesTarget) {
          return false;
        }
      }

      // --- 2. EXPERIENCE REQUIRED FILTER ---
      const minExpKey = Object.keys(job).find(k => /^Min Experience Years/i.test(k));
      let jobReqYears = 0;
      if (minExpKey && job[minExpKey]) {
        const raw = Array.isArray(job[minExpKey]) ? job[minExpKey].join(' ') : String(job[minExpKey]);
        const match = raw.match(/(\d+(\.\d+)?)/);
        if (match) jobReqYears = parseFloat(match[1]);
      }

      if (minExp > 0 && jobReqYears < minExp) return false;
      if (maxExp < 10 && jobReqYears > maxExp) return false;

      // --- 3. EMPLOYMENT TYPE FILTER ---
      if (employmentTypeFilter !== 'all') {
        const emp = String(job.employment_type || job.Availability || '').toLowerCase();
        if (employmentTypeFilter === 'full-time' && !emp.includes('full')) return false;
        if (employmentTypeFilter === 'part-time' && !emp.includes('part')) return false;
      }

      // --- 4. LOCATIONS FILTER ---
      if (locationFilter.trim()) {
        const locationQueries = locationFilter
          .split(/[,|/]/)
          .map(l => l.trim().toLowerCase())
          .filter(Boolean);

        const jobLocation = String(job.location || '').toLowerCase();
        if (!locationQueries.some(q => jobLocation.includes(q))) return false;
      }

      // --- 5. COMPANY FILTER ---
      if (companyFilter.trim()) {
        const companyQueries = companyFilter
          .split(/[,|/]/)
          .map(c => c.trim().toLowerCase())
          .filter(Boolean);

        const jobCompany = String(job.company_name || '').toLowerCase();
        if (!companyQueries.some(q => jobCompany.includes(q))) return false;
      }

      return true;
    });

    const calculated = filtered.map((job) => ({
      job,
      scores: activeProfile ? calculateJobMatch(job, activeProfile) : null,
    }));

    if (!activeProfile) return calculated;

    return calculated.sort((a, b) => {
      const coreA = a.scores?.mandatory ?? 0;
      const coreB = b.scores?.mandatory ?? 0;
      if (coreB !== coreA) return coreB - coreA;

      const bonusA = a.scores?.advantages ?? -1;
      const bonusB = b.scores?.advantages ?? -1;
      return bonusB - bonusA;
    });
  }, [activeProfile, experienceRange, employmentTypeFilter, jobTitleFilter, locationFilter, companyFilter, jobsData]);

  const experienceRangeLabel = useMemo(() => {
    const [min, max] = experienceRange;
    if (min === 0 && max >= 10) return 'Any';
    const maxText = max >= 10 ? '10+' : `${max}`;
    return `${min} - ${maxText} yrs`;
  }, [experienceRange]);

  return {
    isFilterOpen, setIsFilterOpen,
    experienceRange, setExperienceRange,
    employmentTypeFilter, setEmploymentTypeFilter,
    jobTitleFilter, setJobTitleFilter,
    locationFilter, setLocationFilter,
    companyFilter, setCompanyFilter,
    resetFilters,
    hasActiveFilters,
    filteredAndSortedJobs,
    experienceRangeLabel
  };
}