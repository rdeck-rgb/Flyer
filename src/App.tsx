/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import Papa from 'papaparse';
import { toPng } from 'html-to-image';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Mail, 
  Sparkles, 
  Download, 
  RefreshCw,
  Building2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  FileText,
  Upload,
  ImagePlus,
  Layout,
  Wand2,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface JobDetails {
  title: string;
  headline: string;
  location: string | null;
  salary: string | null;
  email: string | null;
  industry: string;
  backgroundImage?: string;
  logo?: string | null;
}

type TemplateType = 'modern' | 'brutalist' | 'minimalist' | 'editorial';

// --- Constants ---

const GEMINI_MODEL = "gemini-3.1-pro-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

// --- App Component ---

export default function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [details, setDetails] = useState<JobDetails | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>("https://picsum.photos/seed/logo/200/200");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('modern');
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // Batch Processing State
  const [jobsQueue, setJobsQueue] = useState<string[]>([]);
  const [processedJobs, setProcessedJobs] = useState<JobDetails[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(0);

  const flyerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      // Assume success as per guidelines to avoid race conditions
      setHasApiKey(true);
    }
  };

  const getAI = () => {
    // Use the selected API key if available, otherwise fallback to the default Gemini key
    const apiKey = (process.env as any).API_KEY || (process.env as any).GEMINI_API_KEY || '';
    return new GoogleGenAI({ apiKey });
  };

  const generateDetailedPrompt = async (industry: string, refImg: string | null) => {
    const ai = getAI();
    const parts: any[] = [
      {
        text: `You are a world-class Marketing Creative Director and Advertising Expert. Your goal is to create a "kick-ass" background for a high-converting job flyer in the ${industry} industry. 
        
        The image should:
        - Be visually arresting and professional.
        - Evoke the specific energy and "vibe" of the ${industry} sector.
        - Use a sophisticated color palette that feels premium and modern.
        - Be clean and atmospheric, with intentional negative space or strategic blurring to ensure marketing copy (text) pops.
        - NO PEOPLE, only high-end environments, symbolic architectural elements, or abstract textures that scream "success" and "opportunity".
        - Feel like a high-budget commercial photography shot.
        
        ${refImg ? "I am providing a brand style reference. Analyze its lighting, mood, color science, and composition. The new image MUST be a perfect stylistic match to maintain brand equity." : ""}
        
        Return ONLY the detailed, evocative prompt text that will guide an image generator to create this masterpiece.`
      }
    ];

    if (refImg) {
      const mimeType = refImg.match(/data:(.*?);/)?.[1] || "image/png";
      parts.push({
        inlineData: {
          data: refImg.split(',')[1],
          mimeType,
        },
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: { parts },
      });
      return response.text || `A professional ${industry} industry background.`;
    } catch (err) {
      console.error("Prompt generation error:", err);
      return `A professional ${industry} industry background.`;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeWhiteBackground = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Simple white background removal
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // If pixel is very close to white, make it transparent
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingLogo(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const processedLogo = await removeWhiteBackground(reader.result as string);
        setLogo(processedLogo);
        setIsProcessingLogo(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const descriptions = results.data
            .map((row: any) => row["Published Description"] || row["publicDescription"] || row["description"])
            .filter(Boolean);
          
          if (descriptions.length > 0) {
            setJobsQueue(descriptions);
            setProcessedJobs([]);
            setCurrentBatchIndex(0);
            setIsBatchProcessing(true);
          } else {
            setError("No valid job descriptions found in CSV. Please ensure there is a 'Published Description' column.");
          }
        },
        error: (err) => {
          setError("Failed to parse CSV file.");
          console.error(err);
        }
      });
    }
  };

  // Effect to process queue
  useEffect(() => {
    if (isBatchProcessing && currentBatchIndex >= 0 && currentBatchIndex < jobsQueue.length) {
      processJob(jobsQueue[currentBatchIndex]);
    } else if (isBatchProcessing && currentBatchIndex >= jobsQueue.length) {
      setIsBatchProcessing(false);
      setCurrentBatchIndex(-1);
      setViewingIndex(0);
      if (processedJobs.length > 0) {
        setDetails(processedJobs[0]);
        setBackgroundImage(processedJobs[0].backgroundImage || null);
      }
    }
  }, [isBatchProcessing, currentBatchIndex]);

  const processJob = async (description: string) => {
    setIsExtracting(true);
    const ai = getAI();
    try {
      // 1. Extract Details
      const extractResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are a world-class Marketing Expert and Recruitment Strategist. Analyze this job description and extract key details for a high-impact advertisement.
        
        Return the result in strict JSON format. 
        
        Fields to extract:
        - title: A punchy, professional job title.
        - location: The primary work location.
        - salary: The compensation (make it look attractive if mentioned).
        - email: The contact email.
        - industry: A concise, powerful industry name (1-2 words).
        - headline: A catchy, marketing-style headline for the flyer (e.g., "Shape the Future of Tech", "Join a Team of Visionaries").
        
        If a field is missing, use null.
        
        Job Description:
        ${description}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              location: { type: Type.STRING, nullable: true },
              salary: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              industry: { type: Type.STRING },
              headline: { type: Type.STRING },
            },
            required: ["title", "industry", "headline"],
          },
        },
      });

      const jobDetails = JSON.parse(extractResponse.text || '{}') as JobDetails;

      // 2. Generate Background
      const detailedPrompt = await generateDetailedPrompt(jobDetails.industry, referenceImage);
      
      const imgParts: any[] = [
        {
          text: detailedPrompt,
        },
      ];

      if (referenceImage) {
        const mimeType = referenceImage.match(/data:(.*?);/)?.[1] || "image/png";
        imgParts.push({
          inlineData: {
            data: referenceImage.split(',')[1],
            mimeType,
          },
        });
        imgParts[0].text += " MANDATORY: Strictly follow the visual style, color palette, lighting, and composition of the provided reference image. The generated image MUST feel like it belongs to the same series or brand as the reference.";
      }

      const imgResponse = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts: imgParts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          },
        },
      });

      let bg = `https://picsum.photos/seed/${jobDetails.industry}/1200/800?blur=2`;
      for (const part of imgResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          bg = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      const completedJob = { ...jobDetails, backgroundImage: bg, logo: logo };
      setProcessedJobs(prev => [...prev, completedJob]);
      setCurrentBatchIndex(prev => prev + 1);
    } catch (err) {
      console.error("Batch processing error:", err);
      // Skip failed job or handle error
      setCurrentBatchIndex(prev => prev + 1);
    } finally {
      setIsExtracting(false);
    }
  };

  const extractDetails = async () => {
    if (!jobDescription.trim()) return;

    setIsExtracting(true);
    setError(null);
    setProcessedJobs([]); // Reset batch view
    const ai = getAI();

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are a world-class Marketing Expert and Recruitment Strategist. Analyze this job description and extract key details for a high-impact advertisement.
        
        Return the result in strict JSON format. 
        
        Fields to extract:
        - title: A punchy, professional job title.
        - location: The primary work location.
        - salary: The compensation (make it look attractive if mentioned).
        - email: The contact email.
        - industry: A concise, powerful industry name (1-2 words).
        - headline: A catchy, marketing-style headline for the flyer (e.g., "Shape the Future of Tech", "Join a Team of Visionaries").
        
        If a field is missing, use null.
        
        Job Description:
        ${jobDescription}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              location: { type: Type.STRING, nullable: true },
              salary: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              industry: { type: Type.STRING },
              headline: { type: Type.STRING },
            },
            required: ["title", "industry", "headline"],
          },
        },
      });

      const result = JSON.parse(response.text || '{}') as JobDetails;
      setDetails({ ...result, logo: logo });
      generateBackground(result.industry, referenceImage);
    } catch (err) {
      console.error("Extraction error:", err);
      setError("Failed to extract job details. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const generateBackground = async (industry: string, refImg: string | null = null) => {
    setIsGeneratingImage(true);
    const ai = getAI();
    try {
      const detailedPrompt = await generateDetailedPrompt(industry, refImg);
      
      const parts: any[] = [
        {
          text: detailedPrompt,
        },
      ];

      if (refImg) {
        const mimeType = refImg.match(/data:(.*?);/)?.[1] || "image/png";
        parts.push({
          inlineData: {
            data: refImg.split(',')[1],
            mimeType,
          },
        });
        parts[0].text += " MANDATORY: Strictly follow the visual style, color palette, lighting, and composition of the provided reference image. The generated image MUST feel like it belongs to the same series or brand as the reference.";
      }

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setBackgroundImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (err) {
      console.error("Image generation error:", err);
      setBackgroundImage(`https://picsum.photos/seed/${industry}/1200/800?blur=2`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const editBackground = async () => {
    if (!editPrompt.trim() || !backgroundImage) return;

    setIsEditingImage(true);
    const ai = getAI();
    try {
      const mimeType = backgroundImage.match(/data:(.*?);/)?.[1] || "image/png";
      
      const parts: any[] = [
        {
          inlineData: {
            data: backgroundImage.split(',')[1],
            mimeType,
          },
        },
        {
          text: `Edit this background image based on this request: ${editPrompt}. Maintain the professional, atmospheric style suitable for a job flyer.`,
        },
      ];

      if (referenceImage) {
        const refMimeType = referenceImage.match(/data:(.*?);/)?.[1] || "image/png";
        parts.push({
          inlineData: {
            data: referenceImage.split(',')[1],
            mimeType: refMimeType,
          },
        });
        parts[1].text += " MANDATORY: Ensure the edits remain consistent with the visual style, color palette, and lighting of the provided reference image.";
      }

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: {
          parts: parts,
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const newBg = `data:image/png;base64,${part.inlineData.data}`;
          setBackgroundImage(newBg);
          if (processedJobs.length > 0) {
            const updated = [...processedJobs];
            updated[viewingIndex] = { ...updated[viewingIndex], backgroundImage: newBg };
            setProcessedJobs(updated);
          }
          setEditPrompt('');
          break;
        }
      }
    } catch (err) {
      console.error("Image edit error:", err);
      setError("Failed to edit image. Please try again.");
    } finally {
      setIsEditingImage(false);
    }
  };

  const handleDownload = async () => {
    if (!flyerRef.current) return;
    try {
      const dataUrl = await toPng(flyerRef.current, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `job-flyer-${details?.title || 'job'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download flyer image.');
    }
  };

  const navigateBatch = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? viewingIndex - 1 : viewingIndex + 1;
    if (newIndex >= 0 && newIndex < processedJobs.length) {
      setViewingIndex(newIndex);
      setDetails(processedJobs[newIndex]);
      setBackgroundImage(processedJobs[newIndex].backgroundImage || null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans selection:bg-indigo-100">
      {/* API Key Selection Banner */}
      {!hasApiKey && !isCheckingKey && (
        <div className="bg-amber-50 border-b border-amber-200 p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900 uppercase tracking-wider">Premium Image Generation Enabled</p>
                <p className="text-xs text-amber-700">To use Gemini 3.1 high-quality image generation, please select your API key.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-amber-600 underline hover:text-amber-700"
              >
                Billing Info
              </a>
              <button
                onClick={handleSelectKey}
                className="px-6 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-amber-700 transition-all shadow-lg shadow-amber-200"
              >
                Select API Key
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FlyerGen</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-semibold transition-all border border-emerald-200"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Bulk Upload CSV
            </button>
            <input
              type="file"
              ref={csvInputRef}
              onChange={handleCsvUpload}
              className="hidden"
              accept=".csv"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Input */}
          <section className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Create your flyer</h2>
              <p className="text-gray-500">Set your branding and paste a job description.</p>
            </div>

            {/* Global Branding Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Global Branding
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Logo Section */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    Company Logo
                  </label>
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {isProcessingLogo ? (
                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                      ) : logo ? (
                        <img src={logo} alt="Logo" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      ) : (
                        <Building2 className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:border-indigo-300 hover:text-indigo-600 transition-all"
                      >
                        Change
                      </button>
                      {logo !== "https://picsum.photos/seed/logo/200/200" && (
                        <button
                          onClick={() => setLogo("https://picsum.photos/seed/logo/200/200")}
                          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:border-red-300 hover:text-red-600 transition-all"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Reference Image Section */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    Style Reference
                  </label>
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {referenceImage ? (
                        <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImagePlus className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:border-indigo-300 hover:text-indigo-600 transition-all"
                      >
                        {referenceImage ? 'Change' : 'Upload'}
                      </button>
                      {referenceImage && (
                        <button
                          onClick={() => setReferenceImage(null)}
                          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:border-red-300 hover:text-red-600 transition-all"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {isBatchProcessing && (
              <div className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Batch...
                  </h3>
                  <span className="text-sm font-medium text-indigo-600">
                    {processedJobs.length} / {jobsQueue.length}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="bg-indigo-600 h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(processedJobs.length / jobsQueue.length) * 100}%` }}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                  {processedJobs.map((job, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="font-medium truncate max-w-[200px]">{job.title}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  ))}
                  {jobsQueue.slice(processedJobs.length).map((_, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 text-gray-400">
                      <span>Waiting...</span>
                      <Clock className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Job Description
                </label>
              </div>
              <div className="relative">
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job description here..."
                  className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none text-sm leading-relaxed"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  Select Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['modern', 'brutalist', 'minimalist', 'editorial'] as TemplateType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTemplate(t)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all ${
                        selectedTemplate === t 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={extractDetails}
                disabled={isExtracting || !jobDescription.trim() || isBatchProcessing}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-4"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Extracting Details...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Flyer
                  </>
                )}
              </button>

              {error && (
                <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                  {error}
                </p>
              )}
            </div>

            {/* Editable Details */}
            <AnimatePresence>
              {details && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6"
                >
                  <h3 className="text-lg font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-600" />
                      Refine Details
                    </div>
                    {processedJobs.length > 0 && (
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Flyer {viewingIndex + 1} of {processedJobs.length}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailInput 
                      label="Job Title" 
                      value={details.title} 
                      onChange={(v) => setDetails({...details, title: v})} 
                      icon={<Briefcase className="w-4 h-4" />}
                    />
                    <DetailInput 
                      label="Headline" 
                      value={details.headline} 
                      onChange={(v) => setDetails({...details, headline: v})} 
                      icon={<Sparkles className="w-4 h-4" />}
                    />
                    <DetailInput 
                      label="Location" 
                      value={details.location || ''} 
                      onChange={(v) => setDetails({...details, location: v || null})} 
                      icon={<MapPin className="w-4 h-4" />}
                    />
                    <DetailInput 
                      label="Salary" 
                      value={details.salary || ''} 
                      onChange={(v) => setDetails({...details, salary: v || null})} 
                      icon={<DollarSign className="w-4 h-4" />}
                    />
                    <DetailInput 
                      label="Email" 
                      value={details.email || ''} 
                      onChange={(v) => setDetails({...details, email: v || null})} 
                      icon={<Mail className="w-4 h-4" />}
                    />
                    <div className="md:col-span-2 space-y-4">
                      <DetailInput 
                        label="Industry" 
                        value={details.industry} 
                        onChange={(v) => setDetails({...details, industry: v})} 
                        icon={<Building2 className="w-4 h-4" />}
                        onBlur={() => generateBackground(details.industry, referenceImage)}
                      />
                      <p className="text-[10px] text-gray-400 mt-1 ml-1 uppercase tracking-wider font-bold">Background will regenerate when industry changes</p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-indigo-600" />
                      Edit Background Image
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g., 'make it more blue', 'add more light'"
                        className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <button
                        onClick={editBackground}
                        disabled={isEditingImage || !editPrompt.trim() || !backgroundImage}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                      >
                        {isEditingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Apply
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Right Column: Preview */}
          <section className="sticky top-28">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Live Preview</h2>
              <div className="flex items-center gap-3">
                {processedJobs.length > 1 && (
                  <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                    <button 
                      onClick={() => navigateBatch('prev')}
                      disabled={viewingIndex === 0}
                      className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold px-2 tabular-nums">{viewingIndex + 1} / {processedJobs.length}</span>
                    <button 
                      onClick={() => navigateBatch('next')}
                      disabled={viewingIndex === processedJobs.length - 1}
                      className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button 
                  onClick={handleDownload}
                  disabled={!details}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>
              </div>
            </div>

            <div className="relative aspect-[3/4] w-full max-w-md mx-auto bg-gray-100 rounded-[2rem] shadow-2xl overflow-hidden border-8 border-white group">
              <AnimatePresence mode="wait">
                {details ? (
                  <motion.div
                    key={viewingIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative w-full h-full flex flex-col"
                    ref={flyerRef}
                  >
                    {/* Background Image */}
                    <div className="absolute inset-0">
                      {isGeneratingImage ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <img 
                          src={backgroundImage || `https://picsum.photos/seed/${details.industry}/800/1200?blur=2`} 
                          alt="Background" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </div>

                    {/* Logo Branding */}
                    {(details.logo || logo) && (
                      <div className={`absolute top-8 ${
                        selectedTemplate === 'minimalist' ? 'left-1/2 -translate-x-1/2' : 'left-8'
                      } z-20`}>
                        <div className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-500 ${
                          selectedTemplate === 'brutalist' ? 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 
                          selectedTemplate === 'minimalist' ? 'bg-transparent' :
                          'bg-white/10 backdrop-blur-md border border-white/20 shadow-xl'
                        }`}>
                          <img src={details.logo || logo || ''} alt="Company Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className={`relative z-10 flex-1 flex flex-col p-8 text-white ${
                      selectedTemplate === 'modern' ? 'justify-end' :
                      selectedTemplate === 'brutalist' ? 'justify-start pt-24' :
                      selectedTemplate === 'minimalist' ? 'justify-center items-center text-center' :
                      'justify-end'
                    }`}>
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className={`space-y-6 w-full ${
                          selectedTemplate === 'brutalist' ? 'bg-white p-8 border-4 border-black text-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]' :
                          selectedTemplate === 'minimalist' ? 'bg-white/5 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/10 text-white' :
                          selectedTemplate === 'editorial' ? 'font-serif bg-black/40 backdrop-blur-sm p-8 rounded-t-3xl' :
                          'bg-black/20 backdrop-blur-md p-8 rounded-3xl border border-white/10'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.25em] ${
                              selectedTemplate === 'brutalist' ? 'bg-black text-white' :
                              selectedTemplate === 'minimalist' ? 'bg-white/20' :
                              'bg-indigo-600 shadow-lg shadow-indigo-500/30'
                            }`}>
                              {details.industry}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            <h4 className={`uppercase tracking-widest font-bold ${
                              selectedTemplate === 'brutalist' ? 'text-indigo-600 text-sm' : 
                              selectedTemplate === 'minimalist' ? 'text-white/60 text-xs' :
                              'text-indigo-400 text-xs'
                            }`}>
                              {details.headline}
                            </h4>
                            <h3 className={`leading-[0.9] tracking-tighter uppercase ${
                              selectedTemplate === 'modern' ? 'text-5xl font-black italic' :
                              selectedTemplate === 'brutalist' ? 'text-6xl font-black' :
                              selectedTemplate === 'minimalist' ? 'text-4xl font-extralight' :
                              'text-6xl font-serif italic font-light'
                            }`}>
                              {details.title}
                            </h3>
                          </div>
                        </div>

                        <div className={`grid gap-6 ${selectedTemplate === 'minimalist' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {details.location && (
                            <div className="space-y-1">
                              <p className={`text-[10px] uppercase font-black tracking-[0.2em] ${
                                selectedTemplate === 'brutalist' ? 'text-black/40' : 'text-white/40'
                              }`}>Location</p>
                              <p className="text-base font-bold flex items-center gap-2">
                                <MapPin className={`w-4 h-4 ${selectedTemplate === 'brutalist' ? 'text-indigo-600' : 'text-indigo-400'}`} />
                                {details.location}
                              </p>
                            </div>
                          )}
                          {details.salary && (
                            <div className="space-y-1">
                              <p className={`text-[10px] uppercase font-black tracking-[0.2em] ${
                                selectedTemplate === 'brutalist' ? 'text-black/40' : 'text-white/40'
                              }`}>Compensation</p>
                              <p className="text-base font-bold flex items-center gap-2">
                                <DollarSign className={`w-4 h-4 ${selectedTemplate === 'brutalist' ? 'text-indigo-600' : 'text-indigo-400'}`} />
                                {details.salary}
                              </p>
                            </div>
                          )}
                        </div>

                        {details.email && (
                          <div className={`pt-8 border-t flex items-center justify-between ${
                            selectedTemplate === 'brutalist' ? 'border-black' : 'border-white/10'
                          }`}>
                            <div className="space-y-1 text-left">
                              <p className={`text-[10px] uppercase font-black tracking-[0.2em] ${
                                selectedTemplate === 'brutalist' ? 'text-black/40' : 'text-white/40'
                              }`}>Ready to apply?</p>
                              <p className="text-base font-bold flex items-center gap-2">
                                <Mail className={`w-4 h-4 ${selectedTemplate === 'brutalist' ? 'text-indigo-600' : 'text-indigo-400'}`} />
                                {details.email}
                              </p>
                            </div>
                            <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                              selectedTemplate === 'brutalist' ? 'border-black bg-black text-white' : 'border-white/20 bg-white/5 backdrop-blur-sm'
                            }`}>
                              <ChevronRight className="w-8 h-8" />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                ) : (
                  <div key="empty" className="w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                      <Briefcase className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">No Preview Available</h3>
                      <p className="text-sm text-gray-500">Paste a job description or upload a CSV to see your flyer here.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 bg-white mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <Sparkles className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-gray-900">FlyerGen</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 FlyerGen AI. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-indigo-600">Privacy</a>
            <a href="#" className="hover:text-indigo-600">Terms</a>
            <a href="#" className="hover:text-indigo-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function DetailInput({ label, value, onChange, icon, onBlur }: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  icon: React.ReactNode;
  onBlur?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        />
      </div>
    </div>
  );
}
