import React, { Component, useState, useEffect, useRef } from 'react';
import { 
  User, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  Languages, 
  Award, 
  FileText, 
  Mail, 
  Download, 
  FileDown,
  Plus, 
  Trash2, 
  Save, 
  RotateCcw,
  Layout,
  Type,
  CheckCircle2,
  Loader2,
  LogOut,
  LogIn,
  ChevronDown,
  Eye,
  Palette,
  Maximize2,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { cn } from './lib/utils';
import { Toaster, toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Types ---

interface Experience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

interface Education {
  id: string;
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
}

interface CVData {
  personalInfo: {
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  experience: Experience[];
  education: Education[];
  skills: string[];
  languages: string[];
  certifications: string[];
  template: 'minimal' | 'professional' | 'modern';
  settings: {
    primaryColor: string;
    fontFamily: 'sans' | 'serif' | 'mono';
    fontSize: 'small' | 'medium' | 'large';
    spacing: 'compact' | 'normal' | 'relaxed';
  };
}

interface CoverLetterData {
  recipientName: string;
  companyName: string;
  jobTitle: string;
  body: string;
  tone: 'formal' | 'enthusiastic' | 'concise';
}

interface ApplicationLetterData {
  recipientName: string;
  companyName: string;
  companyAddress: string;
  jobTitle: string;
  jobRef: string;
  subject: string;
  body: string;
  purpose: 'job application' | 'speculative application' | 'follow-up';
}

// --- Constants ---

const INITIAL_CV: CVData = {
  personalInfo: {
    fullName: '',
    jobTitle: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
  },
  experience: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
  template: 'professional',
  settings: {
    primaryColor: '#1c1917', // stone-900
    fontFamily: 'sans',
    fontSize: 'medium',
    spacing: 'normal',
  },
};

const INITIAL_COVER_LETTER: CoverLetterData = {
  recipientName: '',
  companyName: '',
  jobTitle: '',
  body: '',
  tone: 'formal',
};

const INITIAL_APP_LETTER: ApplicationLetterData = {
  recipientName: '',
  companyName: '',
  companyAddress: '',
  jobTitle: '',
  jobRef: '',
  subject: '',
  body: '',
  purpose: 'job application',
};

const SAMPLE_CV: CVData = {
  personalInfo: {
    fullName: 'Alex Johnson',
    jobTitle: 'Senior Software Engineer',
    email: 'alex.j@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    summary: 'Dedicated software engineer with 8+ years of experience building scalable web applications. Expert in React, Node.js, and cloud architecture. Proven track record of leading technical teams and delivering high-impact features.',
  },
  experience: [
    {
      id: '1',
      company: 'TechFlow Solutions',
      position: 'Senior Engineer',
      startDate: '2020-01',
      endDate: 'Present',
      description: 'Led the development of a microservices-based e-commerce platform. Improved system performance by 40% through optimized database queries and caching strategies.',
    },
    {
      id: '2',
      company: 'Innovate Web',
      position: 'Full Stack Developer',
      startDate: '2017-06',
      endDate: '2019-12',
      description: 'Developed and maintained multiple client-facing web applications using React and Express. Collaborated with design teams to implement responsive UI components.',
    }
  ],
  education: [
    {
      id: '1',
      school: 'University of Technology',
      degree: 'B.S. in Computer Science',
      startDate: '2013-09',
      endDate: '2017-05',
    }
  ],
  skills: ['React', 'TypeScript', 'Node.js', 'AWS', 'Docker', 'GraphQL', 'PostgreSQL'],
  languages: ['English (Native)', 'Spanish (Conversational)'],
  certifications: ['AWS Certified Solutions Architect', 'Google Cloud Professional Developer'],
  template: 'modern',
  settings: {
    primaryColor: '#1c1917',
    fontFamily: 'sans',
    fontSize: 'medium',
    spacing: 'normal',
  },
};

const COLOR_PALETTES = [
  { name: 'Stone', value: '#1c1917' },
  { name: 'Slate', value: '#0f172a' },
  { name: 'Emerald', value: '#065f46' },
  { name: 'Rose', value: '#9f1239' },
  { name: 'Amber', value: '#92400e' },
  { name: 'Indigo', value: '#3730a3' },
  { name: 'Cyan', value: '#155e75' },
];

const FONT_FAMILIES = [
  { name: 'Sans', value: 'sans' },
  { name: 'Serif', value: 'serif' },
  { name: 'Mono', value: 'mono' },
];

const SPACING_OPTIONS = [
  { name: 'Compact', value: 'compact' },
  { name: 'Normal', value: 'normal' },
  { name: 'Relaxed', value: 'relaxed' },
];

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) message = parsed.error;
      } catch (e) {
        message = error?.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-serif italic text-stone-900">Application Error</h2>
            <p className="text-sm text-stone-500">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-stone-50 py-3 rounded-xl hover:bg-stone-800 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cv' | 'cover' | 'app'>('cv');
  const [showPreview, setShowPreview] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cvData, setCvData] = useState<CVData>(INITIAL_CV);
  const [coverLetter, setCoverLetter] = useState<CoverLetterData>(INITIAL_COVER_LETTER);
  const [appLetter, setAppLetter] = useState<ApplicationLetterData>(INITIAL_APP_LETTER);
  const [isSaving, setIsSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const cvPreviewRef = useRef<HTMLDivElement>(null);
  const coverPreviewRef = useRef<HTMLDivElement>(null);
  const appPreviewRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Auth & Data Sync ---

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      // Close export dropdown too
      if (isExportDropdownOpen) setIsExportDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Sync CV
    const cvPath = `users/${user.uid}/data/cv`;
    const unsubCV = onSnapshot(doc(db, cvPath), (doc) => {
      if (doc.exists()) setCvData(doc.data() as CVData);
    }, (e) => handleFirestoreError(e, OperationType.GET, cvPath));

    // Sync Cover Letter
    const coverPath = `users/${user.uid}/data/coverLetter`;
    const unsubCover = onSnapshot(doc(db, coverPath), (doc) => {
      if (doc.exists()) setCoverLetter(doc.data() as CoverLetterData);
    }, (e) => handleFirestoreError(e, OperationType.GET, coverPath));

    // Sync App Letter
    const appPath = `users/${user.uid}/data/applicationLetter`;
    const unsubApp = onSnapshot(doc(db, appPath), (doc) => {
      if (doc.exists()) setAppLetter(doc.data() as ApplicationLetterData);
    }, (e) => handleFirestoreError(e, OperationType.GET, appPath));

    return () => {
      unsubCV();
      unsubCover();
      unsubApp();
    };
  }, [user]);

  // --- Actions ---

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const cvPath = `users/${user.uid}/data/cv`;
      const coverPath = `users/${user.uid}/data/coverLetter`;
      const appPath = `users/${user.uid}/data/applicationLetter`;

      await Promise.all([
        setDoc(doc(db, cvPath), cvData).catch(e => handleFirestoreError(e, OperationType.WRITE, cvPath)),
        setDoc(doc(db, coverPath), coverLetter).catch(e => handleFirestoreError(e, OperationType.WRITE, coverPath)),
        setDoc(doc(db, appPath), appLetter).catch(e => handleFirestoreError(e, OperationType.WRITE, appPath)),
      ]);
      toast.success('Progress saved successfully');
    } catch (error) {
      console.error("Save error:", error);
      toast.error('Failed to save progress');
      // ErrorBoundary will catch the re-thrown error from handleFirestoreError
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (ref: React.RefObject<HTMLDivElement>, filename: string, format: 'pdf' | 'doc' = 'pdf') => {
    if (!ref.current) {
      toast.error('No content to export');
      return;
    }
    setExporting(true);
    setIsExportDropdownOpen(false);
    const toastId = toast.loading(`Generating ${format.toUpperCase()}...`);
    try {
      const element = ref.current;
      if (format === 'pdf') {
        // Use html2canvas and jsPDF directly for better reliability
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794, // A4 width in px at 96dpi
          onclone: (clonedDoc) => {
            // Ensure the element in the clone is not scaled and is fully visible
            const clonedElement = clonedDoc.querySelector('[ref]') || clonedDoc.body.querySelector('div > div > div');
            if (clonedElement instanceof HTMLElement) {
              clonedElement.style.transform = 'none';
              clonedElement.style.position = 'relative';
              clonedElement.style.top = '0';
              clonedElement.style.left = '0';
            }

            // Fallback for any remaining oklch colors that html2canvas can't parse
            const allElements = clonedDoc.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i] as HTMLElement;
              const style = window.getComputedStyle(el);
              
              // Check common color properties
              ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
                const val = (style as any)[prop];
                if (val && val.includes('oklch')) {
                  // This is a bit of a hack, but it helps when the browser can't resolve oklch to rgb in getComputedStyle
                  // Usually getComputedStyle returns rgb/rgba, but if it doesn't, we might need to manually convert or hide
                  el.style.setProperty(prop, 'inherit', 'important');
                }
              });
            }
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${filename}.pdf`);
      } else {
        // DOC Export
        const content = element.innerHTML;
        const header = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'><title>${filename}</title>
          <style>
            body { font-family: 'Times New Roman', serif; line-height: 1.5; padding: 1in; }
            .font-serif { font-family: 'Times New Roman', serif; }
            .font-mono { font-family: 'Courier New', monospace; }
            .font-sans { font-family: 'Arial', sans-serif; }
            .italic { font-style: italic; }
            .font-bold { font-weight: bold; }
            .text-sm { font-size: 10pt; }
            .text-xs { font-size: 8pt; }
            .text-2xl { font-size: 18pt; }
            .text-4xl { font-size: 24pt; }
            .text-5xl { font-size: 30pt; }
            .space-y-12 > * + * { margin-top: 36pt; }
            .space-y-8 > * + * { margin-top: 24pt; }
            .space-y-6 > * + * { margin-top: 18pt; }
            .space-y-4 > * + * { margin-top: 12pt; }
            .space-y-2 > * + * { margin-top: 6pt; }
            .border-b { border-bottom: 1px solid #e5e5e5; }
            .border-t { border-top: 1px solid #e5e5e5; }
            .p-16 { padding: 48pt; }
            .p-12 { padding: 36pt; }
            .p-8 { padding: 24pt; }
          </style>
          </head><body>${content}</body></html>
        `;
        const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.doc`;
        link.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`${format.toUpperCase()} exported successfully`, { id: toastId });
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Failed to export ${format.toUpperCase()}`, { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const populateSample = () => {
    setCvData(SAMPLE_CV);
    setCoverLetter({
      recipientName: 'Hiring Manager',
      companyName: 'TechFlow Solutions',
      jobTitle: 'Senior Software Engineer',
      body: 'I am writing to express my enthusiastic interest in the Senior Software Engineer position at TechFlow Solutions. With over 8 years of experience in full-stack development and a strong background in React and Node.js, I am confident that my skills align perfectly with your team\'s needs.',
      tone: 'enthusiastic',
    });
    setAppLetter({
      recipientName: 'Jane Doe',
      companyName: 'TechFlow Solutions',
      companyAddress: '123 Innovation Way, San Francisco, CA',
      jobTitle: 'Senior Software Engineer',
      jobRef: 'REF-2024-001',
      subject: 'Application for Senior Software Engineer Position',
      body: 'Please find attached my CV for the position of Senior Software Engineer. I have been following TechFlow Solutions\' growth in the e-commerce sector and am eager to contribute to your mission of building scalable solutions.',
      purpose: 'job application',
    });
  };

  const resetData = () => {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
      setCvData(INITIAL_CV);
      setCoverLetter(INITIAL_COVER_LETTER);
      setAppLetter(INITIAL_APP_LETTER);
    }
  };

  // --- UI Helpers ---

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-serif italic text-stone-900">Professional Builder</h1>
            <p className="text-stone-500">Create stunning CVs and letters in minutes.</p>
          </div>
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-stone-900 text-stone-50 py-4 px-6 rounded-xl hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
          >
            <LogIn className="w-5 h-5" />
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200">
      <Toaster position="top-center" richColors />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-stone-50/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-stone-50 font-serif italic text-xl flex-shrink-0">P</div>
            <span className="font-serif italic text-lg hidden md:block">Professional Builder</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1 px-2 sm:px-4 py-2 bg-stone-100 rounded-xl text-xs sm:text-sm font-medium hover:bg-stone-200 transition-all"
              >
                <span className="max-w-[80px] sm:max-w-none truncate">
                  {activeTab === 'cv' ? 'CV' : activeTab === 'cover' ? 'Cover' : 'App'}
                </span>
                <ChevronDown className={cn("w-3 h-3 sm:w-4 h-4 transition-transform", isDropdownOpen && "rotate-180")} />
              </button>
              
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-1 w-48 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    {(['cv', 'cover', 'app'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setActiveTab(tab);
                          setIsDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2 text-sm hover:bg-stone-50 transition-colors",
                          activeTab === tab ? "text-stone-900 font-semibold bg-stone-50" : "text-stone-500"
                        )}
                      >
                        {tab === 'cv' ? 'CV Builder' : tab === 'cover' ? 'Cover Letter' : 'Application'}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setShowPreview(!showPreview)}
              className={cn(
                "flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all",
                showPreview ? "bg-stone-900 text-stone-50 shadow-lg shadow-stone-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              )}
            >
              <Eye className="w-3 h-3 sm:w-4 h-4" />
              <span>Preview</span>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="p-1.5 sm:p-2 text-stone-500 hover:text-stone-900 transition-colors relative"
              title="Save Progress"
            >
              {isSaving ? <Loader2 className="w-4 h-4 sm:w-5 h-5 animate-spin" /> : <Save className="w-4 h-4 sm:w-5 h-5" />}
            </button>
            <button 
              onClick={logout}
              className="p-1.5 sm:p-2 text-stone-500 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4 sm:w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 overflow-x-hidden">
        <div className={cn(
          "grid gap-6 sm:gap-12 items-start transition-all duration-500 ease-in-out w-full",
          showPreview ? "lg:grid-cols-2" : "grid-cols-1 max-w-3xl mx-auto"
        )}>
          
          {/* Editor Side */}
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif italic">
                {activeTab === 'cv' ? 'CV Details' : activeTab === 'cover' ? 'Letter Content' : 'Application Details'}
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={populateSample}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-stone-100 transition-all"
                >
                  <RotateCcw className="w-3 h-3" /> Sample Data
                </button>
                <button 
                  onClick={resetData}
                  className="text-xs font-medium text-stone-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-3 h-3" /> Reset
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-6">
              {activeTab === 'cv' && (
                <CVEditor data={cvData} onChange={setCvData} />
              )}
              {activeTab === 'cover' && (
                <CoverLetterEditor data={coverLetter} onChange={setCoverLetter} personalInfo={cvData.personalInfo} />
              )}
              {activeTab === 'app' && (
                <ApplicationLetterEditor data={appLetter} onChange={setAppLetter} personalInfo={cvData.personalInfo} />
              )}
            </div>
          </div>

          {/* Preview Side */}
          {showPreview && (
            <div className="lg:sticky lg:top-24 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono uppercase tracking-widest text-stone-400">Preview</h2>
                <div className="relative">
                  <button 
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                    disabled={exporting}
                    className="flex items-center gap-2 bg-stone-900 text-stone-50 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition-all disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export
                    <ChevronDown className={cn("w-3 h-3 transition-transform", isExportDropdownOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isExportDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full right-0 mt-1 w-32 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={() => handleExport(
                            activeTab === 'cv' ? cvPreviewRef : activeTab === 'cover' ? coverPreviewRef : appPreviewRef,
                            activeTab === 'cv' ? 'My_CV' : activeTab === 'cover' ? 'Cover_Letter' : 'Application_Letter',
                            'pdf'
                          )}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                        >
                          <FileDown className="w-4 h-4" /> PDF
                        </button>
                        <button
                          onClick={() => handleExport(
                            activeTab === 'cv' ? cvPreviewRef : activeTab === 'cover' ? coverPreviewRef : appPreviewRef,
                            activeTab === 'cv' ? 'My_CV' : activeTab === 'cover' ? 'Cover_Letter' : 'Application_Letter',
                            'doc'
                          )}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-stone-50 flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" /> DOC
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="bg-stone-200 p-1 sm:p-8 rounded-2xl min-h-[400px] sm:min-h-[600px] lg:min-h-[800px] flex justify-center overflow-hidden shadow-inner w-full relative">
                <div className="shadow-2xl origin-top transition-transform duration-500 bg-white scale-[0.32] min-[380px]:scale-[0.4] sm:scale-[0.6] md:scale-[0.8] lg:scale-100 absolute top-4">
                  {activeTab === 'cv' && (
                    <div ref={cvPreviewRef} className="w-[210mm] flex-shrink-0">
                      <CVPreview data={cvData} />
                    </div>
                  )}
                  {activeTab === 'cover' && (
                    <div ref={coverPreviewRef} className="w-[210mm] flex-shrink-0">
                      <LetterPreview 
                        data={coverLetter} 
                        personalInfo={cvData.personalInfo} 
                        type="cover"
                      />
                    </div>
                  )}
                  {activeTab === 'app' && (
                    <div ref={appPreviewRef} className="w-[210mm] flex-shrink-0">
                      <LetterPreview 
                        data={appLetter} 
                        personalInfo={cvData.personalInfo} 
                        type="app"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-stone-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <p className="font-serif italic text-stone-400">Crafted for your next big move.</p>
          <div className="flex justify-center gap-8 text-xs font-mono uppercase tracking-widest text-stone-300">
            <span>Secure Persistence</span>
            <span>PDF Export</span>
            <span>Real-time Preview</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Editor Components ---

function CVEditor({ data, onChange }: { data: CVData, onChange: (d: CVData) => void }) {
  const updatePersonalInfo = (field: keyof CVData['personalInfo'], val: string) => {
    onChange({ ...data, personalInfo: { ...data.personalInfo, [field]: val } });
  };

  const updateSettings = (field: keyof CVData['settings'], val: any) => {
    onChange({ ...data, settings: { ...data.settings, [field]: val } });
  };

  const addExperience = () => {
    onChange({
      ...data,
      experience: [...data.experience, { id: Date.now().toString(), company: '', position: '', startDate: '', endDate: '', description: '' }]
    });
  };

  const removeExperience = (id: string) => {
    const itemToRemove = data.experience.find(e => e.id === id);
    if (!itemToRemove) return;
    
    onChange({ ...data, experience: data.experience.filter(e => e.id !== id) });
    
    toast.success('Experience removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          onChange({ ...data, experience: [...data.experience, itemToRemove] });
        }
      }
    });
  };

  const updateExperience = (id: string, field: keyof Experience, val: string) => {
    onChange({
      ...data,
      experience: data.experience.map(e => e.id === id ? { ...e, [field]: val } : e)
    });
  };

  const addEducation = () => {
    onChange({
      ...data,
      education: [...data.education, { id: Date.now().toString(), school: '', degree: '', startDate: '', endDate: '' }]
    });
  };

  const removeEducation = (id: string) => {
    const itemToRemove = data.education.find(e => e.id === id);
    if (!itemToRemove) return;

    onChange({ ...data, education: data.education.filter(e => e.id !== id) });

    toast.success('Education removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          onChange({ ...data, education: [...data.education, itemToRemove] });
        }
      }
    });
  };

  const updateEducation = (id: string, field: keyof Education, val: string) => {
    onChange({
      ...data,
      education: data.education.map(e => e.id === id ? { ...e, [field]: val } : e)
    });
  };

  return (
    <div className="space-y-10">
      {/* Design Customization */}
      <section className="space-y-6 p-6 bg-stone-50 rounded-2xl border border-stone-100">
        <div className="flex items-center gap-2 text-stone-900">
          <Settings2 className="w-4 h-4" />
          <h3 className="font-serif italic text-lg">Design & Style</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Template Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Layout className="w-3 h-3" /> Template Style
            </label>
            <div className="relative">
              <select 
                value={data.template}
                onChange={(e) => onChange({ ...data, template: e.target.value as any })}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all appearance-none cursor-pointer"
              >
                <option value="minimal">Minimalist Style</option>
                <option value="professional">Professional Classic</option>
                <option value="modern">Modern Sidebar</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Palette className="w-3 h-3" /> Color Palette
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateSettings('primaryColor', p.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    data.settings.primaryColor === p.value ? "border-stone-900 scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: p.value }}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          {/* Font Style */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Type className="w-3 h-3" /> Typography
            </label>
            <div className="flex gap-2">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.value}
                  onClick={() => updateSettings('fontFamily', f.value)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl border text-xs capitalize transition-all",
                    data.settings.fontFamily === f.value ? "bg-stone-900 text-stone-50 border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Spacing */}
          <div className="space-y-3">
            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Maximize2 className="w-3 h-3" /> Layout Spacing
            </label>
            <div className="flex gap-2">
              {SPACING_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateSettings('spacing', s.value)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl border text-xs capitalize transition-all",
                    data.settings.spacing === s.value ? "bg-stone-900 text-stone-50 border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Personal Info */}
      <section className="space-y-4">
        <label className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
          <User className="w-3 h-3" /> Personal Information
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" value={data.personalInfo.fullName} onChange={(v) => updatePersonalInfo('fullName', v)} placeholder="John Doe" />
          <Input label="Job Title" value={data.personalInfo.jobTitle} onChange={(v) => updatePersonalInfo('jobTitle', v)} placeholder="Software Engineer" />
          <Input label="Email" value={data.personalInfo.email} onChange={(v) => updatePersonalInfo('email', v)} placeholder="john@example.com" />
          <Input label="Phone" value={data.personalInfo.phone} onChange={(v) => updatePersonalInfo('phone', v)} placeholder="+1 234 567 890" />
          <Input label="Location" value={data.personalInfo.location} onChange={(v) => updatePersonalInfo('location', v)} placeholder="New York, NY" className="sm:col-span-2" />
          <Textarea label="Professional Summary" value={data.personalInfo.summary} onChange={(v) => updatePersonalInfo('summary', v)} placeholder="Brief overview of your career..." className="sm:col-span-2" />
        </div>
      </section>

      {/* Experience */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
            <Briefcase className="w-3 h-3" /> Work Experience
          </label>
          <button onClick={addExperience} className="text-stone-900 hover:bg-stone-100 p-1 rounded-md transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {data.experience.map((exp) => (
            <div key={exp.id} className="p-4 border border-stone-100 rounded-xl space-y-4 relative group">
              <button 
                onClick={() => removeExperience(exp.id)} 
                className="absolute top-2 right-2 p-2 text-stone-300 hover:text-red-500 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                title="Remove Experience"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Company" value={exp.company} onChange={(v) => updateExperience(exp.id, 'company', v)} />
                <Input label="Position" value={exp.position} onChange={(v) => updateExperience(exp.id, 'position', v)} />
                <Input label="Start Date" value={exp.startDate} onChange={(v) => updateExperience(exp.id, 'startDate', v)} placeholder="MM/YYYY" />
                <Input label="End Date" value={exp.endDate} onChange={(v) => updateExperience(exp.id, 'endDate', v)} placeholder="MM/YYYY or Present" />
                <Textarea label="Description" value={exp.description} onChange={(v) => updateExperience(exp.id, 'description', v)} className="col-span-2" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Education */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
            <GraduationCap className="w-3 h-3" /> Education
          </label>
          <button onClick={addEducation} className="text-stone-900 hover:bg-stone-100 p-1 rounded-md transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-4">
          {data.education.map((edu) => (
            <div key={edu.id} className="p-4 border border-stone-100 rounded-xl space-y-4 relative group">
              <button 
                onClick={() => removeEducation(edu.id)} 
                className="absolute top-2 right-2 p-2 text-stone-300 hover:text-red-500 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                title="Remove Education"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-2 gap-4">
                <Input label="School / Institution" value={edu.school} onChange={(v) => updateEducation(edu.id, 'school', v)} placeholder="e.g., University of Technology" />
                <Input label="Degree / Qualification" value={edu.degree} onChange={(v) => updateEducation(edu.id, 'degree', v)} placeholder="e.g., BSc, High School, or Self-Taught" />
                <Input label="Start Date" value={edu.startDate} onChange={(v) => updateEducation(edu.id, 'startDate', v)} placeholder="MM/YYYY" />
                <Input label="End Date" value={edu.endDate} onChange={(v) => updateEducation(edu.id, 'endDate', v)} placeholder="MM/YYYY or Present" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills, Languages, Certs */}
      <div className="grid grid-cols-1 gap-6">
        <TagInput label="Skills" tags={data.skills} onChange={(tags) => onChange({ ...data, skills: tags })} icon={<Wrench className="w-3 h-3" />} />
        <TagInput label="Languages" tags={data.languages} onChange={(tags) => onChange({ ...data, languages: tags })} icon={<Languages className="w-3 h-3" />} />
        <TagInput label="Certifications" tags={data.certifications} onChange={(tags) => onChange({ ...data, certifications: tags })} icon={<Award className="w-3 h-3" />} />
      </div>
    </div>
  );
}

function CoverLetterEditor({ data, onChange, personalInfo }: { data: CoverLetterData, onChange: (d: CoverLetterData) => void, personalInfo: any }) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <label className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
          <Type className="w-3 h-3" /> Tone & Style
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['formal', 'enthusiastic', 'concise'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...data, tone: t })}
              className={cn(
                "py-2 px-3 rounded-xl border text-sm capitalize transition-all",
                data.tone === t ? "bg-stone-900 text-stone-50 border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Recipient Name" value={data.recipientName} onChange={(v) => onChange({ ...data, recipientName: v })} placeholder="Hiring Manager" />
        <Input label="Company Name" value={data.companyName} onChange={(v) => onChange({ ...data, companyName: v })} placeholder="Acme Corp" />
        <Input label="Job Title" value={data.jobTitle} onChange={(v) => onChange({ ...data, jobTitle: v })} placeholder="Software Engineer" className="col-span-2" />
        <Textarea label="Letter Body" value={data.body} onChange={(v) => onChange({ ...data, body: v })} placeholder="Start writing your cover letter..." className="col-span-2" rows={12} />
      </div>
    </div>
  );
}

function ApplicationLetterEditor({ data, onChange, personalInfo }: { data: ApplicationLetterData, onChange: (d: ApplicationLetterData) => void, personalInfo: any }) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <label className="text-xs font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
          <Layout className="w-3 h-3" /> Purpose
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['job application', 'speculative application', 'follow-up'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ ...data, purpose: p })}
              className={cn(
                "py-2 px-3 rounded-xl border text-sm capitalize transition-all",
                data.purpose === p ? "bg-stone-900 text-stone-50 border-stone-900" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Recipient Name" value={data.recipientName} onChange={(v) => onChange({ ...data, recipientName: v })} />
        <Input label="Company Name" value={data.companyName} onChange={(v) => onChange({ ...data, companyName: v })} />
        <Input label="Company Address" value={data.companyAddress} onChange={(v) => onChange({ ...data, companyAddress: v })} className="col-span-2" />
        <Input label="Job Title" value={data.jobTitle} onChange={(v) => onChange({ ...data, jobTitle: v })} />
        <Input label="Job Ref #" value={data.jobRef} onChange={(v) => onChange({ ...data, jobRef: v })} />
        <Input label="Subject Line" value={data.subject} onChange={(v) => onChange({ ...data, subject: v })} className="col-span-2" />
        <Textarea label="Letter Body" value={data.body} onChange={(v) => onChange({ ...data, body: v })} className="col-span-2" rows={10} />
      </div>
    </div>
  );
}

// --- Preview Components ---

function CVPreview({ data }: { data: CVData }) {
  const { personalInfo, experience, education, skills, languages, certifications, template, settings = INITIAL_CV.settings } = data;

  const fontClass = settings.fontFamily === 'serif' ? 'font-serif' : settings.fontFamily === 'mono' ? 'font-mono' : 'font-sans';
  
  const spacingClass = settings.spacing === 'compact' ? 'space-y-4' : settings.spacing === 'relaxed' ? 'space-y-12' : 'space-y-8';
  const sectionSpacingClass = settings.spacing === 'compact' ? 'space-y-2' : settings.spacing === 'relaxed' ? 'space-y-6' : 'space-y-4';

  if (template === 'minimal') {
    return (
      <div 
        className={cn("p-12 text-stone-800 bg-white w-[210mm] min-h-[297mm]", fontClass, spacingClass)}
        style={{ '--primary': settings.primaryColor } as any}
      >
        <div className="border-b-2 pb-6" style={{ borderColor: settings.primaryColor }}>
          <h1 className="text-4xl font-bold uppercase tracking-tighter" style={{ color: settings.primaryColor }}>{personalInfo.fullName || 'Your Name'}</h1>
          <p className="text-xl text-stone-500 mt-1">{personalInfo.jobTitle}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm font-mono text-stone-400">
            {personalInfo.email && <span>{personalInfo.email}</span>}
            {personalInfo.phone && <span>{personalInfo.phone}</span>}
            {personalInfo.location && <span>{personalInfo.location}</span>}
          </div>
        </div>

        {personalInfo.summary && (
          <section className="space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400">Summary</h2>
            <p className="leading-relaxed">{personalInfo.summary}</p>
          </section>
        )}

        <div className="grid grid-cols-3 gap-12">
          <div className="col-span-2 space-y-8">
            <section className={sectionSpacingClass}>
              <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400">Experience</h2>
              <div className="space-y-6">
                {experience.map((exp) => (
                  <div key={exp.id} className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-bold" style={{ color: settings.primaryColor }}>{exp.position}</h3>
                      <span className="text-xs font-mono text-stone-400">{exp.startDate} — {exp.endDate}</span>
                    </div>
                    <p className="text-sm italic text-stone-600">{exp.company}</p>
                    <p className="text-sm mt-2 leading-relaxed whitespace-pre-line">{exp.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={sectionSpacingClass}>
              <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400">Education</h2>
              <div className="space-y-4">
                {education.map((edu) => (
                  <div key={edu.id} className="space-y-1">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-bold" style={{ color: settings.primaryColor }}>{edu.degree || edu.school}</h3>
                      <span className="text-xs font-mono text-stone-400">{edu.startDate} — {edu.endDate}</span>
                    </div>
                    {edu.degree && <p className="text-sm text-stone-600">{edu.school}</p>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className={sectionSpacingClass}>
              <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((s, i) => <span key={i} className="text-xs bg-stone-100 px-2 py-1 rounded">{s}</span>)}
              </div>
            </section>
            {languages.length > 0 && (
              <section className={sectionSpacingClass}>
                <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400">Languages</h2>
                <div className="space-y-1">
                  {languages.map((l, i) => <p key={i} className="text-sm">{l}</p>)}
                </div>
              </section>
            )}
            {certifications.length > 0 && (
              <section className={sectionSpacingClass}>
                <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400">Certifications</h2>
                <div className="space-y-1">
                  {certifications.map((c, i) => <p key={i} className="text-sm">{c}</p>)}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (template === 'modern') {
    return (
      <div className={cn("flex w-[210mm] min-h-[297mm] bg-white", fontClass)}>
        {/* Sidebar */}
        <div className="w-1/3 text-stone-50 p-8 space-y-8" style={{ backgroundColor: settings.primaryColor }}>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold leading-tight">{personalInfo.fullName || 'Your Name'}</h1>
            <p className="text-stone-300 font-medium">{personalInfo.jobTitle}</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400 opacity-60">Contact</h2>
            <div className="space-y-2 text-sm text-stone-200">
              {personalInfo.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3" /> {personalInfo.email}</p>}
              {personalInfo.phone && <p className="flex items-center gap-2"><User className="w-3 h-3" /> {personalInfo.phone}</p>}
              {personalInfo.location && <p className="flex items-center gap-2"><Layout className="w-3 h-3" /> {personalInfo.location}</p>}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400 opacity-60">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((s, i) => <span key={i} className="text-xs border border-stone-700 px-2 py-1 rounded">{s}</span>)}
            </div>
          </section>

          {languages.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400 opacity-60">Languages</h2>
              <div className="space-y-1 text-sm text-stone-200">
                {languages.map((l, i) => <p key={i}>{l}</p>)}
              </div>
            </section>
          )}

          {certifications.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-stone-400 opacity-60">Certifications</h2>
              <div className="space-y-1 text-sm text-stone-200">
                {certifications.map((c, i) => <p key={i}>{c}</p>)}
              </div>
            </section>
          )}
        </div>

        {/* Main Content */}
        <div className={cn("w-2/3 p-12 text-stone-800", spacingClass)}>
          {personalInfo.summary && (
            <section className="space-y-4">
              <h2 className="text-xl font-serif italic border-b pb-2" style={{ borderColor: `${settings.primaryColor}20`, color: settings.primaryColor }}>Professional Profile</h2>
              <p className="leading-relaxed text-stone-600">{personalInfo.summary}</p>
            </section>
          )}

          <section className="space-y-6">
            <h2 className="text-xl font-serif italic border-b pb-2" style={{ borderColor: `${settings.primaryColor}20`, color: settings.primaryColor }}>Experience</h2>
            <div className="space-y-8">
              {experience.map((exp) => (
                <div key={exp.id} className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-lg font-bold">{exp.position}</h3>
                    <span className="text-xs font-mono text-stone-400">{exp.startDate} — {exp.endDate}</span>
                  </div>
                  <p className="text-stone-500 font-medium">{exp.company}</p>
                  <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-serif italic border-b pb-2" style={{ borderColor: `${settings.primaryColor}20`, color: settings.primaryColor }}>Education</h2>
            <div className="space-y-4">
              {education.map((edu) => (
                <div key={edu.id} className="space-y-1">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold">{edu.degree || edu.school}</h3>
                    <span className="text-xs font-mono text-stone-400">{edu.startDate} — {edu.endDate}</span>
                  </div>
                  {edu.degree && <p className="text-sm text-stone-500">{edu.school}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Default: Professional
  return (
    <div className={cn("p-16 text-stone-800 bg-white w-[210mm] min-h-[297mm]", fontClass, spacingClass)}>
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-serif italic tracking-tight" style={{ color: settings.primaryColor }}>{personalInfo.fullName || 'Your Name'}</h1>
        <p className="text-xl text-stone-500 font-light tracking-widest uppercase">{personalInfo.jobTitle}</p>
        <div className="flex justify-center gap-6 text-sm text-stone-400 border-t border-b py-3" style={{ borderColor: `${settings.primaryColor}20` }}>
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
        </div>
      </div>

      {personalInfo.summary && (
        <section className="max-w-2xl mx-auto text-center">
          <p className="leading-relaxed text-stone-600 italic">"{personalInfo.summary}"</p>
        </section>
      )}

      <div className="space-y-10">
        <section className="space-y-6">
          <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-stone-300 text-center border-b pb-2" style={{ borderColor: `${settings.primaryColor}20` }}>Experience</h2>
          <div className="space-y-8">
            {experience.map((exp) => (
              <div key={exp.id} className="grid grid-cols-4 gap-8">
                <div className="text-right text-xs font-mono text-stone-400 pt-1">
                  {exp.startDate} — {exp.endDate}
                </div>
                <div className="col-span-3 space-y-2">
                  <h3 className="text-lg font-bold" style={{ color: settings.primaryColor }}>{exp.position}</h3>
                  <p className="text-stone-500 font-medium">{exp.company}</p>
                  <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{exp.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-stone-300 text-center border-b pb-2" style={{ borderColor: `${settings.primaryColor}20` }}>Education</h2>
          <div className="space-y-6">
            {education.map((edu) => (
              <div key={edu.id} className="grid grid-cols-4 gap-8">
                <div className="text-right text-xs font-mono text-stone-400 pt-1">
                  {edu.startDate} — {edu.endDate}
                </div>
                <div className="col-span-3">
                  <h3 className="font-bold" style={{ color: settings.primaryColor }}>{edu.degree || edu.school}</h3>
                  {edu.degree && <p className="text-sm text-stone-500">{edu.school}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-12">
          <section className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-stone-300 border-b pb-2" style={{ borderColor: `${settings.primaryColor}20` }}>Expertise</h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((s, i) => <span key={i} className="text-xs bg-stone-50 border border-stone-100 px-3 py-1 rounded-full">{s}</span>)}
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-stone-300 border-b pb-2" style={{ borderColor: `${settings.primaryColor}20` }}>Additional</h2>
            <div className="space-y-4">
              {languages.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-mono uppercase text-stone-400 mb-1">Languages</h4>
                  <p className="text-sm text-stone-600">{languages.join(', ')}</p>
                </div>
              )}
              {certifications.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-mono uppercase text-stone-400 mb-1">Certifications</h4>
                  <p className="text-sm text-stone-600">{certifications.join(', ')}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LetterPreview({ data, personalInfo, type }: { data: any, personalInfo: any, type: 'cover' | 'app' }) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-16 text-stone-800 space-y-12 min-h-[297mm] w-[210mm] flex flex-col bg-white">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-serif italic">{personalInfo.fullName || 'Your Name'}</h1>
        <div className="text-sm text-stone-500 space-y-0.5">
          <p>{personalInfo.location}</p>
          <p>{personalInfo.email}</p>
          <p>{personalInfo.phone}</p>
        </div>
      </div>

      <div className="space-y-6">
        <p className="text-sm font-mono text-stone-400">{date}</p>

        <div className="space-y-1">
          <p className="font-bold">{data.recipientName || 'Hiring Manager'}</p>
          <p>{data.companyName}</p>
          {type === 'app' && <p className="text-sm text-stone-500">{data.companyAddress}</p>}
        </div>
      </div>

      <div className="space-y-8">
        {type === 'app' && data.subject && (
          <p className="font-bold border-b border-stone-100 pb-2">RE: {data.subject} {data.jobRef && `(${data.jobRef})`}</p>
        )}

        <p>Dear {data.recipientName || 'Hiring Manager'},</p>

        <div className="leading-relaxed whitespace-pre-line text-stone-700">
          {data.body || 'Your letter content will appear here...'}
        </div>

        <div className="space-y-12">
          <div className="space-y-1">
            <p>Sincerely,</p>
            <p className="font-serif italic text-xl mt-4">{personalInfo.fullName || 'Your Name'}</p>
          </div>
        </div>
      </div>

      {type === 'app' && (
        <div className="pt-12 border-t border-stone-100 text-[10px] font-mono text-stone-300 uppercase tracking-widest">
          Enclosure: Curriculum Vitae
        </div>
      )}
    </div>
  );
}

// --- UI Primitives ---

function Input({ label, value, onChange, placeholder, className }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all"
      />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, className, rows = 4 }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, className?: string, rows?: number }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400">{label}</label>
        <span className="text-[10px] font-mono text-stone-300">{value.length} chars</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all resize-none"
      />
    </div>
  );
}

function TagInput({ label, tags, onChange, icon }: { label: string, tags: string[], onChange: (tags: string[]) => void, icon?: React.ReactNode }) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-mono uppercase tracking-widest text-stone-400 flex items-center gap-2">
        {icon} {label}
      </label>
      <div className="flex flex-wrap gap-2 p-2 bg-stone-50 border border-stone-200 rounded-xl min-h-[46px]">
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 bg-white border border-stone-200 px-2 py-1 rounded-lg text-xs">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-stone-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type and press Enter..."
          className="flex-grow bg-transparent border-none focus:outline-none text-sm px-2 py-1 min-w-[120px]"
        />
      </div>
    </div>
  );
}
