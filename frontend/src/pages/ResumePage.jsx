import React from 'react';
import { Box, Container, Stack } from '@mui/material';

import { useResume } from '../hooks/useResume';

// Component Imports
import SavedSearchesDrawer from '../components/ResumePage/SavedSearchesDrawer';
import Header from '../components/ResumePage/Header';
import ResumeUpload from '../components/ResumePage/ResumeUpload';
import SearchCriteria from '../components/ResumePage/SearchCriteria';
import ResumeProfile from '../components/ResumePage/ResumeProfile';
import SaveSearchDialog from '../components/ResumePage/SaveSearchDialog';

export default function ResumePage() {
  // Initialize the custom hook to manage all state and logic
  const { state, actions } = useResume();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: 4 }}>
      
      {/* Sidebar Drawer: Displays saved searches */}
      <SavedSearchesDrawer state={state} actions={actions} />

      {/* Main Content Area */}
      <Container maxWidth="md">
        
        {/* Header: Contains the page title and top action buttons (Saved, Reset, Save Search) */}
        <Header state={state} actions={actions} />

        {/* Main Configuration Stack */}
        <Stack spacing={3.5}>
          
          {/* Top Section: Candidate Resume PDF Upload */}
          <ResumeUpload state={state} actions={actions} />

          {/* Section 1: Job Titles, Max Experience, and Student Job Filters */}
          <SearchCriteria state={state} actions={actions} />

          {/* Section 2: Skills, Job Experience, and Education Arrays */}
          <ResumeProfile state={state} actions={actions} />
          
        </Stack>
      </Container>

      {/* Dialog: Modal popup for naming and saving a new search preset */}
      <SaveSearchDialog state={state} actions={actions} />
      
    </Box>
  );
}