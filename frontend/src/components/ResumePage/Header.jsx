import React from 'react';
import { Box, Avatar, Typography, Button } from '@mui/material';
import { Briefcase, FolderOpen, RotateCcw, BookmarkCheck, RefreshCw } from 'lucide-react';

export default function Header({ state, actions }) {
  const { savedSearches, activeSearchId } = state;
  const { 
    setIsSidebarOpen, 
    handleResetForm, 
    handleOpenSaveDialog,
    handleOpenUpdateDialog 
  } = actions;

  const isPresetLoaded = Boolean(activeSearchId);

  return (
    <Box 
      sx={{ 
        mb: 4, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        flexWrap: 'wrap', 
        gap: 3 
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 2 }}>
          <Avatar
            variant="rounded"
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Briefcase size={22} color="#fff" />
          </Avatar>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(90deg, #1e293b 30%, #4f46e5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Search By Resume
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 7.5, mt: -0.5 }}>
          Parse candidate resumes and match qualifications against experience, education, and skill requirements.
        </Typography>
      </Box>

      {/* Action Bar */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          width: { xs: '100%', sm: 'auto' } 
        }}
      >
        <Button
          variant="outlined"
          color="primary"
          startIcon={<FolderOpen size={16} />}
          onClick={() => setIsSidebarOpen(true)}
          sx={{ textTransform: 'none', borderRadius: 2, bgcolor: '#fff', fontWeight: 600 }}
        >
          Saved ({savedSearches.length})
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<RotateCcw size={16} />}
          onClick={handleResetForm}
          sx={{ textTransform: 'none', borderRadius: 2, borderColor: 'divider', bgcolor: '#fff' }}
        >
          Reset
        </Button>

        {/* Dynamic Button: Updates existing preset when loaded, otherwise Saves new */}
        {isPresetLoaded ? (
          <Button
            variant="contained"
            startIcon={<RefreshCw size={16} />}
            onClick={handleOpenUpdateDialog}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            }}
          >
            Update Search
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<BookmarkCheck size={16} />}
            onClick={handleOpenSaveDialog}
            sx={{
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
            }}
          >
            Save Search
          </Button>
        )}
      </Box>
    </Box>
  );
}