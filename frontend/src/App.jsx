import React, { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';

import { useResume } from './hooks/useResume';
import ResumePage from './pages/ResumePage'; 
import JobsPage from './pages/JobsPage'; 

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const { state, actions } = useResume();

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', px: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Resume Matcher" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem' }} />
          <Tab label="Extracted Jobs Data" sx={{ fontWeight: 600, textTransform: 'none', fontSize: '1rem' }} />
        </Tabs>
      </Box>

      <Box>
        {/* Pass state and actions down as props */}
        {currentTab === 0 && <ResumePage state={state} actions={actions} />}
        {currentTab === 1 && <JobsPage state={state} actions={actions} />}
      </Box>
    </Box>
  );
}

export default App;