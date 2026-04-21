import React, { useRef, useState } from 'react';
import { Camera, X, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeGroceryImage, ScannedGrocery } from '../services/geminiService';

interface ScannerProps {
  onScan: (data: ScannedGrocery, image: string) => void;
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
    setIsAnalyzing(false);

    if (result) {
      onScan(result, fullImageData);
    } else {
      setError("Could not identify the item. Please try again.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4"
    >
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
      >
        <X size={32} />
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center p-8 text-neutral-400">
            {error}
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

        <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
          <button
            onClick={captureImage}
            disabled={isAnalyzing}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin text-black" size={32} />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-black/10" />
            )}
          </button>
        </div>

        {isAnalyzing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white p-8">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="text-lg font-medium text-center">AI is identifying your grocery...</p>
          </div>
        )}
      </div>

      <p className="mt-8 text-white/50 text-sm">Point the camera at your grocery item</p>
    </motion.div>
  );
};
