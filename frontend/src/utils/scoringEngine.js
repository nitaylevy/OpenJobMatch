export function normalizeDegreeType(degStr) {
  if (!degStr || typeof degStr !== 'string') return '';

  let clean = degStr.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '');
  clean = clean
    .replace(/^.*?:\s*/, '')
    .replace(/[\[\]"']/g, ' ')
    .trim()
    .toLowerCase();

  if (!clean || clean.includes('none')) return '';

  if (/\b(b\.|bachelor|ba\b|bsc\b|btech\b|beng\b|be\b)/i.test(clean)) return 'bachelor';
  if (/\b(m\.|master|ma\b|msc\b|mba\b|mtech\b|meng\b|me\b)/i.test(clean)) return 'master';
  if (/\b(ph\.?d|doctor|doctorate)/i.test(clean)) return 'phd';
  if (/\b(assoc|associate)/i.test(clean)) return 'associate';

  return clean.replace(/[^a-z0-9]/g, '');
}

export function checkDegreeTypeMatch(jobDegreeTypes, candidateDegrees = []) {
  if (!jobDegreeTypes) return true;

  const candidateTiers = new Set();
  candidateDegrees.forEach((deg) => {
    const type = deg.degreeType || deg.type || deg.degree_type || '';
    const norm = normalizeDegreeType(type);
    if (norm) candidateTiers.add(norm);
  });

  if (candidateTiers.size === 0) return false;

  let rawRequiredList = [];
  if (Array.isArray(jobDegreeTypes)) {
    rawRequiredList = jobDegreeTypes.flatMap((d) => String(d).split(/[,/]/));
  } else {
    rawRequiredList = String(jobDegreeTypes).split(/[,/]/);
  }

  for (const rawReq of rawRequiredList) {
    const normReq = normalizeDegreeType(rawReq);
    if (!normReq) continue;

    if (candidateTiers.has(normReq)) return true;
    if (normReq === 'bachelor' && (candidateTiers.has('master') || candidateTiers.has('phd'))) return true;
    if (normReq === 'master' && candidateTiers.has('phd')) return true;
  }

  return false;
}

function isValidValue(val) {
  if (!val) return false;
  if (typeof val === 'string' && val.toLowerCase().includes('none')) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}

/**
 * Normalizes metadata brackets [Skill [Quote: "..."]] -> "Skill"
 */
function cleanItemString(str) {
  let text = String(str).trim();
  text = text.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').trim();

  if (text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1).trim();
  }

  return text.replace(/["']/g, '').trim();
}

function getCandidateYears(profile) {
  if (Array.isArray(profile.jobExperiences)) {
    return profile.jobExperiences.reduce((sum, exp) => {
      const y = parseFloat(String(exp.years).replace('+', '')) || 0;
      return sum + y;
    }, 0);
  }
  if (Array.isArray(profile.experienceRange)) {
    return profile.experienceRange[1] || 0;
  }
  return 0;
}

const KNOWN_SOFT_SKILLS = [
  'Teamwork', 'Collaboration', 'Communication & Presentation',
  'Conflict Resolution', 'Mentorship & Leadership', 'Adaptability & Resilience',
  'Working Independently', 'Self-Motivation & Proactiveness',
  'Time Management', 'Curiosity & Learning Agility'
];

const isSkillInText = (skill, text) => {
  const s = skill.toLowerCase();
  if (text.includes(s)) return true;
  if (s.includes('&')) {
    const parts = s.split('&').map(p => p.trim());
    return parts.some(p => p.length > 3 && text.includes(p));
  }
  return false;
};

// Helper to check multiple possible keys for a value in the job object
const getJobValue = (job, keys) => {
  for (const k of keys) {
    if (job[k] !== undefined && isValidValue(job[k])) {
      return job[k];
    }
  }
  return null;
};

export function calculateJobMatch(job, profile) {
  if (!job || !profile) {
    return { 
      mandatory: 0, 
      advantages: null, 
      sections: { 
        experience: { score: 0, globalEarnedPct: 0, globalMaxPct: 0 }, 
        education: { score: 0, globalEarnedPct: 0, globalMaxPct: 0 }, 
        advantages: { score: 0, globalEarnedPct: 0, globalMaxPct: 0 } 
      },
      itemStatuses: {} 
    };
  }

  const itemStatuses = {};
  let expEarned = 0, expTotal = 0;
  let eduEarned = 0, eduTotal = 0;
  let bonusEarned = 0, bonusTotal = 0;

  // ==========================================
  // 1. EXPERIENCE & SKILLS SECTION
  // ==========================================
  let expItems = [];

  // A. Min Experience Years
  const minExpKey = Object.keys(job).find(k => /^(Min Experience Years|min_experience_years)/i.test(k));
  if (minExpKey && isValidValue(job[minExpKey])) {
    const rawText = Array.isArray(job[minExpKey]) ? job[minExpKey].join(' ') : String(job[minExpKey]);
    const numMatch = rawText.match(/(\d+(\.\d+)?)/);
    const requiredYears = numMatch ? parseFloat(numMatch[1]) : 0;
    const candidateYears = getCandidateYears(profile);

    let frac = 0, pct = 0;
    if (candidateYears >= requiredYears && requiredYears > 0) {
      frac = 1; pct = 100;
    } else if (requiredYears > 0 && candidateYears > 0) {
      frac = candidateYears / requiredYears; 
      pct = Math.round(frac * 100);
    }
    expItems.push({ key: "experience_Min Experience Years", baseW: 40, frac, pct });
  }

  // B. Hard Skills
  const hardSkillKeys = ["hard_skills", "Hard Skills"];
  const jobReqSkills = [];
  hardSkillKeys.forEach((k) => {
    if (isValidValue(job[k])) {
      (Array.isArray(job[k]) ? job[k] : [job[k]]).forEach((item) => {
        if (isValidValue(item)) jobReqSkills.push(cleanItemString(item));
      });
    }
  });

  if (jobReqSkills.length > 0) {
    const candidateSkills = (profile.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
    let matchedSkillsCount = 0;

    jobReqSkills.forEach((skillReq) => {
      const item = skillReq.toLowerCase();
      const isMatched = candidateSkills.some((skill) => {
        const cleanSkill = skill.toLowerCase().trim();
        if (!cleanSkill) return false;
        if (item === cleanSkill) return true;
        const escapedSkill = cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\b|\\s)${escapedSkill}(\\b|\\s|$)`, 'i').test(item);
      });
      if (isMatched) matchedSkillsCount++;
    });

    const totalSkills = jobReqSkills.length;
    let frac = totalSkills > 0 ? (matchedSkillsCount / totalSkills) : 0;
    expItems.push({ key: "experience_Hard Skills", baseW: 50, frac, pct: Math.round(frac * 100) });
  }

  // C. Soft Skills
  const jobSoftSkills = getJobValue(job, ["soft_skills", "Soft Skills"]);
  let hasExpSoft = false;
  let expSoftFrac = 0, expSoftPct = 0;

  if (jobSoftSkills) {
    hasExpSoft = true;
    const rawText = Array.isArray(jobSoftSkills) ? jobSoftSkills.join(' ') : String(jobSoftSkills);
    const cleanSoftText = rawText.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').replace(/[\[\]"']/g, ' ').trim().toLowerCase();
    const candidateSoftSkills = profile.softSkills || {};
    const jobRequestedSkills = KNOWN_SOFT_SKILLS.filter(skill => isSkillInText(skill, cleanSoftText));
    const totalRequired = Math.max(1, jobRequestedSkills.length || (Array.isArray(jobSoftSkills) ? jobSoftSkills.length : 1));
    
    let matchedCount = 0;
    if (jobRequestedSkills.length > 0) {
      matchedCount = jobRequestedSkills.filter(skill => candidateSoftSkills[skill]).length;
    } else {
      const activeCandidateSkills = Object.keys(candidateSoftSkills).filter(k => candidateSoftSkills[k]);
      matchedCount = activeCandidateSkills.filter(skill => isSkillInText(skill, cleanSoftText)).length;
    }

    if (matchedCount >= totalRequired && totalRequired > 0) {
      expSoftFrac = 1; expSoftPct = 100;
    } else if (matchedCount > 0) {
      expSoftFrac = matchedCount / totalRequired; 
      expSoftPct = Math.round(expSoftFrac * 100);
    }
  }

  // Soft Skills are exactly 10% of the section (W_soft = W_others / 9)
  let expOtherTotal = expItems.reduce((sum, item) => sum + item.baseW, 0);
  if (hasExpSoft) {
    let softW = expOtherTotal > 0 ? (expOtherTotal / 9) : 100;
    expItems.push({ 
      key: "experience_Soft Skills", 
      baseW: softW, 
      frac: expSoftFrac, 
      pct: expSoftFrac >= 1 ? 100 : Math.min(expSoftPct, 90) 
    });
  }

  expItems.forEach(item => {
    expTotal += item.baseW;
    let earned = item.frac * item.baseW;
    expEarned += earned;
    let type = item.frac >= 1 ? 'full' : item.frac > 0 ? 'partial' : 'none';
    itemStatuses[item.key] = { type, percentage: item.pct, earnedWeight: earned, maxWeight: item.baseW };
  });

  // ==========================================
  // 2. EDUCATION SECTION
  // ==========================================
  let eduItems = [];
  const candidateDegrees = profile.degrees || [];
  const candidateYears = getCandidateYears(profile);
  
  const rawAccepting = getJobValue(job, ["accepting_related_degrees_or_experience", "Accepting Related Degrees or Experience"]);
  const acceptsRelatedOrExp = isValidValue(rawAccepting) && /yes|true|accepting|or equivalent/i.test(String(rawAccepting));
  const qualifiesViaRelatedOrExp = acceptsRelatedOrExp && (candidateDegrees.length > 0 || candidateYears >= 1);

  // A. Degree Types
  const jobDegreeTypes = getJobValue(job, ["degree_types", "Degree Types"]);
  let hasReqDegreeType = Boolean(jobDegreeTypes);
  let degreeTypeMatched = false;
  if (hasReqDegreeType) {
    degreeTypeMatched = checkDegreeTypeMatch(jobDegreeTypes, candidateDegrees);
    let frac = 0, pct = 0;
    if (degreeTypeMatched || qualifiesViaRelatedOrExp) { frac = 1; pct = 100; }
    else if (candidateDegrees.some(d => Boolean(d.degreeType))) { frac = 0.5; pct = 50; }
    eduItems.push({ key: "education_Degree Types", baseW: 50, frac, pct });
  }

  // B. Degree Names
  const jobDegreeNames = getJobValue(job, ["degree_names", "Degree Names"]);
  let hasReqDegreeName = Boolean(jobDegreeNames);
  let degreeNameMatched = false;
  if (hasReqDegreeName) {
    const rawJobNames = Array.isArray(jobDegreeNames) ? jobDegreeNames.join(' ') : String(jobDegreeNames);
    const cleanJobNames = rawJobNames.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').replace(/[\[\]"']/g, ' ').trim().toLowerCase();

    degreeNameMatched = candidateDegrees.some((d) => {
      const candName = (d.degreeName || '').toLowerCase().trim();
      if (!candName) return false;
      if (cleanJobNames.includes(candName) || candName.includes(cleanJobNames)) return true;
      const isCsJob = /\b(computer science|software engineering|cs)\b/i.test(cleanJobNames);
      const isCsCandidate = /\b(computer science|software engineering|cs)\b/i.test(candName);
      if (isCsJob && isCsCandidate) return true;
      const candidateTokens = candName.split(/\s+/).filter(t => t.length > 3);
      return candidateTokens.some(token => cleanJobNames.includes(token));
    });

    let frac = 0, pct = 0;
    if (degreeNameMatched || qualifiesViaRelatedOrExp) { frac = 1; pct = 100; }
    else if (candidateDegrees.some(d => Boolean(d.degreeName))) { frac = 0.4; pct = 40; }
    eduItems.push({ key: "education_Degree Names", baseW: 40, frac, pct });
  }

  // C. University Only
  const jobUniOnly = getJobValue(job, ["university_only", "University Only"]);
  if (jobUniOnly && /yes|true|only/i.test(String(jobUniOnly).trim().toLowerCase())) {
    const hasUni = candidateDegrees.some(d => (d.institutionType || '').toLowerCase() === 'university');
    let frac = (hasUni || qualifiesViaRelatedOrExp) ? 1 : 0;
    eduItems.push({ key: "education_University Only", baseW: 10, frac, pct: frac * 100 });
  }

  eduItems.forEach(item => {
    eduTotal += item.baseW;
    let earned = item.frac * item.baseW;
    eduEarned += earned;
    let type = item.frac >= 1 ? 'full' : item.frac > 0 ? 'partial' : 'none';
    itemStatuses[item.key] = { type, percentage: item.pct, earnedWeight: earned, maxWeight: item.baseW };
  });

  // Override entire section if Qualifies via Equivalent Experience
  if ((!hasReqDegreeType || degreeTypeMatched || qualifiesViaRelatedOrExp) &&
      (!hasReqDegreeName || degreeNameMatched || qualifiesViaRelatedOrExp)) {
    if (eduTotal > 0 && eduEarned < eduTotal) {
      eduEarned = eduTotal;
      eduItems.forEach(item => {
        itemStatuses[item.key].earnedWeight = item.baseW;
        itemStatuses[item.key].percentage = 100;
        itemStatuses[item.key].type = 'full';
      });
    }
  }

  // ==========================================
  // 3. ADVANTAGES SECTION (Nice-to-Have)
  // ==========================================
  let advItems = [];

  // A. Advantage - Degree Types
  const advDegreeTypes = getJobValue(job, ["advantage_degree_types", "Advantage - Degree Types"]);
  if (advDegreeTypes) {
    const isAdvDegMatched = checkDegreeTypeMatch(advDegreeTypes, candidateDegrees);
    let frac = isAdvDegMatched ? 1 : 0;
    advItems.push({ key: "advantages_Degree Types", baseW: 40, frac, pct: frac * 100 });
  }

  // B. Advantage - Hard Skills
  const advHardSkillKeys = ["advantage_hard_skills", "Advantage - Hard Skills"];
  const advJobReqSkills = [];
  advHardSkillKeys.forEach((k) => {
    if (isValidValue(job[k])) {
      (Array.isArray(job[k]) ? job[k] : [job[k]]).forEach((item) => {
        if (isValidValue(item)) advJobReqSkills.push(cleanItemString(item));
      });
    }
  });

  if (advJobReqSkills.length > 0) {
    const candidateSkills = (profile.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
    let matchedAdvSkillsCount = 0;

    advJobReqSkills.forEach((skillReq) => {
      const item = skillReq.toLowerCase();
      const isMatched = candidateSkills.some((skill) => {
        const cleanSkill = skill.toLowerCase().trim();
        if (!cleanSkill) return false;
        if (item === cleanSkill) return true;
        const escapedSkill = cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\b|\\s)${escapedSkill}(\\b|\\s|$)`, 'i').test(item);
      });
      if (isMatched) matchedAdvSkillsCount++;
    });

    const totalAdvSkills = advJobReqSkills.length;
    let frac = totalAdvSkills > 0 ? (matchedAdvSkillsCount / totalAdvSkills) : 0;
    advItems.push({ key: "advantages_Hard Skills", baseW: 50, frac, pct: Math.round(frac * 100) });
  }

  // C. Advantage - Soft Skills
  const advSoftSkills = getJobValue(job, ["advantage_soft_skills", "Advantage - Soft Skills"]);
  let hasAdvSoft = false;
  let advSoftFrac = 0, advSoftPct = 0;

  if (advSoftSkills) {
    hasAdvSoft = true;
    const rawAdvSoft = Array.isArray(advSoftSkills) ? advSoftSkills.join(' ') : String(advSoftSkills);
    const cleanAdvSoft = rawAdvSoft.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').replace(/[\[\]"']/g, ' ').trim().toLowerCase();
    const candidateSoftSkills = profile.softSkills || {};
    const jobRequestedAdvSkills = KNOWN_SOFT_SKILLS.filter(skill => isSkillInText(skill, cleanAdvSoft));
    const totalAdvRequired = Math.max(1, jobRequestedAdvSkills.length || (Array.isArray(advSoftSkills) ? advSoftSkills.length : 1));
    
    let matchedAdvCount = 0;
    if (jobRequestedAdvSkills.length > 0) {
      matchedAdvCount = jobRequestedAdvSkills.filter(skill => candidateSoftSkills[skill]).length;
    } else {
      const activeCandidateSkills = Object.keys(candidateSoftSkills).filter(k => candidateSoftSkills[k]);
      matchedAdvCount = activeCandidateSkills.filter(skill => isSkillInText(skill, cleanAdvSoft)).length;
    }

    if (matchedAdvCount >= totalAdvRequired && totalAdvRequired > 0) {
      advSoftFrac = 1; advSoftPct = 100;
    } else if (matchedAdvCount > 0) {
      advSoftFrac = matchedAdvCount / totalAdvRequired; 
      advSoftPct = Math.round(advSoftFrac * 100);
    }
  }

  // Soft Skills are exactly 10% of the section (W_soft = W_others / 9)
  let advOtherTotal = advItems.reduce((sum, item) => sum + item.baseW, 0);
  if (hasAdvSoft) {
    let softW = advOtherTotal > 0 ? (advOtherTotal / 9) : 100;
    advItems.push({ 
      key: "advantages_Soft Skills", 
      baseW: softW, 
      frac: advSoftFrac, 
      pct: advSoftFrac >= 1 ? 100 : Math.min(advSoftPct, 90) 
    });
  }

  advItems.forEach(item => {
    bonusTotal += item.baseW;
    let earned = item.frac * item.baseW;
    bonusEarned += earned;
    let type = item.frac >= 1 ? 'full' : item.frac > 0 ? 'partial' : 'none';
    itemStatuses[item.key] = { type, percentage: item.pct, earnedWeight: earned, maxWeight: item.baseW };
  });

  // ==========================================
  // FINAL CALCULATIONS
  // ==========================================
  let overallMandatory = 100;
  let expOverallWeight = 0;
  let eduOverallWeight = 0;

  // Enforce 50/50 split if both sections exist
  if (expTotal > 0 && eduTotal > 0) {
    const expRatio = expEarned / expTotal;
    const eduRatio = eduEarned / eduTotal;
    overallMandatory = Math.round(((expRatio + eduRatio) / 2) * 100);
    expOverallWeight = 50;
    eduOverallWeight = 50;
  } else if (expTotal > 0) {
    overallMandatory = Math.round((expEarned / expTotal) * 100);
    expOverallWeight = 100;
    eduOverallWeight = 0;
  } else if (eduTotal > 0) {
    overallMandatory = Math.round((eduEarned / eduTotal) * 100);
    expOverallWeight = 0;
    eduOverallWeight = 100;
  }
  
  // Calculate global equivalent percentages for sub-sections based on their parent's fixed weight
  Object.keys(itemStatuses).forEach(key => {
    const item = itemStatuses[key];
    if (item.maxWeight === undefined) return;

    if (key.startsWith("advantages_")) {
      if (bonusTotal > 0) {
        item.globalEarnedPct = Math.round((item.earnedWeight / bonusTotal) * 100);
        item.globalMaxPct = Math.round((item.maxWeight / bonusTotal) * 100);
      }
    } else if (key.startsWith("experience_")) {
      if (expTotal > 0) {
        item.globalEarnedPct = Math.round((item.earnedWeight / expTotal) * expOverallWeight);
        item.globalMaxPct = Math.round((item.maxWeight / expTotal) * expOverallWeight);
      }
    } else if (key.startsWith("education_")) {
      if (eduTotal > 0) {
        item.globalEarnedPct = Math.round((item.earnedWeight / eduTotal) * eduOverallWeight);
        item.globalMaxPct = Math.round((item.maxWeight / eduTotal) * eduOverallWeight);
      }
    }
  });

  const experienceScore = expTotal > 0 ? Math.round((expEarned / expTotal) * 100) : 100;
  const educationScore = eduTotal > 0 ? Math.round((eduEarned / eduTotal) * 100) : 100;
  const advantagesScore = bonusTotal > 0 ? Math.round((bonusEarned / bonusTotal) * 100) : null;

  return {
    mandatory: overallMandatory,
    advantages: advantagesScore,
    sections: {
      experience: { 
        score: experienceScore, 
        globalEarnedPct: expTotal > 0 ? Math.round((expEarned / expTotal) * expOverallWeight) : 0, 
        globalMaxPct: expOverallWeight 
      },
      education: { 
        score: educationScore, 
        globalEarnedPct: eduTotal > 0 ? Math.round((eduEarned / eduTotal) * eduOverallWeight) : 0, 
        globalMaxPct: eduOverallWeight 
      },
      advantages: { 
        score: advantagesScore ?? 0, 
        globalEarnedPct: advantagesScore ?? 0, 
        globalMaxPct: bonusTotal > 0 ? 100 : 0 
      },
    },
    itemStatuses,
  };
}