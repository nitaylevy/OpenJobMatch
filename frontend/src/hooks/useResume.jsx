import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker using Vite's modern URL resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const LAMBDA_URL = import.meta.env.CV_SCAN_LAMBDA_URL || "https://your-api-id.execute-api.region.amazonaws.com/prod/analyze";
const SAVED_SEARCHES_STORAGE_KEY = 'resume_analyzer_saved_searches';

const DEFAULT_SOFT_SKILLS = Object.freeze({
  'Teamwork': true,
  'Collaboration': true,
  'Communication & Presentation': true,
  'Language Proficiency': true,
  'Conflict Resolution': true,
  'Mentorship & Leadership': true,
  'Adaptability & Resilience': true,
  'Working Independently': true,
  'Self-Motivation & Proactiveness': true,
  'Time Management': true,
  'Curiosity & Learning Agility': true,
  'Problem-solving': true,
});

export const useResume = () => {
  // --- Form State ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resumeData, setResumeData] = useState(null); 
  
  const [experienceRange, setExperienceRange] = useState([0, 10]);
  const [studentJobsFilter, setStudentJobsFilter] = useState('include');
  const [seniorityJobs, setSeniorityJobs] = useState([]);
  const [employmentType, setEmploymentType] = useState([]);
  
  const fileInputRef = useRef(null);

  const [jobTitles, setJobTitles] = useState([]);
  const [jobTitleInput, setJobTitleInput] = useState('');

  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');

  // --- Soft Skills State (Default all to true, unaffected by Lambda) ---
  const [softSkills, setSoftSkills] = useState({ ...DEFAULT_SOFT_SKILLS });

  // Empty by default at start
  const [jobExperiences, setJobExperiences] = useState([]);
  const [degrees, setDegrees] = useState([]);

  // --- Saved Searches Management (Persistent in localStorage) ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState(() => {
    try {
      const stored = localStorage.getItem(SAVED_SEARCHES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to parse saved searches from localStorage:', err);
      return [];
    }
  });

  const [activeSearchId, setActiveSearchId] = useState(null);

  // --- Save, Rename & Update Dialog State ---
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [dialogMode, setDialogMode] = useState('save'); // 'save' | 'rename' | 'update'
  const [targetSearchId, setTargetSearchId] = useState(null);

  // Sync saved searches to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_SEARCHES_STORAGE_KEY, JSON.stringify(savedSearches));
    } catch (err) {
      console.error('Failed to save searches to localStorage:', err);
    }
  }, [savedSearches]);

  // --- PDF to PNG Converter Helper ---
  const convertPdfToPng = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); 
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    const renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
        const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.png';
        resolve(new File([blob], newFileName, { type: 'image/png' }));
      }, 'image/png');
    });
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // --- Send Base64 Image to Lambda ---
  const sendImageToLambda = async (imageFile) => {
    const base64Image = await fileToBase64(imageFile);

    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images_base64: [base64Image],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lambda request failed with status: ${response.status} - ${errText}`);
    }

    return await response.json();
  };

  // --- JSON TO STATE MAPPING HELPER ---
  const applyResumeDataToState = (data) => {
    if (!data) return;

    if (data.job_title) {
      setJobTitles([data.job_title]);
    }

    const foundSeniority = new Set();
    const checkSeniority = (text) => {
      if (!text) return;
      const lower = text.toLowerCase();
      if (lower.includes('senior')) foundSeniority.add('Senior');
      if (lower.includes('lead')) foundSeniority.add('Lead');
      if (lower.includes('staff')) foundSeniority.add('Staff');
    };
    checkSeniority(data.job_title);

    let minRange = 0;
    let maxRange = 2;

    if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) {
      const allYears = data.experience
        .map(exp => parseFloat(exp.years))
        .filter(y => !isNaN(y) && y >= 1);

      if (allYears.length > 0) {
        minRange = Math.min(...allYears);
        maxRange = 10;
      }

      data.experience.forEach(exp => checkSeniority(exp.role));
      
      const validExps = data.experience
        .filter(exp => (parseFloat(exp.years) || 0) >= 1)
        .map((exp, i) => {
          const y = parseFloat(exp.years);
          const formattedYears = y >= 6 ? '6+' : String(Math.floor(y));
          return {
            id: Date.now() + i,
            title: exp.role || '',
            years: formattedYears
          };
        });
      
      setJobExperiences(validExps);
    } else {
      setJobExperiences([]);
    }

    setExperienceRange([Math.floor(minRange), maxRange]);
    
    if (maxRange >= 3) {
      setSeniorityJobs(Array.from(foundSeniority));
    } else {
      setSeniorityJobs([]);
    }

    if (data.skills && Array.isArray(data.skills)) {
      setSkills(data.skills);
    }

    if (data.education && Array.isArray(data.education) && data.education.length > 0) {
      const validInstTypes = ['University', 'College'];
      const validDegTypes = ['B.Sc.', 'B.A.', 'M.Sc.', 'M.A.', 'MBA', 'Ph.D.', 'Associate', 'Other'];
      
      const mappedEdu = data.education.map((edu, i) => {
        const statusStr = edu.degree_status?.toLowerCase() || 'none';
        const isGraduated = statusStr === 'none' || statusStr === 'graduated';
        
        let instType = validInstTypes.find(v => v.toLowerCase() === edu.institution_type?.toLowerCase()) || '';
        let degType = validDegTypes.find(v => v.toLowerCase() === edu.degree_type?.toLowerCase()) || '';

        const formatSemesters = (val) => val >= 5 ? "5+" : String(val);
        const formatYears = (val) => val > 4 ? "4" : String(val);

        return {
          id: Date.now() + i,
          institutionType: instType,
          degreeType: degType,
          degreeName: edu.degree_name || '',
          gpa: edu.gpa ? String(edu.gpa) : '',
          status: isGraduated ? 'graduated' : 'studying',
          currentYear: (!isGraduated && edu.current_study_year) ? formatYears(edu.current_study_year) : '',
          semestersLeft: (!isGraduated && edu.semesters_left) ? formatSemesters(edu.semesters_left) : ''
        };
      });
      setDegrees(mappedEdu);

      const isCurrentlyStudying = mappedEdu.some(edu => edu.status === 'studying');

      if (isCurrentlyStudying) {
        setEmploymentType(['Part Time']);
        setStudentJobsFilter('only');
      } else {
        setEmploymentType(['Full Time']);
        setStudentJobsFilter('none');
      }
    } else {
      setEmploymentType(['Full Time']);
      setStudentJobsFilter('none');
      setDegrees([]);
    }
  };

  // --- File Handler Execution ---
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      alert('Please upload a valid PDF or Image file.');
      return;
    }

    try {
      setIsProcessing(true);
      
      let imageFile = file;
      if (isPdf) {
        imageFile = await convertPdfToPng(file);
      }

      const jsonData = await sendImageToLambda(imageFile);
      
      setResumeData(jsonData); 
      applyResumeDataToState(jsonData); 
      setSelectedFile(file); 
      
    } catch (error) {
      console.error("Processing failed:", error);
      alert("Failed to process the resume. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setResumeData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Search Options Handlers ---
  const handleAddJobTitle = () => {
    const trimmed = jobTitleInput.trim();
    if (trimmed && !jobTitles.includes(trimmed)) {
      setJobTitles((prev) => [...prev, trimmed]);
      setJobTitleInput('');
    }
  };

  const handleDeleteJobTitle = (titleToDelete) => {
    setJobTitles((prev) => prev.filter((t) => t !== titleToDelete));
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setSkillInput('');
    }
  };

  const handleDeleteSkill = (skillToDelete) => {
    setSkills((prev) => prev.filter((s) => s !== skillToDelete));
  };

  const handleToggleSoftSkill = (key) => {
    setSoftSkills((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleAddJobExperience = () => {
    setJobExperiences((prev) => [...prev, { id: Date.now(), title: '', years: '' }]);
  };

  const handleRemoveJobExperience = (id) => {
    setJobExperiences((prev) => prev.filter((exp) => exp.id !== id));
  };

  const handleJobExperienceChange = (id, field, value) => {
    setJobExperiences((prev) =>
      prev.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp))
    );
  };

  const handleAddDegree = () => {
    setDegrees((prev) => [
      ...prev,
      { id: Date.now(), institutionType: '', degreeType: '', degreeName: '', gpa: '', status: 'graduated', currentYear: '', semestersLeft: '' },
    ]);
  };

  const handleRemoveDegree = (id) => {
    setDegrees((prev) => prev.filter((deg) => deg.id !== id));
  };

  const handleDegreeChange = (id, field, value) => {
    setDegrees((prev) =>
      prev.map((deg) => (deg.id === id ? { ...deg, [field]: value } : exp))
    );
  };

  // --- Direct Skill Update Action for Job Posts ---
  const handleUpdateSavedSearchSkills = (searchId, newSkills) => {
    setSavedSearches((prev) =>
      prev.map((search) => {
        if (search.id === searchId) {
          const currentSkills = search.data?.skills || [];
          const lowerExisting = currentSkills.map((s) => s.toLowerCase());
          const uniqueNewSkills = newSkills.filter(
            (s) => !lowerExisting.includes(s.toLowerCase())
          );

          return {
            ...search,
            data: {
              ...search.data,
              skills: [...currentSkills, ...uniqueNewSkills],
            },
          };
        }
        return search;
      })
    );

    // If this preset is loaded right now in the form, sync form state as well
    if (activeSearchId === searchId) {
      setSkills((prev) => {
        const lowerExisting = prev.map((s) => s.toLowerCase());
        const uniqueNew = newSkills.filter(
          (s) => !lowerExisting.includes(s.toLowerCase())
        );
        return [...prev, ...uniqueNew];
      });
    }
  };

  // --- Save, Rename & Update Handlers ---
  const handleOpenSaveDialog = () => {
    setDialogMode('save');
    setTargetSearchId(null);
    const fallbackName = jobTitles[0] 
      ? `${jobTitles[0]} Search` 
      : `Search Preset #${savedSearches.length + 1}`;
    setNewSearchName(fallbackName);
    setSaveDialogOpen(true);
  };

  const handleOpenUpdateDialog = () => {
    if (!activeSearchId) return;
    const currentItem = savedSearches.find(s => s.id === activeSearchId);
    setDialogMode('update');
    setTargetSearchId(activeSearchId);
    setNewSearchName(currentItem ? currentItem.name : '');
    setSaveDialogOpen(true);
  };

  const handleOpenRenameDialog = (item) => {
    setDialogMode('rename');
    setTargetSearchId(item.id);
    setNewSearchName(item.name);
    setSaveDialogOpen(true);
  };

  const handleSaveSearch = () => {
    if (!newSearchName.trim()) return;

    const currentFormData = {
      jobTitles: [...jobTitles],
      experienceRange: [...experienceRange],
      studentJobsFilter,
      seniorityJobs: [...seniorityJobs],
      employmentType: [...employmentType],
      skills: [...skills],
      softSkills: { ...softSkills },
      jobExperiences: JSON.parse(JSON.stringify(jobExperiences)),
      degrees: JSON.parse(JSON.stringify(degrees)),
    };

    if (dialogMode === 'rename') {
      setSavedSearches((prev) =>
        prev.map((item) =>
          item.id === targetSearchId
            ? { ...item, name: newSearchName.trim() }
            : item
        )
      );
    } else if (dialogMode === 'update') {
      setSavedSearches((prev) =>
        prev.map((item) =>
          item.id === targetSearchId
            ? {
                ...item,
                name: newSearchName.trim(),
                data: currentFormData,
              }
            : item
        )
      );
    } else {
      const newSavedItem = {
        id: Date.now().toString(),
        name: newSearchName.trim(),
        savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        data: currentFormData,
      };

      setSavedSearches((prev) => [newSavedItem, ...prev]);
      setActiveSearchId(newSavedItem.id);
    }

    setSaveDialogOpen(false);
    setTargetSearchId(null);
    setNewSearchName('');
    setIsSidebarOpen(true); 
  };

  const handleLoadSearch = (item) => {
    setActiveSearchId(item.id);
    setJobTitles(item.data.jobTitles || []);
    setExperienceRange(item.data.experienceRange || [0, 10]);
    setStudentJobsFilter(item.data.studentJobsFilter || 'include');
    setSeniorityJobs(item.data.seniorityJobs || []);
    setEmploymentType(item.data.employmentType ?? item.data.jobType ?? []);
    setSkills(item.data.skills || []);
    if (item.data.softSkills) setSoftSkills(item.data.softSkills);
    setJobExperiences(
      item.data.jobExperiences?.length
        ? JSON.parse(JSON.stringify(item.data.jobExperiences))
        : []
    );
    setDegrees(
      item.data.degrees?.length
        ? JSON.parse(JSON.stringify(item.data.degrees))
        : []
    );
    if (window.innerWidth < 900) {
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteSavedSearch = (e, id) => {
    e.stopPropagation();
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    if (activeSearchId === id) setActiveSearchId(null);
  };

  const handleResetForm = () => {
    setActiveSearchId(null);
    setJobTitles([]);
    setJobTitleInput('');
    setExperienceRange([0, 10]);
    setStudentJobsFilter('include');
    setSeniorityJobs([]);
    setEmploymentType([]);
    setSkills([]);
    setSkillInput('');
    setSoftSkills({ ...DEFAULT_SOFT_SKILLS });
    setJobExperiences([]);
    setDegrees([]);
    setIsProcessing(false);
    handleRemoveFile();
  };

  return {
    state: {
      selectedFile,
      isProcessing,
      resumeData,
      experienceRange,
      studentJobsFilter,
      seniorityJobs,
      employmentType,
      fileInputRef,
      jobTitles,
      jobTitleInput,
      skills,
      skillInput,
      softSkills,
      jobExperiences,
      degrees,
      isSidebarOpen,
      savedSearches,
      activeSearchId,
      saveDialogOpen,
      newSearchName,
      dialogMode,
      targetSearchId,
    },
    actions: {
      setSelectedFile,
      setIsProcessing,
      setExperienceRange,
      setStudentJobsFilter,
      setSeniorityJobs,
      setEmploymentType,
      setJobTitleInput,
      setSkillInput,
      setIsSidebarOpen,
      setNewSearchName,
      setSaveDialogOpen,
      handleFileChange,
      handleRemoveFile,
      handleAddJobTitle,
      handleDeleteJobTitle,
      handleAddSkill,
      handleDeleteSkill,
      handleToggleSoftSkill,
      handleAddJobExperience,
      handleRemoveJobExperience,
      handleJobExperienceChange,
      handleAddDegree,
      handleRemoveDegree,
      handleDegreeChange,
      handleUpdateSavedSearchSkills,
      handleOpenSaveDialog,
      handleOpenUpdateDialog,
      handleOpenRenameDialog,
      handleSaveSearch,
      handleLoadSearch,
      handleDeleteSavedSearch,
      handleResetForm,
    },
  };
};