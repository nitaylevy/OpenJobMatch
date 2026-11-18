import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Stack, Container, Button, Collapse, 
  Avatar, Select, MenuItem, TextField, FormControl, Slider, Paper, Chip,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { 
  FileText, Filter, RotateCcw, Briefcase, Clock, Award, MapPin, Building2, Search, AlertCircle
} from 'lucide-react';

import defaultJobsData from '../assets/jobs_extracted.json';
import JobCard from '../components/JobPage/JobCard';
import useJobFilters from '../hooks/useJobFilters';
import { calculateJobMatch } from '../utils/scoringEngine';

// Handles standard Create React App or Vite environment variables
const LAMBDA_URL = import.meta.env.VITE_GET_FILTERED_JOBS_URL || "https://<your-api-id>.lambda-url.eu-west-1.on.aws/";

export default function JobsPage({ state, actions }) {
  const [selectedSearchId, setSelectedSearchId] = useState('');
  const [fetchedJobs, setFetchedJobs] = useState(defaultJobsData);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const activeProfile = useMemo(() => {
    if (!selectedSearchId) return null;
    const found = state.savedSearches?.find(s => s.id === selectedSearchId);
    return found ? (found.data || found) : null;
  }, [selectedSearchId, state.savedSearches]);

  const candidateSkills = useMemo(() => activeProfile?.skills || [], [activeProfile]);

  const {
    isFilterOpen, setIsFilterOpen,
    experienceRange, setExperienceRange,
    employmentTypeFilter, setEmploymentTypeFilter,
    jobTitleFilter, setJobTitleFilter,
    locationFilter, setLocationFilter,
    companyFilter, setCompanyFilter,
    resetFilters,
    hasActiveFilters,
    experienceRangeLabel
  } = useJobFilters(activeProfile);

  const handleSearchJobs = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setHasSearched(true);
    setIsFilterOpen(false); // Optionally close filters on search

    try {
      const payload = {
        companies: companyFilter ? companyFilter.split(/[,|/]/).map(c => c.trim()).filter(Boolean) : [],
        job_titles: jobTitleFilter ? jobTitleFilter.split(/[,|/]/).map(t => t.trim()).filter(Boolean) : [],
        employment_type: employmentTypeFilter !== 'all' ? [employmentTypeFilter] : [],
        locations: locationFilter ? locationFilter.split(/[,|/]/).map(l => l.trim()).filter(Boolean) : [],
        min_experience: experienceRange[0] > 0 ? experienceRange[0] : null,
        max_experience: experienceRange[1] < 10 ? experienceRange[1] : null,
        limit: 200
      };

      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const jobsArray = Array.isArray(data) ? data : (data.jobs || []);
      setFetchedJobs(jobsArray);

    } catch (err) {
      console.error("Error fetching jobs from Lambda:", err);
      setErrorMsg(`Failed to load jobs from server (${err.message}). Displaying default demo jobs instead.`);
      setFetchedJobs(defaultJobsData);
    } finally {
      setIsLoading(false);
    }
  };

  const isUsingLocalData = fetchedJobs === defaultJobsData;

  const displayedAndSortedJobs = useMemo(() => {
    let jobsToProcess = fetchedJobs;

    // Local Filtering Fallback (Only runs if Lambda wasn't used or failed)
    if (isUsingLocalData) {
      jobsToProcess = jobsToProcess.filter(job => {
        // 1. Company Filter
        if (companyFilter) {
          const companies = companyFilter.split(/[,|/]/).map(c => c.trim().toLowerCase()).filter(Boolean);
          const jobCompany = (job.company || job.company_name || '').toLowerCase();
          if (companies.length > 0 && !companies.some(c => jobCompany.includes(c))) return false;
        }

        // 2. Job Title Filter (Checks BOTH title and full content)
        if (jobTitleFilter) {
          const titles = jobTitleFilter.split(/[,|/]/).map(t => t.trim().toLowerCase()).filter(Boolean);
          const jTitle = (job.title || job.job_title || '').toLowerCase();
          const jContent = (job.content_full || job.text || '').toLowerCase();
          if (titles.length > 0 && !titles.some(t => jTitle.includes(t) || jContent.includes(t))) return false;
        }

        // 3. Location Filter
        if (locationFilter) {
          const locations = locationFilter.split(/[,|/]/).map(l => l.trim().toLowerCase()).filter(Boolean);
          const jLoc = (job.location || '').toLowerCase();
          if (locations.length > 0 && !locations.some(l => jLoc.includes(l))) return false;
        }

        // 4. Employment Type Filter
        if (employmentTypeFilter !== 'all') {
          const jEmp = (job.employment_type || '').toLowerCase();
          // Check for 'full' or 'part' time matches
          const typeKeyword = employmentTypeFilter.split('-')[0]; 
          if (jEmp && !jEmp.includes(typeKeyword)) return false;
        }

        // 5. Experience Filter
        const [minExp, maxExp] = experienceRange;
        if (minExp > 0 || maxExp < 10) {
          const jobMinExpRaw = job.min_experience_years || job['Min Experience Years'];
          
          let jobMinExp = null;
          if (Array.isArray(jobMinExpRaw) && jobMinExpRaw.length > 0) {
            jobMinExp = parseInt(jobMinExpRaw[0], 10);
          } else if (typeof jobMinExpRaw === 'string' || typeof jobMinExpRaw === 'number') {
            jobMinExp = parseInt(jobMinExpRaw, 10);
          }
          
          if (jobMinExp !== null && !isNaN(jobMinExp)) {
            if (jobMinExp < minExp) return false;
            if (jobMinExp > maxExp && maxExp < 10) return false;
          }
        }

        return true;
      });
    }

    // Scoring & Sorting phase
    const calculated = jobsToProcess.map((job) => ({
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
  }, [
    fetchedJobs, 
    activeProfile, 
    isUsingLocalData, 
    companyFilter, 
    jobTitleFilter, 
    locationFilter, 
    employmentTypeFilter, 
    experienceRange
  ]);

  const handleAddSkillsToProfile = (newSkills) => {
    if (!selectedSearchId || !actions?.handleUpdateSavedSearchSkills || !newSkills.length) return;
    actions.handleUpdateSavedSearchSkills(selectedSearchId, newSkills);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
            <Avatar variant="rounded" sx={{ width: 44, height: 44, borderRadius: 3, background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}>
              <FileText size={22} color="#fff" />
            </Avatar>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(90deg, #1e293b 30%, #4f46e5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Extracted Job Postings
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 7.5, mt: -0.5 }}>
            Filter by experience, title, company, or location, and score against your profile.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
          {/* Moved Search Button outside of filters block */}
          <Button
            variant="contained"
            color="primary"
            onClick={handleSearchJobs}
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <Search size={18} />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, height: 40, px: 3, boxShadow: 'none' }}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </Button>

          <Button
            variant={isFilterOpen ? "contained" : "outlined"}
            color="primary"
            startIcon={<Filter size={18} />}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, height: 40, bgcolor: isFilterOpen ? 'primary.main' : 'transparent', boxShadow: 'none' }}
          >
            Filters {hasActiveFilters && '*'}
          </Button>

          <Box sx={{ width: 260 }}>
            <Select 
              value={selectedSearchId} 
              onChange={(e) => setSelectedSearchId(e.target.value)}
              displayEmpty
              size="small" 
              fullWidth 
              sx={{ bgcolor: 'white', borderRadius: 2, fontWeight: 600, height: 40 }}
            >
              <MenuItem value="">
                <em>Select a Saved Resume Search</em>
              </MenuItem>
              {state.savedSearches?.length === 0 ? (
                <MenuItem disabled value="none">
                  No saved searches found
                </MenuItem>
              ) : (
                state.savedSearches?.map((search) => (
                  <MenuItem key={search.id} value={search.id}>
                    {search.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </Box>
        </Stack>
      </Box>

      <Collapse in={isFilterOpen} timeout="auto" unmountOnExit>
        <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 3.5 }, mb: 4, borderRadius: 3, border: '1px solid', borderColor: '#e2e8f0', bgcolor: '#ffffff', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, minHeight: 40 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Filter size={18} color="#2563eb" />
              Filter Job Postings
            </Typography>
            <Button
              size="small"
              variant="text"
              startIcon={<RotateCcw size={14} />}
              onClick={resetFilters}
              sx={{ 
                textTransform: 'none', 
                fontWeight: 600, 
                color: 'text.secondary', 
                visibility: hasActiveFilters ? 'visible' : 'hidden',
                pointerEvents: hasActiveFilters ? 'auto' : 'none',
                '&:hover': { color: 'error.main' } 
              }}
            >
              Clear Filters
            </Button>
          </Box>

          <Stack spacing={2.5}>
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #edf2f7' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                <Box sx={{ p: 0.6, bgcolor: '#eff6ff', borderRadius: 1.5, color: '#2563eb', display: 'flex' }}><Briefcase size={16} /></Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>Job Titles</Typography>
              </Box>
              <TextField fullWidth size="small" placeholder="e.g. Engineer, Developer, DevOps" value={jobTitleFilter} onChange={(e) => setJobTitleFilter(e.target.value)} sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }} />
            </Box>

            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #edf2f7' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                <Box sx={{ p: 0.6, bgcolor: '#f3e8ff', borderRadius: 1.5, color: '#7c3aed', display: 'flex' }}><Clock size={16} /></Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>Employment Type</Typography>
              </Box>
              <FormControl fullWidth size="small">
                <Select value={employmentTypeFilter} onChange={(e) => setEmploymentTypeFilter(e.target.value)} sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }}>
                  <MenuItem value="all">All Employment Types</MenuItem>
                  <MenuItem value="full-time">Full-time</MenuItem>
                  <MenuItem value="part-time">Part-time</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #edf2f7' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                  <Box sx={{ p: 0.6, bgcolor: '#ffedd5', borderRadius: 1.5, color: '#ea580c', display: 'flex' }}><Award size={16} /></Box>
                  <Typography variant="caption" fontWeight={700} sx={{ color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>Experience Required</Typography>
                </Box>
                <Chip label={experienceRangeLabel} size="small" sx={{ fontWeight: 700, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }} />
              </Box>
              <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
                <Slider value={experienceRange} onChange={(_, val) => setExperienceRange(val)} min={0} max={10} step={1} valueLabelDisplay="auto" valueLabelFormat={(v) => (v >= 10 ? '10+' : `${v}`)} disableSwap />
              </Box>
            </Box>

            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #edf2f7' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                <Box sx={{ p: 0.6, bgcolor: '#ecfdf5', borderRadius: 1.5, color: '#059669', display: 'flex' }}><MapPin size={16} /></Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>Locations</Typography>
              </Box>
              <TextField fullWidth size="small" placeholder="e.g. Tel Aviv, New York, Remote" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }} />
            </Box>

            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #edf2f7' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                <Box sx={{ p: 0.6, bgcolor: '#fef2f2', borderRadius: 1.5, color: '#dc2626', display: 'flex' }}><Building2 size={16} /></Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>Companies</Typography>
              </Box>
              <TextField fullWidth size="small" placeholder="e.g. Google, Microsoft, Meta" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} sx={{ bgcolor: '#ffffff', borderRadius: 1.5 }} />
            </Box>
          </Stack>
        </Paper>
      </Collapse>

      {/* Error Modal Window */}
      <Dialog 
        open={Boolean(errorMsg)} 
        onClose={() => setErrorMsg('')}
        maxWidth="sm"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AlertCircle size={22} />
          Error Fetching Jobs
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.6 }}>
            {errorMsg}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button 
            onClick={() => setErrorMsg('')} 
            variant="contained" 
            color="error" 
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, boxShadow: 'none', px: 3 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
          Showing <Box component="span" sx={{ color: '#0f172a', fontWeight: 700 }}>{displayedAndSortedJobs.length}</Box> job postings
          {hasSearched && !errorMsg ? ' from server' : ' (Default/Fallback)'}
        </Typography>
      </Box>
      
      <Stack spacing={4}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : displayedAndSortedJobs.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#475569', mb: 1 }}>
              No job postings found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Try loosening your filters and searching again.
            </Typography>
            <Button variant="outlined" size="small" onClick={() => setIsFilterOpen(true)} sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}>
              Adjust Filters
            </Button>
          </Paper>
        ) : (
          displayedAndSortedJobs.map(({ job, scores }, index) => (
            <JobCard 
              key={job.job_id || job.id || index} 
              job={job} 
              precomputedScores={scores}
              candidateSkills={candidateSkills}
              activeProfile={activeProfile}
              onAddSkillsToProfile={handleAddSkillsToProfile}
            />
          ))
        )}
      </Stack>
    </Container>
  );
}