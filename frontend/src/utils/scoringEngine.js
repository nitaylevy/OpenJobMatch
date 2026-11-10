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

export function calculateJobMatch(job, profile) {
  if (!job || !profile) {
    return { 
      mandatory: 0, 
      advantages: null, 
      sections: { experience: 0, education: 0, advantages: 0 },
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

  // A. Min Experience Years
  const minExpKey = Object.keys(job).find(k => /^Min Experience Years/i.test(k));
  if (minExpKey && isValidValue(job[minExpKey])) {
    const rawText = Array.isArray(job[minExpKey]) ? job[minExpKey].join(' ') : String(job[minExpKey]);
    const numMatch = rawText.match(/(\d+(\.\d+)?)/);
    const requiredYears = numMatch ? parseFloat(numMatch[1]) : 0;

    expTotal += 35;
    const candidateYears = getCandidateYears(profile);

    if (candidateYears >= requiredYears && requiredYears > 0) {
      expEarned += 35;
      itemStatuses["experience_Min Experience Years"] = { type: 'full', percentage: 100 };
    } else if (requiredYears > 0 && candidateYears > 0) {
      const pct = Math.round((candidateYears / requiredYears) * 100);
      expEarned += Math.round((candidateYears / requiredYears) * 35);
      itemStatuses["experience_Min Experience Years"] = { type: 'partial', percentage: pct };
    } else {
      itemStatuses["experience_Min Experience Years"] = { type: 'none', percentage: 0 };
    }
  }

  // B. Hard Skills (Counting each individual array item as a point out of all items)
  const hardSkillKeys = ["Hard Skills"];
  const jobReqSkills = [];

  hardSkillKeys.forEach((k) => {
    if (isValidValue(job[k])) {
      if (Array.isArray(job[k])) {
        job[k].forEach((item) => {
          if (isValidValue(item)) jobReqSkills.push(cleanItemString(item));
        });
      } else {
        jobReqSkills.push(cleanItemString(job[k]));
      }
    }
  });

  if (jobReqSkills.length > 0) {
    expTotal += 40;
    const candidateSkills = (profile.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
    let matchedSkillsCount = 0;

    jobReqSkills.forEach((skillReq) => {
      const item = skillReq.toLowerCase();
      const isMatched = candidateSkills.some((skill) => {
        const cleanSkill = skill.toLowerCase().trim();
        if (!cleanSkill) return false;
        if (item === cleanSkill) return true;

        const escapedSkill = cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fullSkillRegex = new RegExp(`(^|\\b|\\s)${escapedSkill}(\\b|\\s|$)`, 'i');
        return fullSkillRegex.test(item);
      });

      if (isMatched) matchedSkillsCount++;
    });

    const totalSkills = jobReqSkills.length;
    const matchPercentage = totalSkills > 0 
      ? Math.round((matchedSkillsCount / totalSkills) * 100) 
      : 0;

    expEarned += Math.round((matchPercentage / 100) * 40);

    if (matchPercentage >= 100) {
      itemStatuses["experience_Hard Skills"] = { type: 'full', percentage: 100 };
    } else if (matchPercentage > 0) {
      itemStatuses["experience_Hard Skills"] = { type: 'partial', percentage: matchPercentage };
    } else {
      itemStatuses["experience_Hard Skills"] = { type: 'none', percentage: 0 };
    }
  }

  // C. Soft Skills
  if (isValidValue(job["Soft Skills"])) {
    expTotal += 25;
    const rawText = Array.isArray(job["Soft Skills"]) ? job["Soft Skills"].join(' ') : String(job["Soft Skills"]);
    const cleanSoftText = rawText.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').replace(/[\[\]"']/g, ' ').trim().toLowerCase();
    const candidateSoftSkills = profile.softSkills || {};
    const jobRequestedSkills = KNOWN_SOFT_SKILLS.filter(skill => isSkillInText(skill, cleanSoftText));
    const totalRequired = Math.max(1, jobRequestedSkills.length || (Array.isArray(job["Soft Skills"]) ? job["Soft Skills"].length : 1));
    
    let matchedCount = 0;
    if (jobRequestedSkills.length > 0) {
      matchedCount = jobRequestedSkills.filter(skill => candidateSoftSkills[skill]).length;
    } else {
      const activeCandidateSkills = Object.keys(candidateSoftSkills).filter(k => candidateSoftSkills[k]);
      matchedCount = activeCandidateSkills.filter(skill => isSkillInText(skill, cleanSoftText)).length;
    }

    if (matchedCount >= totalRequired && totalRequired > 0) {
      expEarned += 25;
      itemStatuses["experience_Soft Skills"] = { type: 'full', percentage: 100 };
    } else if (matchedCount > 0) {
      const pct = Math.round((matchedCount / totalRequired) * 100);
      expEarned += Math.round((matchedCount / totalRequired) * 25);
      itemStatuses["experience_Soft Skills"] = { type: 'partial', percentage: Math.min(pct, 90) };
    } else {
      itemStatuses["experience_Soft Skills"] = { type: 'none', percentage: 0 };
    }
  }

  // ==========================================
  // 2. EDUCATION SECTION (Unchanged structurally)
  // ==========================================
  const candidateDegrees = profile.degrees || [];
  const candidateYears = getCandidateYears(profile);
  const rawAccepting = job["Accepting Related Degrees or Experience"];
  const acceptsRelatedOrExp = isValidValue(rawAccepting) && /yes|true|accepting|or equivalent/i.test(String(rawAccepting));
  const qualifiesViaRelatedOrExp = acceptsRelatedOrExp && (candidateDegrees.length > 0 || candidateYears >= 1);

  // A. Degree Types
  const hasReqDegreeType = isValidValue(job["Degree Types"]);
  let degreeTypeMatched = false;
  if (hasReqDegreeType) {
    eduTotal += 50;
    degreeTypeMatched = checkDegreeTypeMatch(job["Degree Types"], candidateDegrees);
    if (degreeTypeMatched || qualifiesViaRelatedOrExp) {
      eduEarned += 50;
      itemStatuses["education_Degree Types"] = { type: 'full', percentage: 100 };
    } else if (candidateDegrees.some(d => Boolean(d.degreeType))) {
      itemStatuses["education_Degree Types"] = { type: 'partial', percentage: 50 };
    } else {
      itemStatuses["education_Degree Types"] = { type: 'none', percentage: 0 };
    }
  }

  // B. Degree Names
  const hasReqDegreeName = isValidValue(job["Degree Names"]);
  let degreeNameMatched = false;
  if (hasReqDegreeName) {
    eduTotal += 40;
    const rawJobNames = Array.isArray(job["Degree Names"]) ? job["Degree Names"].join(' ') : String(job["Degree Names"]);
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

    if (degreeNameMatched || qualifiesViaRelatedOrExp) {
      eduEarned += 40;
      itemStatuses["education_Degree Names"] = { type: 'full', percentage: 100 };
    } else if (candidateDegrees.some(d => Boolean(d.degreeName))) {
      itemStatuses["education_Degree Names"] = { type: 'partial', percentage: 40 };
    } else {
      itemStatuses["education_Degree Names"] = { type: 'none', percentage: 0 };
    }
  }

  // C. University Only
  if (isValidValue(job["University Only"])) {
    const rawUni = String(job["University Only"]).trim().toLowerCase();
    const requiresUniOnly = /yes|true|only/i.test(rawUni);
    if (requiresUniOnly) {
      eduTotal += 10;
      const hasUni = candidateDegrees.some(d => (d.institutionType || '').toLowerCase() === 'university');
      if (hasUni || qualifiesViaRelatedOrExp) {
        eduEarned += 10;
        itemStatuses["education_University Only"] = { type: 'full', percentage: 100 };
      } else {
        itemStatuses["education_University Only"] = { type: 'none', percentage: 0 };
      }
    }
  }

  if ((!hasReqDegreeType || degreeTypeMatched || qualifiesViaRelatedOrExp) &&
      (!hasReqDegreeName || degreeNameMatched || qualifiesViaRelatedOrExp)) {
    if (eduTotal > 0 && eduEarned < eduTotal) {
      eduEarned = eduTotal;
    }
  }

  // ==========================================
  // 3. ADVANTAGES SECTION (Nice-to-Have)
  // ==========================================

  // A. Advantage - Degree Types
  if (isValidValue(job["Advantage - Degree Types"])) {
    bonusTotal += 35;
    const isAdvDegMatched = checkDegreeTypeMatch(job["Advantage - Degree Types"], candidateDegrees);
    if (isAdvDegMatched) {
      bonusEarned += 35;
      itemStatuses["advantages_Degree Types"] = { type: 'full', percentage: 100 };
    } else {
      itemStatuses["advantages_Degree Types"] = { type: 'none', percentage: 0 };
    }
  }

  // B. Advantage - Hard Skills
  const advHardSkillKeys = ["Advantage - Hard Skills"];
  const advJobReqSkills = [];

  advHardSkillKeys.forEach((k) => {
    if (isValidValue(job[k])) {
      if (Array.isArray(job[k])) {
        job[k].forEach((item) => {
          if (isValidValue(item)) advJobReqSkills.push(cleanItemString(item));
        });
      } else {
        advJobReqSkills.push(cleanItemString(job[k]));
      }
    }
  });

  if (advJobReqSkills.length > 0) {
    bonusTotal += 45;
    const candidateSkills = (profile.skills || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
    let matchedAdvSkillsCount = 0;

    advJobReqSkills.forEach((skillReq) => {
      const item = skillReq.toLowerCase();
      const isMatched = candidateSkills.some((skill) => {
        const cleanSkill = skill.toLowerCase().trim();
        if (!cleanSkill) return false;
        if (item === cleanSkill) return true;

        const escapedSkill = cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fullSkillRegex = new RegExp(`(^|\\b|\\s)${escapedSkill}(\\b|\\s|$)`, 'i');
        return fullSkillRegex.test(item);
      });

      if (isMatched) matchedAdvSkillsCount++;
    });

    const totalAdvSkills = advJobReqSkills.length;
    const advPercentage = totalAdvSkills > 0 
      ? Math.round((matchedAdvSkillsCount / totalAdvSkills) * 100) 
      : 0;

    bonusEarned += Math.round((advPercentage / 100) * 45);

    if (advPercentage >= 100) {
      itemStatuses["advantages_Advantage - Hard Skills"] = { type: 'full', percentage: 100 };
    } else if (advPercentage > 0) {
      itemStatuses["advantages_Advantage - Hard Skills"] = { type: 'partial', percentage: advPercentage };
    } else {
      itemStatuses["advantages_Advantage - Hard Skills"] = { type: 'none', percentage: 0 };
    }
  }

  // C. Advantage - Soft Skills
  if (isValidValue(job["Advantage - Soft Skills"])) {
    bonusTotal += 20;
    const rawAdvSoft = Array.isArray(job["Advantage - Soft Skills"]) ? job["Advantage - Soft Skills"].join(' ') : String(job["Advantage - Soft Skills"]);
    const cleanAdvSoft = rawAdvSoft.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').replace(/[\[\]"']/g, ' ').trim().toLowerCase();
    const candidateSoftSkills = profile.softSkills || {};
    const jobRequestedAdvSkills = KNOWN_SOFT_SKILLS.filter(skill => isSkillInText(skill, cleanAdvSoft));
    const totalAdvRequired = Math.max(1, jobRequestedAdvSkills.length || (Array.isArray(job["Advantage - Soft Skills"]) ? job["Advantage - Soft Skills"].length : 1));
    
    let matchedAdvCount = 0;
    if (jobRequestedAdvSkills.length > 0) {
      matchedAdvCount = jobRequestedAdvSkills.filter(skill => candidateSoftSkills[skill]).length;
    } else {
      const activeCandidateSkills = Object.keys(candidateSoftSkills).filter(k => candidateSoftSkills[k]);
      matchedAdvCount = activeCandidateSkills.filter(skill => isSkillInText(skill, cleanAdvSoft)).length;
    }

    if (matchedAdvCount >= totalAdvRequired && totalAdvRequired > 0) {
      bonusEarned += 20;
      itemStatuses["advantages_Soft Skills"] = { type: 'full', percentage: 100 };
    } else if (matchedAdvCount > 0) {
      const pct = Math.round((matchedAdvCount / totalAdvRequired) * 100);
      bonusEarned += Math.round((matchedAdvCount / totalAdvRequired) * 20);
      itemStatuses["advantages_Soft Skills"] = { type: 'partial', percentage: Math.min(pct, 90) };
    } else {
      itemStatuses["advantages_Soft Skills"] = { type: 'none', percentage: 0 };
    }
  }

  const experienceScore = expTotal > 0 ? Math.round((expEarned / expTotal) * 100) : 100;
  const educationScore = eduTotal > 0 ? Math.round((eduEarned / eduTotal) * 100) : 100;
  const advantagesScore = bonusTotal > 0 ? Math.round((bonusEarned / bonusTotal) * 100) : null;
  const mandatoryTotal = expTotal + eduTotal;
  const mandatoryEarned = expEarned + eduEarned;
  const overallMandatory = mandatoryTotal > 0 ? Math.round((mandatoryEarned / mandatoryTotal) * 100) : 100;

  return {
    mandatory: overallMandatory,
    advantages: advantagesScore,
    sections: {
      experience: experienceScore,
      education: educationScore,
      advantages: advantagesScore ?? 0,
    },
    itemStatuses,
  };
}