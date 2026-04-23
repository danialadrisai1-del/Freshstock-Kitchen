import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { User as UserType, updateProfile, updatePassword } from 'firebase/auth';
import { X, LogOut, Loader2, Save, Trash2, Key, Image as ImageIcon, AlertTriangle } from 'lucide-react';

interface ProfileSettingsProps {
  user: UserType;
  onClose: () => void;
  onSignOut: () => void;
}

export function ProfileSettings({ user, onClose, onSignOut }: ProfileSettingsProps) {
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<'menu' | 'profile' | 'password'>('menu');

  const isGoogleSignIn = user.providerData.some(p => p.providerId === 'google.com');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile(user, { photoURL });
      setSuccess("Profile picture updated successfully!");
      setTimeout(() => setMode('menu'), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await updatePassword(user, newPassword);
      setSuccess("Password updated successfully!");
      setNewPassword('');
      setTimeout(() => setMode('menu'), 1500);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError("For security reasons, please log out and log back in before changing your password.");
      } else {
        setError(err.message || "Failed to update password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoURL(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-dark/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden relative border border-gray-100 flex flex-col"
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-dark flex items-center gap-2">
            {mode === 'menu' ? 'Profile Settings' : 
             mode === 'profile' ? 'Change Avatar' :
             'Change Password'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-200 hover:text-dark rounded-full p-2 transition-all">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm flex items-start gap-3 shadow-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" strokeWidth={2.5} />
              <p className="font-bold">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-sm font-bold shadow-sm">
              {success}
            </div>
          )}

          {mode === 'menu' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold text-xl uppercase shadow-sm">
                    {user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <p className="font-bold text-dark">{user.displayName || 'Kitchen User'}</p>
                  <p className="text-sm font-medium text-gray-500 truncate">{user.email}</p>
                </div>
              </div>

              <button onClick={() => { setMode('profile'); setError(null); setSuccess(null); }} className="flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors font-semibold text-dark text-left">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                  <ImageIcon size={18} strokeWidth={2.5} />
                </div>
                Change Profile Picture
              </button>

              {!isGoogleSignIn && (
                <button onClick={() => { setMode('password'); setError(null); setSuccess(null); }} className="flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors font-semibold text-dark text-left">
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                    <Key size={18} strokeWidth={2.5} />
                  </div>
                  Change Password
                </button>
              )}

              <button onClick={onSignOut} className="flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors font-semibold text-dark text-left">
                <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                  <LogOut size={18} strokeWidth={2.5} />
                </div>
                Log Out
              </button>
            </div>
          )}

          {mode === 'profile' && (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                {photoURL ? (
                  <img src={photoURL} alt="Preview" className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-sm" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold text-3xl uppercase shadow-sm">
                    {user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-gray-100 text-dark font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                >
                  Choose File...
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setMode('menu')} className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-colors flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Save
                </button>
              </div>
            </form>
          )}

          {mode === 'password' && (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">New Password</label>
                <input 
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white transition-all text-dark font-medium"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setMode('menu')} className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Update
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
