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
      className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center p-6"
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-dark bg-surface border-[3px] border-dark rounded-xl p-2 hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all"
      >
        <X size={28} strokeWidth={3} />
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] bg-dark rounded-[2rem] overflow-hidden shadow-[8px_8px_0px_#121212] border-[3px] border-dark">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center p-8 bg-primary">
            <p className="text-white font-black text-xl">{error}</p>
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

        <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center bg-gradient-to-t from-dark/90 via-dark/50 to-transparent">
          <button
            onClick={captureImage}
            disabled={isAnalyzing}
            className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center border-[3px] border-dark hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin text-dark" size={32} strokeWidth={3} />
            ) : (
              <Camera size={32} className="text-dark" strokeWidth={2.5} />
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-sm flex flex-col items-center justify-center text-secondary p-8">
            <Loader2 className="animate-spin mb-4" size={56} strokeWidth={3} />
            <p className="text-2xl font-black font-sans uppercase tracking-tight text-center text-white">Identifying...</p>
          </div>
        )}
      </div>

      <p className="mt-8 text-dark font-black tracking-widest uppercase text-sm border-2 border-dark rounded-full px-6 py-2 bg-white shadow-[2px_2px_0px_#121212]">Point camera at grocery item</p>
    </motion.div>
  );
};
