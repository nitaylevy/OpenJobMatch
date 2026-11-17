import React, { useState, useMemo } from 'react';
import { 
  Box, Card, CardContent, Typography, Chip, Stack, Divider,
  Button, Collapse, CircularProgress, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Paper,
  Checkbox
} from '@mui/material';
import { 
  MapPin, Briefcase, Building, ChevronDown, ChevronUp, CheckCircle2, 
  Target, GraduationCap, Sparkles, ExternalLink, CircleDot, XCircle, 
  CalendarClock, ClipboardList, Copy, Plus, Code, Users, Clock
} from 'lucide-react';

import { 
  isValidMetadataString, 
  hasValidText, 
  parseItemString, 
  getScoreTheme,
  generateLinkedInLeadsUrl 
} from '../../utils/jobHelpers';
import { generateReferralMessage } from '../../utils/referralMessageLogic';

const ATTRIBUTE_SECTIONS = [
  {
    key: "experience", title: "Experience & Skills", icon: Target, iconColor: '#2563eb', iconBg: '#eff6ff',
    items: [
      { label: "Min Experience Years", keys: ["min_experience_years", "Min Experience Years"] },
      { label: "Hard Skills", keys: ["hard_skills", "Hard Skills"] },
      { label: "Soft Skills", keys: ["soft_skills", "Soft Skills"] }
    ]
  },
  {
    key: "education", title: "Education Requirements", icon: GraduationCap, iconColor: '#7c3aed', iconBg: '#f3e8ff',
    items: [
      { label: "Degree Types", keys: ["degree_types", "Degree Types"] },
      { label: "Degree Names", keys: ["degree_names", "Degree Names"] },
      { label: "Accepting Related Degrees or Experience", keys: ["accepting_related_degrees_or_experience", "Accepting Related Degrees or Experience"] },
      { label: "University Only", keys: ["university_only", "University Only"] },
      { label: "Remaining Studies", keys: ["remaining_studies", "Remaining Studies"] },
      { label: "Grade", keys: ["grade", "Grade"] }
    ]
  },
  {
    key: "advantages", title: "Advantages (Nice-to-Have)", icon: Sparkles, iconColor: '#ea580c', iconBg: '#ffedd5',
    items: [
      { label: "Hard Skills", keys: ["advantage_hard_skills", "Advantage - Hard Skills"] },
      { label: "Degree Types", keys: ["advantage_degree_types", "Advantage - Degree Types"] },
      { label: "Degree Names", keys: ["advantage_degree_names", "Advantage - Degree Names"] },
      { label: "Accepting Related Degrees", keys: ["advantage_accepting_related_degrees_or_experience", "Advantage - Accepting Related Degrees or Experience"] },
      { label: "University Only", keys: ["advantage_university_only", "Advantage - University Only"] },
      { label: "Remaining Studies", keys: ["advantage_remaining_studies", "Advantage - Remaining Studies"] },
      { label: "Grade", keys: ["advantage_grade", "Advantage - Grade"] },
      { label: "Soft Skills", keys: ["advantage_soft_skills", "Advantage - Soft Skills"] }
    ]
  }
];

const getRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr; 

  const diffInHours = Math.floor((new Date() - date) / (1000 * 60 * 60));

  if (diffInHours >= 24) {
    const days = Math.floor(diffInHours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  
  if (diffInHours < 1) {
    return 'Less than an hour ago';
  }

  return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
};

const cleanBrackets = (str) => {
  if (!str) return '';
  return str
    .replace(/^\[\s*|\s*\]$/g, '')
    .replace(/\[([^\]]+)\]/g, '$1')
    .trim();
};

const HighlightedText = ({ text, skillsToHighlight = [] }) => {
  if (!text || !skillsToHighlight.length) return <span>{text}</span>;
  const validSkills = skillsToHighlight
    .map(s => String(s).trim())
    .filter(s => s.length >= 2)
    .sort((a, b) => b.length - a.length);

  if (!validSkills.length) return <span>{text}</span>;

  const escaped = validSkills.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(\\b(?:${escaped.join('|')})\\b)`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isMatched = validSkills.some(s => s.toLowerCase() === part.toLowerCase());
        if (isMatched) {
          return (
            <Box component="span" key={i} sx={{ bgcolor: '#dcfce7', color: '#15803d', px: 0.6, py: 0.2, borderRadius: 1, fontWeight: 700, border: '1px solid #bbf7d0', mx: 0.2 }}>
              {part}
            </Box>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

const AttributeItem = ({ itemStr, shouldHighlight = false, candidateSkills = [], preferQuote = false, labelPrefix = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { mainText, quote } = parseItemString(itemStr);

  if (!mainText && !quote) return null;

  const rawText = (preferQuote && quote) ? quote : mainText;
  let displayText = rawText ? cleanBrackets(rawText).replace(/\s*;\s*/g, ', ') : '';

  if (labelPrefix && displayText.toLowerCase().startsWith(`${labelPrefix.toLowerCase()}:`)) {
    displayText = displayText.slice(labelPrefix.length + 1).trim();
  }

  let prefix = '';
  let suffix = displayText;
  if (displayText && displayText.includes(': ')) {
    const splitIdx = displayText.indexOf(': ');
    prefix = displayText.slice(0, splitIdx + 2);
    suffix = displayText.slice(splitIdx + 2);
  }

  const cleanedQuote = cleanBrackets(quote);
  const hasInteractiveQuote = Boolean(cleanedQuote && !preferQuote);

  return (
    <Box sx={{ mb: shouldHighlight ? 0 : 1.5, '&:last-child': { mb: 0 }, width: '100%' }}>
      <Box 
        onClick={() => {
          if (hasInteractiveQuote) setIsOpen(!isOpen);
        }}
        sx={{ 
          display: 'flex', 
          flexDirection: 'row', 
          alignItems: 'flex-start', 
          gap: 1.5,
          p: hasInteractiveQuote ? 0.5 : 0,
          mx: hasInteractiveQuote ? -0.5 : 0,
          borderRadius: 1.5,
          cursor: hasInteractiveQuote ? 'pointer' : 'default',
          userSelect: hasInteractiveQuote ? 'none' : 'text',
          transition: 'background-color 0.15s ease',
          '&:hover': hasInteractiveQuote ? { bgcolor: '#f8fafc' } : {}
        }}
      >
        <Box 
          sx={{ 
            mt: 0.85, 
            width: 6, 
            height: 6, 
            minWidth: 6, 
            borderRadius: '50%', 
            bgcolor: (isOpen && hasInteractiveQuote) ? '#7c3aed' : 'primary.main', 
            flexShrink: 0,
            transition: 'background-color 0.2s ease'
          }} 
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            {displayText && (
              <Typography variant="body2" sx={{ color: '#1e293b', lineHeight: 1.6, textAlign: 'left', wordBreak: 'break-word' }}>
                {labelPrefix && <Box component="span" sx={{ fontWeight: 700 }}>{labelPrefix}: </Box>}
                {prefix && <Box component="span" sx={{ fontWeight: 600 }}>{prefix}</Box>}
                {shouldHighlight ? (
                  <HighlightedText text={suffix} skillsToHighlight={candidateSkills} />
                ) : (
                  <Box component="span" sx={{ fontWeight: 400 }}>{suffix}</Box>
                )}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {hasInteractiveQuote && (
        <Collapse in={isOpen} sx={{ width: '100%', pl: 2.25, mt: 0.5 }}>
          <Box sx={{ p: 1.25, bgcolor: '#f1f5f9', borderRadius: 1.5, borderLeft: '3px solid', borderColor: '#7c3aed', textAlign: 'left' }}>
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#475569', lineHeight: 1.5, display: 'block', textAlign: 'left' }}>
              &quot;{cleanedQuote}&quot;
            </Typography>
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

const StatusIcon = ({ matchInfo }) => {
  if (!matchInfo) return null;
  const { type, percentage, globalEarnedPct, globalMaxPct } = matchInfo;
  
  let tooltipText = '';
  if (globalMaxPct !== undefined && globalMaxPct > 0) {
    tooltipText = `${type === 'full' ? 'Complete' : type === 'partial' ? 'Partial' : 'No'} Match (${globalEarnedPct}% / ${globalMaxPct}%)`;
  } else {
    tooltipText = `${type === 'full' ? 'Complete' : type === 'partial' ? 'Partial' : 'No'} Match (${percentage ?? (type === 'full' ? 100 : 0)}%)`;
  }

  if (type === 'full') return <Tooltip title={tooltipText}><CheckCircle2 size={18} color="#15803d" /></Tooltip>;
  if (type === 'partial') return <Tooltip title={tooltipText}><CircleDot size={18} color="#d97706" /></Tooltip>;
  return <Tooltip title={tooltipText}><XCircle size={18} color="#b91c1c" /></Tooltip>;
};

const EducationSectionBox = ({ populatedItems }) => {
  const validEducationList = populatedItems.flatMap(itemConf => {
    return itemConf.validItems.map(rawVal => ({
      label: itemConf.label,
      rawVal: rawVal
    })).filter(item => {
      const { mainText } = parseItemString(item.rawVal);
      return mainText && mainText.trim().toLowerCase() !== 'none';
    });
  });

  if (validEducationList.length === 0) return null;

  return (
    <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle2 size={16} color="#7c3aed" />
          <Typography variant="caption" fontWeight={700} sx={{ color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>
            Education Requirements
          </Typography>
        </Box>
      </Box>

      <Stack spacing={1} sx={{ width: '100%' }}>
        {validEducationList.map((item, idx) => (
          <AttributeItem 
            key={idx} 
            itemStr={item.rawVal} 
            labelPrefix={item.label} 
          />
        ))}
      </Stack>
    </Box>
  );
};

const AttributeSectionBox = ({ itemConf, sectionKey, activeProfile, handleOpenAddSkills, precomputedScores, candidateSkills }) => {
  const statusKey = `${sectionKey}_${itemConf.label}`;
  const matchInfo = precomputedScores?.itemStatuses?.[statusKey] || precomputedScores?.itemStatuses?.[itemConf.label] || null;
  const isToolsBox = itemConf.label === "Hard Skills";

  return (
    <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircle2 size={16} color="#3b82f6" />
          <Typography variant="caption" fontWeight={700} sx={{ color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left' }}>{itemConf.label}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isToolsBox && activeProfile && (
            <Button 
              size="small" 
              variant="outlined" 
              startIcon={<Plus size={14} />}
              onClick={() => handleOpenAddSkills(itemConf.validItems)}
              sx={{ textTransform: 'none', borderRadius: 1.5, py: 0.2, fontSize: '0.75rem' }}
            >
              Add Missing Skills
            </Button>
          )}
          {matchInfo && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {matchInfo.globalMaxPct !== undefined && matchInfo.globalMaxPct > 0 && (
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', bgcolor: '#f8fafc', px: 1, py: 0.25, borderRadius: 1, border: '1px solid #e2e8f0' }}>
                  {matchInfo.globalEarnedPct}% / {matchInfo.globalMaxPct}%
                </Typography>
              )}
              <StatusIcon matchInfo={matchInfo} />
            </Box>
          )}
        </Box>
      </Box>
      <Box 
        sx={{ 
          flex: 1, 
          width: '100%', 
          textAlign: 'left',
          ...(isToolsBox && itemConf.validItems.length > 1 ? {
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            columnGap: 3,
            rowGap: 1.5,
            alignItems: 'start'
          } : {})
        }}
      >
        {itemConf.validItems.map((item, i) => (
          <AttributeItem 
            key={i} 
            itemStr={item} 
            shouldHighlight={isToolsBox}
            preferQuote={itemConf.label === "Min Experience Years"}
            candidateSkills={candidateSkills} 
          />
        ))}
      </Box>
    </Box>
  );
};

const ScoreRing = ({ score, label }) => {
  if (score === null || score === undefined) return null;
  const theme = getScoreTheme(score);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={54} thickness={4} sx={{ color: '#f1f5f9' }} />
        <CircularProgress 
          variant="determinate" 
          value={score} 
          size={54} 
          thickness={4} 
          sx={{ 
            color: theme.ring, 
            position: 'absolute', 
            left: 0, 
            transition: 'color 0.3s ease, stroke-dashoffset 0.5s ease-in-out' 
          }} 
        />
        <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" component="div" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
            {score}%
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
};

export default function JobCard({ job, precomputedScores, candidateSkills = [], activeProfile, onAddSkillsToProfile }) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  
  const [openSections, setOpenSections] = useState({ 
    responsibilities: true, 
    experience: true, 
    education: true, 
    advantages: true, 
    availability: true 
  });
  
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [referralSubject, setReferralSubject] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const [isAddSkillsModalOpen, setIsAddSkillsModalOpen] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState([]);

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const displayTitle = job.title || job.job_title;
  const displayCompany = job.company || job.company_name;
  const fullDescriptionText = job.content_full || job.text;

  const linkedInLeadsUrl = useMemo(() => {
    return generateLinkedInLeadsUrl ? generateLinkedInLeadsUrl(displayCompany) : '';
  }, [displayCompany]);

  const handleOpenReferralModal = () => {
    const { subject, message } = generateReferralMessage(job, activeProfile);
    setReferralSubject(subject);
    setReferralMessage(message);
    setIsReferralModalOpen(true);
  };

  const handleCopy = (text, setFeedback) => {
    navigator.clipboard.writeText(text).then(() => {
      setFeedback(true);
      setTimeout(() => setFeedback(false), 2000);
    });
  };

  const handleOpenAddSkills = (validItems) => {
    let allExtracted = [];
    validItems.forEach(item => {
      const { mainText } = parseItemString(item);
      if (!mainText) return;
      
      let content = mainText;
      if (content.includes(':')) {
        content = content.split(':').slice(1).join(':');
      }
      
      const parts = content.split(/,| and /i)
        .map(s => s.replace(/['"]/g, '').trim())
        .filter(s => s.length > 0);
        
      allExtracted.push(...parts);
    });

    const lowerExisting = candidateSkills.map(s => s.toLowerCase());
    const uniqueMissing = [...new Set(allExtracted.filter(s => !lowerExisting.includes(s.toLowerCase())))];
    
    setExtractedSkills(uniqueMissing.map(skill => ({ name: skill, checked: true })));
    setIsAddSkillsModalOpen(true);
  };

  const handleSkillTextChange = (index, newName) => {
    setExtractedSkills(prev => prev.map((item, i) => i === index ? { ...item, name: newName } : item));
  };

  const handleSkillToggle = (index) => {
    setExtractedSkills(prev => prev.map((item, i) => i === index ? { ...item, checked: !item.checked } : item));
  };

  const handleToggleSelectAll = () => {
    const allChecked = extractedSkills.every(s => s.checked);
    setExtractedSkills(prev => prev.map(s => ({ ...s, checked: !allChecked })));
  };

  const handleConfirmAddSkills = () => {
    const finalSkills = extractedSkills
      .filter(s => s.checked)
      .map(s => s.name.trim())
      .filter(Boolean);

    if (finalSkills.length > 0 && onAddSkillsToProfile) {
      onAddSkillsToProfile(finalSkills);
    }
    setIsAddSkillsModalOpen(false);
  };

  const checkedCount = useMemo(() => extractedSkills.filter(s => s.checked).length, [extractedSkills]);

  const responsibilitiesList = useMemo(() => {
    const raw = job["responsibilities"] ?? job["Responsibilities"];
    if (!raw || typeof raw !== 'string') return [];
    const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0 && !line.toLowerCase().includes('none')).map(line => line.replace(/^[-*•]\s*/, ''));
    return lines.length > 1 ? lines.slice(1) : lines;
  }, [job]);

  const hasAdvantages = useMemo(() => {
    const advantageKeys = [
      "advantage_hard_skills", "Advantage - Hard Skills", 
      "advantage_degree_types", "Advantage - Degree Types", 
      "advantage_degree_names", "Advantage - Degree Names", 
      "advantage_accepting_related_degrees_or_experience", "Advantage - Accepting Related Degrees or Experience", 
      "advantage_university_only", "Advantage - University Only", 
      "advantage_remaining_studies", "Advantage - Remaining Studies", 
      "advantage_grade", "Advantage - Grade", 
      "advantage_soft_skills", "Advantage - Soft Skills"
    ];
    return advantageKeys.some((k) => Array.isArray(job[k]) ? job[k].some(isValidMetadataString) : isValidMetadataString(job[k]));
  }, [job]);

  const availabilityItems = useMemo(() => {
    const raw = job["availability"] ?? job["Availability"];
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [raw]).filter(isValidMetadataString);
  }, [job]);

  const getSectionData = (sectionKey) => {
    if (!precomputedScores || !precomputedScores.sections) return null;
    return precomputedScores.sections[sectionKey] || null;
  };

  return (
    <>
      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid', borderColor: 'divider', transition: 'box-shadow 0.2s ease', textAlign: 'left', '&:hover': { boxShadow: '0 6px 24px rgba(0,0,0,0.08)' } }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 2 }}>
              <Box sx={{ textAlign: 'left', flex: 1 }}>
                <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', mb: 1.5, textAlign: 'left' }}>
                  {displayTitle}
                </Typography>
                
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start', mb: 2.5 }}>
                  {isValidMetadataString(displayCompany) && <Chip icon={<Building size={16} />} label={displayCompany} size="small" sx={{ borderRadius: 1.5, fontWeight: 600, bgcolor: '#f1f5f9', color: '#334155' }} />}
                  {isValidMetadataString(job.location) && <Chip icon={<MapPin size={16} />} label={job.location} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 600 }} />}
                  {isValidMetadataString(job.employment_type) && <Chip icon={<Briefcase size={16} />} label={job.employment_type} size="small" variant="outlined" color="primary" sx={{ borderRadius: 1.5, fontWeight: 600 }} />}
                  {isValidMetadataString(job.updated_at_formatted) && (
                    <Chip 
                      icon={<Clock size={16} />} 
                      label={getRelativeTime(job.updated_at_formatted)} 
                      size="small" 
                      variant="outlined" 
                      sx={{ 
                        borderRadius: 1.5, 
                        fontWeight: 600, 
                        color: 'text.secondary', 
                        borderColor: 'divider',
                        bgcolor: '#fafafa'
                      }} 
                    />
                  )}
                </Stack>
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    size="small" 
                    component="a" 
                    href={job.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    endIcon={<ExternalLink size={14} />} 
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, px: 2, py: 0.5, boxShadow: 'none' }}
                  >
                    Apply
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={handleOpenReferralModal}
                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, px: 2, py: 0.5 }}
                  >
                    Referral Message
                  </Button>
                  {linkedInLeadsUrl && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      component="a"
                      href={linkedInLeadsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<Users size={14} />}
                      endIcon={<ExternalLink size={12} />}
                      sx={{ 
                        borderRadius: 1.5, 
                        textTransform: 'none', 
                        fontWeight: 600, 
                        px: 2, 
                        py: 0.5,
                        color: '#0a66c2',
                        borderColor: '#0a66c2',
                        '&:hover': {
                          borderColor: '#004182',
                          bgcolor: 'rgba(10, 102, 194, 0.04)'
                        }
                      }}
                    >
                      Find Leads
                    </Button>
                  )}
                </Stack>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {precomputedScores && (
                  <>
                    <ScoreRing score={precomputedScores.mandatory} label="Core Match" />
                    {hasAdvantages && precomputedScores.advantages !== null && <ScoreRing score={precomputedScores.advantages} label="Bonus Fit" />}
                  </>
                )}
                <IconButton size="small" onClick={() => setIsDetailsExpanded(!isDetailsExpanded)} sx={{ bgcolor: isDetailsExpanded ? 'primary.50' : 'transparent', color: isDetailsExpanded ? 'primary.main' : 'text.secondary', ml: 1 }}>
                  {isDetailsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </IconButton>
              </Box>
            </Box>

            <Collapse in={isDetailsExpanded} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
              <Stack spacing={3.5} sx={{ mt: 4 }}>
                {responsibilitiesList.length > 0 && (
                  <Box sx={{ textAlign: 'left' }}>
                    <Box onClick={() => toggleSection('responsibilities')} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: openSections.responsibilities ? 2 : 0, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.85 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClipboardList size={20} /></Box>
                        <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>Responsibilities</Typography>
                      </Box>
                      <IconButton size="small" sx={{ color: 'text.secondary' }}>{openSections.responsibilities ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</IconButton>
                    </Box>
                    <Collapse in={openSections.responsibilities} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <Box sx={{ width: '100%', textAlign: 'left' }}>{responsibilitiesList.map((line, i) => <AttributeItem key={i} itemStr={line} />)}</Box>
                      </Box>
                    </Collapse>
                  </Box>
                )}

                {ATTRIBUTE_SECTIONS.map((section, idx) => {
                  const populatedItems = section.items.map((itemConf) => {
                    let rawValues = [];
                    if (itemConf.keys) {
                      itemConf.keys.forEach(k => { if (job[k] !== undefined) rawValues.push(...(Array.isArray(job[k]) ? job[k] : [job[k]])); });
                    } else if (itemConf.keyPattern) {
                      Object.keys(job).forEach(k => { if (itemConf.keyPattern.test(k)) rawValues.push(...(Array.isArray(job[k]) ? job[k] : [job[k]])); });
                    } else {
                      if (job[itemConf.key] !== undefined) rawValues.push(...(Array.isArray(job[itemConf.key]) ? job[itemConf.key] : [job[itemConf.key]]));
                    }
                    const validItems = rawValues
                      .filter(isValidMetadataString)
                      .filter(v => typeof v !== 'string' || v.trim().toLowerCase() !== 'none');
                    return { ...itemConf, validItems, hasInfo: validItems.length > 0 };
                  }).filter(item => item.hasInfo);

                  if (populatedItems.length === 0) return null;
                  const SectionIcon = section.icon;
                  const isSectionOpen = Boolean(openSections[section.key]);

                  const sectionData = getSectionData(section.key);
                  const sectionScore = sectionData?.score ?? null;
                  const sectionTheme = sectionScore !== null ? getScoreTheme(sectionScore) : null;
                  
                  let matchLabel = '';
                  if (sectionData && sectionData.globalMaxPct > 0) {
                    matchLabel = `Match: ${sectionData.globalEarnedPct}% / ${sectionData.globalMaxPct}%`;
                  } else if (sectionScore !== null) {
                    matchLabel = `Match: ${sectionScore}%`;
                  }

                  return (
                    <Box key={idx} sx={{ textAlign: 'left' }}>
                      <Box onClick={() => toggleSection(section.key)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isSectionOpen ? 2 : 0, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.85 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ p: 1, borderRadius: 2, bgcolor: section.iconBg, color: section.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SectionIcon size={20} /></Box>
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>{section.title}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {matchLabel && <Chip label={matchLabel} size="small" sx={{ fontWeight: 700, bgcolor: sectionTheme.bg, color: sectionTheme.text, border: '1px solid', borderColor: sectionTheme.border, borderRadius: 1.5, px: 0.5 }} />}
                          <IconButton size="small" sx={{ color: 'text.secondary' }}>{isSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</IconButton>
                        </Box>
                      </Box>
                      
                      <Collapse in={isSectionOpen} timeout="auto" unmountOnExit>
                        {section.key === 'education' ? (
                          <EducationSectionBox populatedItems={populatedItems} />
                        ) : (
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.5 }}>
                            {populatedItems.map((itemConf) => (
                              <AttributeSectionBox 
                                key={itemConf.label}
                                itemConf={itemConf}
                                sectionKey={section.key}
                                activeProfile={activeProfile}
                                handleOpenAddSkills={handleOpenAddSkills}
                                precomputedScores={precomputedScores}
                                candidateSkills={candidateSkills}
                              />
                            ))}
                          </Box>
                        )}
                      </Collapse>
                    </Box>
                  );
                })}

                {availabilityItems.length > 0 && (
                  <Box sx={{ textAlign: 'left' }}>
                    <Box onClick={() => toggleSection('availability')} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: openSections.availability ? 2 : 0, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', userSelect: 'none', '&:hover': { opacity: 0.85 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarClock size={20} /></Box>
                        <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>Availability & Work Schedule</Typography>
                      </Box>
                      <IconButton size="small" sx={{ color: 'text.secondary' }}>{openSections.availability ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</IconButton>
                    </Box>
                    <Collapse in={openSections.availability} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2.5, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <Box sx={{ width: '100%', textAlign: 'left' }}>{availabilityItems.map((item, i) => <AttributeItem key={i} itemStr={item} />)}</Box>
                      </Box>
                    </Collapse>
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />

                {hasValidText(fullDescriptionText) && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                    <Button variant="text" onClick={() => setIsDescExpanded(!isDescExpanded)} endIcon={isDescExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />} sx={{ textTransform: 'none', fontWeight: 600, color: 'primary.main', px: 0, justifyContent: 'flex-start', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}>
                      {isDescExpanded ? 'Hide Full Description' : 'Read Full Description'}
                    </Button>
                    <Collapse in={isDescExpanded} timeout="auto" unmountOnExit sx={{ width: '100%' }}>
                      <Box sx={{ mt: 2, p: 3, bgcolor: '#ffffff', borderRadius: 2, border: '1px solid', borderColor: '#e2e8f0', borderLeft: '4px solid', borderLeftColor: 'primary.main', textAlign: 'left' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7, textAlign: 'left' }}>{fullDescriptionText}</Typography>
                      </Box>
                    </Collapse>
                  </Box>
                )}
              </Stack>
            </Collapse>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={isAddSkillsModalOpen} onClose={() => setIsAddSkillsModalOpen(false)} maxWidth="md" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Code size={20} color="#2563eb" />
            Add Missing Skills
          </Box>
          {extractedSkills.length > 0 && (
            <Button size="small" variant="text" onClick={handleToggleSelectAll} sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
              {extractedSkills.every(s => s.checked) ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Select the skills you want to add. You can click any text field to edit the skill before saving.
          </Typography>
          <Stack spacing={1.5}>
            {extractedSkills.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                <Typography variant="body2" color="text.secondary">No missing skills found. You already have them all!</Typography>
              </Paper>
            ) : (
              extractedSkills.map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox checked={item.checked} onChange={() => handleSkillToggle(index)} size="small" color="primary" />
                  <TextField fullWidth size="small" value={item.name} onChange={(e) => handleSkillTextChange(index, e.target.value)} sx={{ bgcolor: item.checked ? '#ffffff' : '#f8fafc', opacity: item.checked ? 1 : 0.6 }} />
                </Box>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, px: 3 }}>
          <Button onClick={() => setIsAddSkillsModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmAddSkills} disabled={checkedCount === 0} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 3, boxShadow: 'none' }}>
            {`Add ${checkedCount} Selected Skill${checkedCount === 1 ? '' : 's'}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isReferralModalOpen} onClose={() => setIsReferralModalOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Edit Referral Message</DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Review and adjust the subject and message below before copying them to your clipboard.</Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>Subject Line</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            <TextField fullWidth value={referralSubject} onChange={(e) => setReferralSubject(e.target.value)} variant="outlined" size="small" sx={{ '& .MuiInputBase-root': { fontSize: '0.95rem', bgcolor: '#f8fafc' } }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button variant="outlined" onClick={() => handleCopy(referralSubject, setCopiedSubject)} startIcon={!copiedSubject && <Copy size={16} />} sx={{ textTransform: 'none', fontWeight: 600, minWidth: 100, borderRadius: 1.5 }}>
                {copiedSubject ? 'Copied!' : 'Copy Subject'}
              </Button>
            </Box>
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1e293b' }}>Message Body</Typography>
          <TextField multiline fullWidth minRows={8} maxRows={16} value={referralMessage} onChange={(e) => setReferralMessage(e.target.value)} variant="outlined" sx={{ '& .MuiInputBase-root': { fontSize: '0.9rem', lineHeight: 1.6, bgcolor: '#f8fafc' } }} />
        </DialogContent>
        <DialogActions sx={{ p: 2.5, px: 3, justifyContent: 'flex-start', gap: 1 }}>
          <Button variant="contained" onClick={() => handleCopy(referralMessage, setCopiedMessage)} startIcon={!copiedMessage && <Copy size={16} />} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 3, boxShadow: 'none' }}>
            {copiedMessage ? 'Copied!' : 'Copy Message'}
          </Button>
          <Button onClick={() => setIsReferralModalOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}