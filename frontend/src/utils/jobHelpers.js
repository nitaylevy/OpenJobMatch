export const isValidMetadataString = (str) => {
  if (typeof str !== 'string') return false;
  const clean = str.trim();
  return clean.length > 0 && !clean.toLowerCase().includes('none');
};

export const hasValidText = (str) => {
  return typeof str === 'string' && str.trim().length > 0;
};

export const parseItemString = (rawString) => {
  let text = String(rawString).trim();
  let quote = null;
  const quoteRegex = /\[Quote:\s*"?([^"\]]+)"?\]/i;
  
  const quoteMatch = text.match(quoteRegex);
  if (quoteMatch) {
    quote = quoteMatch[1].trim();
    text = text.replace(quoteMatch[0], '').trim(); 
  }
  
  // Strip the outer brackets from [Skill] -> Skill
  if (text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1).trim();
  }
  
  return { mainText: text, quote };
};

export const getScoreTheme = (score) => {
  if (score >= 80) {
    return { text: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', ring: '#16a34a' };
  }
  if (score >= 50) {
    return { text: '#854d0e', bg: '#fefce8', border: '#fde047', ring: '#facc15' };
  }
  return { text: '#b91c1c', bg: '#fef2f2', border: '#fecaca', ring: '#ef4444' };
};

const MANAGEMENT_TERMS = '("Manager" OR "Lead" OR "Director" OR "VP" OR "Head")';

/**
 * Generates a LinkedIn People search URL for 2nd-degree decision-makers / leads at a company.
 * @param {string} companyName - The target company name.
 * @param {boolean} secondDegreeOnly - Whether to restrict search to 2nd-degree connections.
 * @returns {string} - Full LinkedIn search URL.
 */
export function generateLinkedInLeadsUrl(companyName, secondDegreeOnly = true) {
  if (!companyName || typeof companyName !== 'string') return '';

  const cleanCompany = companyName.trim().replace(/["']/g, '');
  if (!cleanCompany) return '';

  const booleanQuery = `"${cleanCompany}" AND ${MANAGEMENT_TERMS}`;

  const params = new URLSearchParams({
    keywords: booleanQuery,
    origin: 'GLOBAL_SEARCH_HEADER'
  });

  if (secondDegreeOnly) {
    params.set('network', '["S"]');
  }

  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}