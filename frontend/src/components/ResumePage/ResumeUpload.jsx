import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import { Upload } from 'lucide-react';

export default function ResumeUpload({ state, actions }) {
  const { fileInputRef, isProcessing } = state;
  const { handleFileChange } = actions;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ color: '#1e293b', mb: 0.5 }}
          >
            Candidate Resume
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Upload a PDF or Image to automatically parse and
            pre-fill Search Criteria and Resume Profile.
          </Typography>
        </Box>

        <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          <input
            type="file"
            accept=".pdf,application/pdf,image/png,image/jpeg,image/webp"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <Button
            variant="outlined"
            disabled={isProcessing}
            startIcon={
              isProcessing ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Upload size={18} />
              )
            }
            onClick={() => fileInputRef.current?.click()}
            sx={{
              textTransform: 'none',
              borderStyle: 'dashed',
              borderWidth: 2,
              px: 3,
              py: 1.25,
              borderRadius: 2,
              borderColor: 'divider',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            {isProcessing
              ? 'Processing Resume...'
              : 'Upload Resume (PDF, Image)'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}