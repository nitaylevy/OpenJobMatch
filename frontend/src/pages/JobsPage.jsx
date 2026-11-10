import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Stack, Container, Button, Collapse, 
  Avatar, Select, MenuItem, TextField, FormControl, Slider, Paper, Chip
} from '@mui/material';
import { 
  FileText, Filter, RotateCcw, Briefcase, Clock, Award, MapPin, Building2
} from 'lucide-react';

import jobsData from '../assets/jobs_extracted.json';
import JobCard from '../components/JobPage/JobCard';
import useJobFilters from '../hooks/useJobFilters';

export default function JobsPage({ state, actions }) {
  const [selectedSearchId, setSelectedSearchId] = useState('');

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
    filteredAndSortedJobs,
    experienceRangeLabel
  } = useJobFilters(jobsData, activeProfile);

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

        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexShrink: 0 }}>
          <Button
            variant={isFilterOpen ? "contained" : "outlined"}
            color="primary"
            startIcon={<Filter size={18} />}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              width: 124,
              height: 40,
              justifyContent: 'center'
            }}
          >
            Filters {hasActiveFilters && '*'}
          </Button>

          <Box sx={{ width: 300 }}>
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
              Reset All Filters
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

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
          Showing <Box component="span" sx={{ color: '#0f172a', fontWeight: 700 }}>{filteredAndSortedJobs.length}</Box> of {jobsData.length} job postings
        </Typography>
      </Box>
      
      <Stack spacing={4}>
        {filteredAndSortedJobs.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#475569', mb: 1 }}>
              No job postings matched your filters
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Try loosening your location, title, company, or experience constraints.
            </Typography>
            <Button variant="outlined" size="small" onClick={resetFilters} sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}>
              Reset Filters
            </Button>
          </Paper>
        ) : (
          filteredAndSortedJobs.map(({ job, scores }, index) => (
            <JobCard 
              key={job.job_id || index} 
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