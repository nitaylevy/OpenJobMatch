import { useState, useMemo, useEffect } from 'react';

export default function useJobFilters(activeProfile) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [experienceRange, setExperienceRange] = useState([0, 10]);
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [jobTitleFilter, setJobTitleFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  useEffect(() => {
    if (!activeProfile) {
      setExperienceRange([0, 10]);
      setEmploymentTypeFilter('all');
      setJobTitleFilter('');
      setLocationFilter('');
      setCompanyFilter('');
      return;
    }

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

    // 2. Years of Experience
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
    experienceRangeLabel
  };
}