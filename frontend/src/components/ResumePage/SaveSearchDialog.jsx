import React from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, TextField, DialogActions, Button } from '@mui/material';

export default function SaveSearchDialog({ state, actions }) {
  const { saveDialogOpen, newSearchName, dialogMode } = state;
  const { setSaveDialogOpen, setNewSearchName, handleSaveSearch } = actions;

  const isRename = dialogMode === 'rename';
  const isUpdate = dialogMode === 'update';

  const getTitle = () => {
    if (isRename) return 'Rename Saved Search';
    if (isUpdate) return 'Update Saved Search';
    return 'Save Current Search';
  };

  const getDescription = () => {
    if (isRename) return 'Change the name of this saved search. Your saved criteria will not be modified.';
    if (isUpdate) return 'This will overwrite this preset with your current form criteria and profile settings.';
    return 'Give this preset a name so you can reload your search criteria and profile settings at any time.';
  };

  const getButtonText = () => {
    if (isRename) return 'Rename';
    if (isUpdate) return 'Update Preset';
    return 'Save Preset';
  };

  return (
    <Dialog 
      open={saveDialogOpen} 
      onClose={() => setSaveDialogOpen(false)} 
      maxWidth="xs" 
      fullWidth
      sx={{ '& .MuiDialog-paper': { borderRadius: 3, p: 1 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>{getTitle()}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {getDescription()}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Search Name"
          placeholder="e.g. Senior Backend - Go / Cloud"
          value={newSearchName}
          onChange={(e) => setNewSearchName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSaveSearch();
            }
          }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={() => setSaveDialogOpen(false)} 
          sx={{ textTransform: 'none', color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSaveSearch} 
          disabled={!newSearchName.trim()}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {getButtonText()}
        </Button>
      </DialogActions>
    </Dialog>
  );
}