import * as React from 'react';
import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, 
  User, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Camera,
  Image as ImageIcon,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";

const PASSPORT_PROMPT = `PHOTO EDITING TASK: Keep the person's face 100% EXACTLY as it is in the reference image. DO NOT change, morph, or enhance any facial features. The identity must be perfectly preserved. ONLY change the background to a professional neutral studio gradient and change the clothing to a high-quality dark corporate suit with a white shirt. The final output should look like the original person was photographed in a professional studio. Close-up headshot framing.`;

const LOADING_MESSAGES = [
  "Analyzing facial features...",
  "Tailoring the professional suit...",
  "Adjusting studio lighting...",
  "Polishing skin textures...",
  "Applying corporate color grading...",
  "Finalizing your professional look...",
  "Almost ready! Just a few more seconds..."
];

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle rotating loading messages
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Request notification permission on mount
  React.useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Passport Pro", {
        body: "Your professional headshot is ready!",
        icon: "/favicon.ico" // Fallback icon
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setOriginalImage(event.target?.result as string);
      setGeneratedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const resizeImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error("Failed to process the image. Please try another one."));
    });
  };

  const generatePassportPhoto = async () => {
    if (!originalImage) return;

    setIsGenerating(true);
    setLoadingMessageIndex(0);
    
    try {
      // 1. Resize image first to ensure it's not too large for the API
      const resizedImage = await resizeImage(originalImage);
      const [mimePart, base64Data] = resizedImage.split(',');
      const mimeType = mimePart.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // 2. Add a timeout to the generation process (60 seconds)
      const generationPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: PASSPORT_PROMPT,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "3:4",
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("The request is taking too long. Please try a smaller photo or check your connection.")), 60000)
      );

      const response = await Promise.race([generationPromise, timeoutPromise]) as any;

      let foundImage = false;
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
            foundImage = true;
            sendNotification();
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error("AI could not generate the image. Please try again with a clearer photo.");
      }

      toast.success("Passport photo generated successfully!");
    } catch (error) {
      console.error("Generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate photo.";
      toast.error("Generation Failed", {
        description: errorMessage,
        duration: 8000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'passport-photo.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setOriginalImage(null);
    setGeneratedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-blue-100 selection:text-blue-900">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Passport Pro</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
              Pricing
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900">
              API
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-gray-900">
              Professional Headshots <br />
              <span className="text-blue-600">in Seconds.</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload any photo and our AI will transform it into a high-quality, 
              corporate-ready passport photo with studio lighting and professional attire.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Upload Section */}
          <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Upload Photo
              </CardTitle>
              <CardDescription>
                Upload a clear photo of your face. Good lighting works best.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all duration-300
                  ${originalImage ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden" 
                  accept="image/*"
                />
                
                <AnimatePresence mode="wait">
                  {originalImage ? (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative aspect-square w-full max-w-[300px] mx-auto rounded-lg overflow-hidden shadow-lg"
                    >
                      <img 
                        src={originalImage} 
                        alt="Original" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white font-medium flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" /> Change Photo
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-gray-400"
                    >
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-blue-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">Click or drag to upload</p>
                      <p className="text-xs mt-1">PNG, JPG up to 10MB</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-gray-100 pt-6">
              <Button 
                variant="outline" 
                onClick={reset}
                disabled={!originalImage || isGenerating}
                className="border-gray-200 text-gray-600"
              >
                Reset
              </Button>
              <Button 
                onClick={generatePassportPhoto}
                disabled={!originalImage || isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate AI Photo
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Result Section */}
          <Card className="border-gray-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                AI Result
              </CardTitle>
              <CardDescription>
                Your professional corporate headshot will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50/50">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full max-w-[300px] space-y-4"
                  >
                    <Skeleton className="aspect-[3/4] w-full rounded-lg bg-gray-200" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-3/4 bg-gray-200" />
                      <Skeleton className="h-4 w-1/2 bg-gray-200" />
                    </div>
                    <div className="text-center py-4 space-y-4">
                      <p className="text-sm font-medium text-blue-600 animate-pulse">
                        {LOADING_MESSAGES[loadingMessageIndex]}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="xs" 
                        onClick={() => setIsGenerating(false)}
                        className="text-gray-400 hover:text-red-500 text-[10px]"
                      >
                        Taking too long? Click to cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : generatedImage ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-[300px] space-y-6"
                  >
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-2xl border-4 border-white ring-1 ring-gray-200">
                      <img 
                        src={generatedImage} 
                        alt="Generated Passport" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2">
                        <div className="bg-green-500 text-white p-1 rounded-full shadow-lg">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <h4 className="font-semibold text-sm mb-1">Passport Ready</h4>
                      <p className="text-xs text-gray-500">
                        High-resolution 8K output. Perfect for LinkedIn, CVs, and official documents.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center text-gray-300"
                  >
                    <div className="w-20 h-20 border-4 border-gray-100 rounded-full flex items-center justify-center mb-4">
                      <User className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">Waiting for generation</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
            <CardFooter className="bg-white border-t border-gray-100 p-6">
              <Button 
                onClick={downloadImage}
                disabled={!generatedImage || isGenerating}
                className="w-full bg-gray-900 hover:bg-black text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download High-Res
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Features Section */}
        <section className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">AI Enhancement</h3>
            <p className="text-sm text-gray-500">
              Advanced neural networks preserve your identity while enhancing lighting and attire.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Studio Quality</h3>
            <p className="text-sm text-gray-500">
              Get professional 85mm lens effects and soft directional lighting without a photographer.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold mb-2">Privacy First</h3>
            <p className="text-sm text-gray-500">
              Your photos are processed securely and never stored on our servers.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12 mt-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Passport Pro</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
          <p className="text-sm text-gray-400">
            © 2026 Passport Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
