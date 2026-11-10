import React from 'react';
import { 
  Drawer, 
  Box, 
  Avatar, 
  Typography, 
  IconButton, 
  Divider, 
  List, 
  ListItem, 
  Tooltip,
  Button
} from '@mui/material';
import { Bookmark, X, FolderOpen, Trash2, Calendar, ArrowRight, Edit3 } from 'lucide-react';

export default function SavedSearchesDrawer({ state, actions }) {
  const { isSidebarOpen, savedSearches, activeSearchId } = state;
  const { 
    setIsSidebarOpen, 
    handleLoadSearch, 
    handleDeleteSavedSearch,
    handleOpenRenameDialog 
  } = actions;

  const handleSelectAndClose = (item) => {
    handleLoadSearch(item);
    setIsSidebarOpen(false);
  };

  return (
    <Drawer
      anchor="left"
      open={isSidebarOpen}
      onClose={() => setIsSidebarOpen(false)}
      sx={{ 
        '& .MuiDrawer-paper': { 
          width: { xs: '85vw', sm: 340 }, 
          bgcolor: '#f8fafc',
          borderRight: '1px solid',
          borderColor: 'divider',
        }
      }}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#e0e7ff', color: '#4f46e5' }}>
              <Bookmark size={16} />
            </Avatar>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#1e293b' }}>
              Saved Searches
            </Typography>
          </Box>
          <IconButton onClick={() => setIsSidebarOpen(false)} size="small" sx={{ color: 'text.secondary' }}>
            <X size={20} />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* List of Searches */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {savedSearches.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <FolderOpen size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <Typography variant="body2" color="text.secondary">
                No saved searches yet.
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                Configure your criteria and click &quot;Save Search&quot;.
              </Typography>
            </Box>
          ) : (
            <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {savedSearches.map((item) => {
                const isLoaded = activeSearchId === item.id;

                return (
                  <ListItem
                    key={item.id}
                    disablePadding
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      borderRadius: 2.5,
                      p: 2,
                      bgcolor: isLoaded ? '#eff6ff' : '#ffffff',
                      border: '1px solid',
                      borderColor: isLoaded ? 'primary.main' : 'divider',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Top Row: Name, Rename & Delete */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ pr: 1 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#1e293b', wordBreak: 'break-word' }}>
                          {item.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Calendar size={12} color="#64748b" />
                          <Typography variant="caption" color="text.secondary">
                            {item.savedAt}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                        <Tooltip title="Rename preset">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenRenameDialog(item)}
                            sx={{ color: '#94a3b8', '&:hover': { color: 'primary.main' } }}
                          >
                            <Edit3 size={15} />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete preset">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteSavedSearch(e, item.id)}
                            sx={{ color: '#94a3b8', '&:hover': { color: 'error.main' } }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Load Button */}
                    <Box sx={{ mt: 1 }}>
                      <Button
                        fullWidth
                        size="small"
                        variant={isLoaded ? 'contained' : 'outlined'}
                        endIcon={<ArrowRight size={14} />}
                        onClick={() => handleSelectAndClose(item)}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.8rem',
                          borderRadius: 1.5,
                          fontWeight: 600,
                          py: 0.6,
                        }}
                      >
                        {isLoaded ? 'Loaded' : 'Load'}
                      </Button>
                    </Box>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}