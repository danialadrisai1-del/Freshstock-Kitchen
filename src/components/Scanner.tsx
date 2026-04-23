import React, { useRef, useState } from 'react';
import { Camera, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerProps {
  onCapture: (base64Data: string, image: string) => void;
  onClose: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Please enable camera permissions or check if another app is using the camera.");
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
    
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const fullImageData = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = fullImageData.split(',')[1];

    if (!base64Data || base64Data.length < 100) {
      setError("Captured image is empty. Please try again.");
      return;
    }

    onCapture(base64Data, fullImageData);
    
    // Show brief flash feedback
    setFlash(true);
    setTimeout(() => setFlash(false), 800);
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
        className="absolute top-6 right-6 text-white/70 bg-white/10 hover:bg-white/20 hover:text-white rounded-full p-3 transition-colors z-[60]"
      >
        <X size={24} strokeWidth={2.5} />
      </button>

      <div className="relative w-full max-w-sm aspect-[3/4] bg-dark-muted rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 ring-4 ring-white/5">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/60 backdrop-blur-md text-white">
            <AlertTriangle className="text-amber-400 mb-4" size={48} />
            <p className="font-bold mb-6">{error}</p>
            <button 
              onClick={() => {
                setError(null);
                startCamera(); // Re-ensure camera
              }}
              className="px-6 py-2 bg-brand text-white rounded-xl font-bold hover:bg-brand-dark transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover"
          />
        )}
        
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner overlay box */}
        {!error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[70%] aspect-square border-2 border-white/40 rounded-3xl relative transition-transform duration-300">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-3xl -mt-[2px] -ml-[2px]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-3xl -mt-[2px] -mr-[2px]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-3xl -mb-[2px] -ml-[2px]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-3xl -mb-[2px] -mr-[2px]" />
            </div>
          </div>
        )}

        {/* Snap Flash Indicator */}
        <AnimatePresence>
          {flash && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand/20 backdrop-blur-[2px] flex items-center justify-center z-10"
            >
               <motion.div 
                 initial={{ y: 20 }}
                 animate={{ y: 0 }}
                 className="bg-brand text-white px-6 py-4 rounded-full flex items-center gap-3 font-bold shadow-2xl"
               >
                 <CheckCircle2 size={24} strokeWidth={3} />
                 Added to Queue!
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

          <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center bg-gradient-to-t from-dark/90 to-transparent z-20">
          <button
            onClick={captureImage}
            className="w-20 h-20 rounded-full bg-brand flex items-center justify-center hover:bg-brand-dark active:scale-[0.8] transition-all border-4 border-white shadow-[0_0_40px_rgba(255,71,19,0.5)]"
          >
            <Camera size={32} className="text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <p className="mt-8 text-white font-bold bg-white/10 backdrop-blur-md rounded-full px-6 py-3 text-sm shadow-sm border border-white/10">Position item & snap to queue</p>
    </motion.div>
  );
};
