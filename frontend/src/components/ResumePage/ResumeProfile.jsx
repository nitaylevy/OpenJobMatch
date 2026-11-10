import React from 'react';
import { 
  Paper, 
  Box, 
  Stack, 
  Typography, 
  Button, 
  TextField, 
  IconButton, 
  Divider, 
  Chip, 
  Grid, 
  ToggleButtonGroup, 
  ToggleButton, 
  MenuItem,
  FormControlLabel,
  Switch
} from '@mui/material';
import { 
  FileText, 
  Briefcase, 
  GraduationCap, 
  Plus, 
  Trash2, 
  Code,
  Users
} from 'lucide-react';

export default function ResumeProfile({ state, actions }) {
  const { jobExperiences, skills, skillInput, softSkills, degrees } = state;
  const { 
    handleAddJobExperience, handleRemoveJobExperience, handleJobExperienceChange, 
    handleAddSkill, setSkillInput, handleDeleteSkill, handleToggleSoftSkill,
    handleAddDegree, handleRemoveDegree, handleDegreeChange 
  } = actions;

  const allSoftSkillsActive = Object.values(softSkills).every(Boolean);

  return (
    <Paper
      elevation={0}
      sx={{ p: 3.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {/* Centered Header */}
      <Box sx={{ mb: 3.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <FileText size={20} color="#2563eb" />
        <Typography variant="h6" fontWeight={700} sx={{ color: '#1e293b', fontSize: '1.2rem' }}>
          Resume Profile
        </Typography>
      </Box>

      <Stack spacing={3.5}>
        {/* Job Experience */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Briefcase size={20} color="#1e293b" />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155' }}>
                Job Experience
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={16} />}
              onClick={handleAddJobExperience}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 2, py: 0.6 }}
            >
              Add Experience
            </Button>
          </Box>

          <Stack spacing={2}>
            {jobExperiences.length === 0 ? (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  bgcolor: '#f8fafc', 
                  borderRadius: 2, 
                  borderColor: 'divider', 
                  borderStyle: 'dashed' 
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No job experience added yet. Click &quot;Add Experience&quot; to add one.
                </Typography>
              </Paper>
            ) : (
              jobExperiences.map((exp) => (
                <Paper key={exp.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#fafafa', position: 'relative' }}>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleRemoveJobExperience(exp.id)} 
                    sx={{ position: 'absolute', top: 12, right: 12 }}
                  >
                    <Trash2 size={16} />
                  </IconButton>

                  <Box 
                    sx={{ 
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'stretch', sm: 'flex-start' },
                      gap: 2,
                      pr: { sm: 5 } 
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Job Title / Role</Typography>
                      <TextField fullWidth size="small" placeholder="e.g. Senior Software Engineer" value={exp.title} onChange={(e) => handleJobExperienceChange(exp.id, 'title', e.target.value)} />
                    </Box>
                    <Box sx={{ width: { xs: '100%', sm: 160 } }}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Years of Experience</Typography>
                      <TextField select fullWidth size="small" value={exp.years} onChange={(e) => handleJobExperienceChange(exp.id, 'years', e.target.value)}>
                        <MenuItem value="1">1 year</MenuItem>
                        <MenuItem value="2">2 years</MenuItem>
                        <MenuItem value="3">3 years</MenuItem>
                        <MenuItem value="4">4 years</MenuItem>
                        <MenuItem value="5">5 years</MenuItem>
                        <MenuItem value="6+">6+ years</MenuItem>
                      </TextField>
                    </Box>
                  </Box>
                </Paper>
              ))
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Skills List */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
            <Code size={20} color="#1e293b" />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155' }}>
              Skills
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField fullWidth size="small" placeholder="e.g. React, Python, AWS, Docker" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }} />
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={handleAddSkill} sx={{ textTransform: 'none', px: 2.5 }}>Add</Button>
          </Box>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 1.5, 
              minHeight: 52, 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 1, 
              alignItems: 'center', 
              justifyContent: skills.length === 0 ? 'center' : 'flex-start',
              bgcolor: '#f8fafc', 
              borderRadius: 2 
            }}
          >
            {skills.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                No skills added yet. Type a skill and click Add or press Enter.
              </Typography>
            ) : (
              skills.map((skill) => (
                <Chip key={skill} label={skill} onDelete={() => handleDeleteSkill(skill)} color="primary" variant="filled" size="small" sx={{ fontWeight: 500 }} />
              ))
            )}
          </Paper>
        </Box>

        <Divider />

        {/* Soft Skills Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
            <Users size={20} color="#1e293b" />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155' }}>
              Soft Skills
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
            {allSoftSkillsActive ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Chip 
                  label="All Skills Included" 
                  color="success" 
                  variant="outlined" 
                  sx={{ fontWeight: 600, borderRadius: 2, px: 1, py: 2 }} 
                />
                <Button 
                  size="small" 
                  variant="text" 
                  onClick={() => handleToggleSoftSkill(Object.keys(softSkills)[0])} 
                  sx={{ textTransform: 'none', fontSize: '0.85rem', ml: 'auto' }}
                >
                  Customize individual skills
                </Button>
              </Box>
            ) : (
              <Grid container spacing={1.5}>
                {Object.entries(softSkills).map(([skillName, isActive]) => (
                  <Grid xs={12} sm={6} key={skillName}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isActive}
                          onChange={() => handleToggleSoftSkill(skillName)}
                          size="small"
                          color="primary"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#334155' }}>
                          {skillName}
                        </Typography>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Box>

        <Divider />

        {/* Education Background */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <GraduationCap size={22} color="#1e293b" />
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#334155' }}>Education Background</Typography>
            </Box>
            <Button variant="outlined" size="small" startIcon={<Plus size={16} />} onClick={handleAddDegree} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 2, py: 0.6 }}>
              Add Degree
            </Button>
          </Box>

          <Stack spacing={2.5}>
            {degrees.length === 0 ? (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  bgcolor: '#f8fafc', 
                  borderRadius: 2, 
                  borderColor: 'divider', 
                  borderStyle: 'dashed' 
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No education history added yet. Click &quot;Add Degree&quot; to add one.
                </Typography>
              </Paper>
            ) : (
              degrees.map((deg) => (
                <Paper key={deg.id} variant="outlined" sx={{ p: 3, borderRadius: 2.5, bgcolor: '#fafafa', position: 'relative' }}>
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleRemoveDegree(deg.id)} 
                    sx={{ position: 'absolute', top: 12, right: 12 }}
                  >
                    <Trash2 size={16} />
                  </IconButton>

                  <Grid container spacing={2.5}>
                    <Grid xs={12}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 1, color: '#334155' }}>Degree Status</Typography>
                      <ToggleButtonGroup value={deg.status} exclusive onChange={(_, val) => val && handleDegreeChange(deg.id, 'status', val)} size="small" color="primary">
                        <ToggleButton value="graduated" sx={{ px: 2.5, py: 0.8, textTransform: 'none', fontWeight: 600 }}>Graduated</ToggleButton>
                        <ToggleButton value="studying" sx={{ px: 2.5, py: 0.8, textTransform: 'none', fontWeight: 600 }}>Currently studying</ToggleButton>
                      </ToggleButtonGroup>
                    </Grid>

                    <Grid xs={12} sm={6}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Institution Type</Typography>
                      <TextField select fullWidth size="small" value={deg.institutionType} onChange={(e) => handleDegreeChange(deg.id, 'institutionType', e.target.value)}>
                        <MenuItem value="University">University</MenuItem>
                        <MenuItem value="College">College</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid xs={12} sm={6}>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Degree Type</Typography>
                      <TextField select fullWidth size="small" value={deg.degreeType} onChange={(e) => handleDegreeChange(deg.id, 'degreeType', e.target.value)}>
                        <MenuItem value="B.Sc.">B.Sc.</MenuItem>
                        <MenuItem value="B.A.">B.A.</MenuItem>
                        <MenuItem value="B.E.">B.E.</MenuItem>
                        <MenuItem value="M.Sc.">M.Sc.</MenuItem>
                        <MenuItem value="M.A.">M.A.</MenuItem>
                        <MenuItem value="MBA">MBA</MenuItem>
                        <MenuItem value="Ph.D.">Ph.D.</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid xs={12}>
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, pr: { sm: 5 } }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Degree Name</Typography>
                          <TextField fullWidth size="small" placeholder="e.g. Computer Science, Electrical Engineering" value={deg.degreeName} onChange={(e) => handleDegreeChange(deg.id, 'degreeName', e.target.value)} />
                        </Box>
                        <Box sx={{ width: { xs: '100%', sm: 110 } }}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>GPA</Typography>
                          <TextField fullWidth size="small" placeholder="e.g. 3.8" value={deg.gpa} onChange={(e) => handleDegreeChange(deg.id, 'gpa', e.target.value)} />
                        </Box>
                      </Box>
                    </Grid>

                    {deg.status === 'studying' && (
                      <>
                        <Grid xs={12} sm={6}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Current Study Year</Typography>
                          <TextField select fullWidth size="small" value={deg.currentYear} onChange={(e) => handleDegreeChange(deg.id, 'currentYear', e.target.value)}>
                            <MenuItem value="1">1</MenuItem>
                            <MenuItem value="2">2</MenuItem>
                            <MenuItem value="3">3</MenuItem>
                            <MenuItem value="4">4</MenuItem>
                          </TextField>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75, color: '#334155' }}>Semesters Left</Typography>
                          <TextField select fullWidth size="small" value={deg.semestersLeft} onChange={(e) => handleDegreeChange(deg.id, 'semestersLeft', e.target.value)}>
                            <MenuItem value="1">1</MenuItem>
                            <MenuItem value="2">2</MenuItem>
                            <MenuItem value="3">3</MenuItem>
                            <MenuItem value="4">4</MenuItem>
                            <MenuItem value="5+">5+</MenuItem>
                          </TextField>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Paper>
              ))
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}