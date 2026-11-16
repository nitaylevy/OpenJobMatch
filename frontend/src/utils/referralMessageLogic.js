// src/utils/referralMessageLogic.js

// 1. Helper function to clean the bracketed metadata
function cleanItemString(str) {
  let text = String(str).trim();
  text = text.replace(/\[Quote:\s*"?([^"\]]+)"?\]/gi, '').trim();

  // Strip the outer brackets from [Skill] -> Skill
  if (text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1).trim();
  }

  return text.replace(/["']/g, '').trim();
}

// 2. Helper function to format the list with "and"
function formatList(items) {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// 3. Helper to check if the job actually requires education
function checkJobRequiresEducation(job) {
  const eduKeys = [
    "degree_types", "Degree Types", 
    "degree_names", "Degree Names", 
    "university_only", "University Only", 
    "advantage_degree_types", "Advantage - Degree Types", 
    "advantage_degree_names", "Advantage - Degree Names"
  ];
  
  return eduKeys.some(key => {
    const val = job[key];
    if (!val) return false;
    const strVal = Array.isArray(val) ? val.join(' ') : String(val);
    return strVal.trim().length > 0 && !strVal.toLowerCase().includes('none');
  });
}

// 4. Helper to check if the job actually requires experience
function checkJobRequiresExperience(job) {
  const minExpKey = Object.keys(job).find(k => /^(Min Experience Years|min_experience_years)/i.test(k));
  if (!minExpKey) return false;
  
  const val = job[minExpKey];
  const strVal = Array.isArray(val) ? val.join(' ') : String(val);
  return strVal.trim().length > 0 && !strVal.toLowerCase().includes('none');
}

// 5. Main export function
export function generateReferralMessage(job, profile) {
  const companyName = job.company || job.company_name || 'your company';
  const jobTitle = job.title || job.job_title || 'open';
  const jobUrl = job.url || '[Insert Link]';
  
  // ==========================================
  // 1. HARD SKILLS
  // ==========================================
  const toolKeys = ["hard_skills", "Hard Skills", "advantage_hard_skills", "Advantage - Hard Skills"];
  const jobReqBullets = [];

  toolKeys.forEach((k) => {
    if (job[k]) {
      const items = Array.isArray(job[k]) ? job[k] : [job[k]];
      items.forEach((item) => {
        if (item && !String(item).toLowerCase().includes('none')) {
          jobReqBullets.push(cleanItemString(item).toLowerCase());
        }
      });
    }
  });

  const candidateSkills = profile?.skills || [];
  const matchedSkills = candidateSkills.filter(skill => {
    const cleanSkill = skill.toLowerCase().trim();
    if (!cleanSkill) return false;
    
    const escapedSkill = cleanSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const skillRegex = new RegExp(`(^|\\b|\\s)${escapedSkill}(\\b|\\s|$)`, 'i');

    return jobReqBullets.some(bullet => skillRegex.test(bullet));
  });

  const uniqueMatchedSkills = [...new Set(matchedSkills)].slice(0, 10);

  // ==========================================
  // 2. EDUCATION
  // ==========================================
  let eduPart = '';
  const hasEduRequirement = checkJobRequiresEducation(job);

  if (hasEduRequirement && profile?.degrees?.length > 0) {
    const highestDegree = profile.degrees[0];
    const degreeString = highestDegree.degreeName 
      ? `${highestDegree.degreeType || 'degree'} in ${highestDegree.degreeName}`
      : highestDegree.degreeType || 'degree';
    eduPart = `I hold a ${degreeString}`;
  }

  // ==========================================
  // 3. EXPERIENCE
  // ==========================================
  let expPart = '';
  const hasExpRequirement = checkJobRequiresExperience(job);

  if (hasExpRequirement && profile?.jobExperiences?.length > 0) {
    const expStrings = profile.jobExperiences
      .filter(exp => exp.title && exp.years)
      .map(exp => {
        const yearsStr = String(exp.years).trim();
        const formattedYears = yearsStr === '1' ? '1 year' : `${yearsStr} years`;
        return `${formattedYears} as a ${exp.title.trim()}`;
      });
    
    if (expStrings.length > 0) {
      expPart = `My background includes ${formatList(expStrings)}.`;
    }
  }

  // ==========================================
  // 4. ASSEMBLY
  // ==========================================
  let firstLine = '';
  
  if (eduPart && uniqueMatchedSkills.length > 0) {
    firstLine = `${eduPart} and have experience with ${formatList(uniqueMatchedSkills)}.`;
  } else if (eduPart) {
    firstLine = `${eduPart}.`;
  } else if (uniqueMatchedSkills.length > 0) {
    firstLine = `I have experience with ${formatList(uniqueMatchedSkills)}.`;
  }

  const bodyLines = [];
  if (firstLine) bodyLines.push(firstLine);
  if (expPart) bodyLines.push(expPart);
  
  const body = bodyLines.join(' ');

  const subject = `Regarding the ${jobTitle} role at ${companyName}`;
  const message = `Hi [NAME],

I saw the ${jobTitle} opening at ${companyName} and believe my experience aligns well with the role.
${body ? '\n' + body + '\n' : ''}
Here's the job link: ${jobUrl}

I've attached my resume for reference and would be grateful if you could refer me.

Thank you for your time and consideration!`;

  return { subject, message };
}