import React, { useRef, useState } from 'react';
import { Camera, X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeGroceryImage, ScannedGrocery } from '../services/geminiService';

interface ScannerProps {
  onScan: (data: ScannedGrocery, image: string) => Promise<void> | void;
  onClose: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Please enable camera permissions to scan items.");
    }
  };

  React.useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
    const fullImageData = canvas.toDataURL('image/jpeg');

    setIsAnalyzing(true);
    const result = await analyzeGroceryImage(base64Data);

    if (result) {
      let timeoutId: NodeJS.Timeout;
      try {
        const scanPromise = onScan(result, fullImageData);
        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Database connection timed out. Did you click 'Create database' in the Firebase Console?")), 8000);
        });
        await Promise.race([scanPromise, timeoutPromise]);
      } catch (e: any) {
        setError(e.message || "Failed to save item to database.");
      } finally {
        if (timeoutId!) clearTimeout(timeoutId);
      }
    } else {
      setError("Could not identify the item. Please try again.");
    }
    setIsAnalyzing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-dark/95 backdrop-blur-md flex flex-col items-center justify-center p-6"
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-white/70 bg-white/10 hover:bg-white/20 hover:text-white rounded-full p-3 transition-colors"
      >
        <X size={24} strokeWidth={2.5} />
      </button>

      <div className="relative w-full max-w-sm aspect-[3/4] bg-dark-muted rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 ring-4 ring-white/5">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center p-8 bg-red-500/20 text-red-100">
            <p className="font-semibold">{error}</p>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
          />
        )}
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner overlay box */}
        {!isAnalyzing && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[70%] aspect-square border-2 border-white/40 rounded-3xl relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-3xl -mt-[2px] -ml-[2px]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-3xl -mt-[2px] -mr-[2px]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-3xl -mb-[2px] -ml-[2px]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-3xl -mb-[2px] -mr-[2px]" />
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center bg-gradient-to-t from-dark/90 to-transparent">
          <button
            onClick={captureImage}
            disabled={isAnalyzing}
            className="w-20 h-20 rounded-full bg-brand flex items-center justify-center hover:bg-brand-dark active:scale-[0.98] transition-all disabled:opacity-50 border-4 border-white/20"
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin text-white" size={32} strokeWidth={2.5} />
            ) : (
              <Camera size={32} className="text-white" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="absolute inset-0 bg-dark/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8">
            <Loader2 className="animate-spin mb-4 text-brand" size={48} strokeWidth={2.5} />
            <p className="text-xl font-bold tracking-tight text-center">Scanning Item...</p>
          </div>
        )}
      </div>

      <p className="mt-8 text-white font-medium bg-white/10 backdrop-blur-md rounded-full px-6 py-2.5 text-sm shadow-sm border border-white/10">Position item in the frame</p>
    </motion.div>
  );
};
