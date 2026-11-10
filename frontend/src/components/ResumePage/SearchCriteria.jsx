import React from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
} from '@mui/material';
import { Filter, Plus, Clock, Award, Briefcase, Lightbulb } from 'lucide-react';

// Generates the labels below the slider from 0 to 10+
const marks = Array.from({ length: 11 }, (_, i) => ({
  value: i,
  label: i === 10 ? '10+' : i.toString(),
}));

export default function SearchCriteria({ state, actions }) {
  const { 
    jobTitles, 
    jobTitleInput, 
    experienceRange, 
    studentJobsFilter,
    seniorityJobs,
    employmentType
  } = state;
  
  const {
    setJobTitleInput,
    handleAddJobTitle,
    handleDeleteJobTitle,
    setExperienceRange,
    setStudentJobsFilter,
    setSeniorityJobs,
    setEmploymentType,
  } = actions;

  // The condition that disables the Seniority buttons
  // (if the maximum allowed experience in the range is less than 3)
  const isSeniorityDisabled = experienceRange[1] < 3;

  // Handles slider interactions without crossing thumbs
  const handleSliderChange = (event, newValue, activeThumb) => {
    if (!Array.isArray(newValue)) return;
    
    let nextRange = newValue;

    // Prevent thumbs from crossing each other
    if (newValue[1] - newValue[0] < 0) {
      if (activeThumb === 0) {
        const clamped = Math.min(newValue[0], 10);
        nextRange = [clamped, clamped];
      } else {
        const clamped = Math.max(newValue[1], 0);
        nextRange = [clamped, clamped];
      }
    }

    setExperienceRange(nextRange);

    // If max experience drops below 3, clear any selected seniority jobs
    if (nextRange[1] < 3 && seniorityJobs.length > 0) {
      setSeniorityJobs([]);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Title */}
      <Box sx={{ mb: 3.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <Filter size={20} color="#4f46e5" />
        <Typography variant="h6" fontWeight={700} sx={{ color: '#1e293b', fontSize: '1.2rem' }}>
          Search Criteria
        </Typography>
      </Box>

      <Stack spacing={3.5}>
        {/* Target Job Titles */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#334155' }}>
            Target Job Titles
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. Frontend Engineer, Fullstack Developer"
              value={jobTitleInput}
              onChange={(e) => setJobTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddJobTitle();
                }
              }}
            />
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={handleAddJobTitle}
              sx={{ textTransform: 'none', px: 2.5 }}
            >
              Add
            </Button>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: 2,
              minHeight: 64,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: '#f8fafc',
              borderRadius: 2,
            }}
          >
            {jobTitles.length === 0 ? (
              <Stack spacing={0.75} sx={{ width: '100%', textAlign: 'center', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No target job titles added yet. Type a title and click Add or press Enter.
                </Typography>
                <Box 
                  sx={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 0.6,
                    color: '#64748b'
                  }}
                >
                  <Lightbulb size={14} color="#eab308" style={{ flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ fontWeight: 500, lineHeight: 1 }}>
                    <strong>Tip:</strong> Add several related titles to maximize your job matches.
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%', justifyContent: 'flex-start' }}>
                {jobTitles.map((title) => (
                  <Chip
                    key={title}
                    label={title}
                    onDelete={() => handleDeleteJobTitle(title)}
                    color="secondary"
                    variant="filled"
                    size="small"
                    sx={{ fontWeight: 500 }}
                  />
                ))}
              </Box>
            )}
          </Paper>
        </Box>

        <Divider />

        {/* Years of Experience Required (Slider) */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 4 }}>
            <Clock size={20} color="#1e293b" />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155' }}>
              Years of Experience Required
            </Typography>
          </Box>

          <Box sx={{ px: 2 }}>
            <Slider
              value={experienceRange}
              onChange={handleSliderChange}
              valueLabelDisplay="off"
              min={0}
              max={10}
              marks={marks}
              disableSwap
              sx={{
                color: 'primary.main',
                '& .MuiSlider-markLabel': {
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                  mt: 0.5,
                },
                '& .MuiSlider-markLabelActive': {
                  color: 'text.primary',
                  fontWeight: 700,
                },
              }}
            />
          </Box>
        </Box>

        <Divider />

        {/* Seniority Jobs */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
            <Award size={20} color={isSeniorityDisabled ? '#94a3b8' : '#1e293b'} />
            <Typography 
              variant="subtitle2" 
              fontWeight={700} 
              sx={{ color: isSeniorityDisabled ? '#94a3b8' : '#334155' }}
            >
              Seniority Jobs
            </Typography>
          </Box>
          
          {isSeniorityDisabled && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Requires at least 3 years of maximum experience to enable.
            </Typography>
          )}

          <ToggleButtonGroup
            value={seniorityJobs}
            onChange={(_, newValues) => setSeniorityJobs(newValues)}
            fullWidth
            size="small"
            color="primary"
            disabled={isSeniorityDisabled}
            sx={{
              borderRadius: 2,
              boxShadow: isSeniorityDisabled ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <ToggleButton value="Senior" sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}>
              Senior
            </ToggleButton>
            <ToggleButton value="Lead" sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}>
              Lead
            </ToggleButton>
            <ToggleButton value="Staff" sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}>
              Staff
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider />

        {/* Employment Type Filter */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
            <Briefcase size={20} color="#1e293b" />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155' }}>
              Employment Type
            </Typography>
          </Box>

          <ToggleButtonGroup
            value={employmentType}
            onChange={(_, newValues) => setEmploymentType(newValues)}
            fullWidth
            size="small"
            color="primary"
            sx={{
              borderRadius: 2,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <ToggleButton value="Full Time" sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}>
              Full Time
            </ToggleButton>
            <ToggleButton value="Part Time" sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}>
              Part Time
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider />

        {/* Student Jobs Filter */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#334155' }}>
            Student Jobs Filter
          </Typography>

          <ToggleButtonGroup
            value={studentJobsFilter}
            exclusive
            onChange={(_, val) => val && setStudentJobsFilter(val)}
            fullWidth
            size="small"
            color="primary"
            sx={{
              borderRadius: 2,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <ToggleButton 
              value="include" 
              sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}
            >
              Include Student Jobs
            </ToggleButton>
            <ToggleButton 
              value="only" 
              sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}
            >
              Only Student Jobs
            </ToggleButton>
            <ToggleButton 
              value="none" 
              sx={{ fontWeight: 600, py: 1.1, textTransform: 'none' }}
            >
              No Student Jobs
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>
    </Paper>
  );
}