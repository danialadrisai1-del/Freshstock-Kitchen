/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Camera, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Package, 
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  UtensilsCrossed,
  X,
  LogOut,
  Loader2,
  Mail,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isPast, isBefore, differenceInDays } from 'date-fns';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

import { GroceryItem } from './types';
import { Scanner } from './components/Scanner';
import { ScannedGrocery } from './services/geminiService';
import { auth, db, googleProvider } from './firebase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'fresh' | 'expiring' | 'expired'>('all');

  // Handle Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Items from Firestore when User is logged in
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const itemsRef = collection(db, 'users', user.uid, 'inventory');
    const q = query(itemsRef, orderBy('addedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GroceryItem[];
      setItems(fetchedItems);
    }, (error) => {
      console.error("Error fetching inventory: ", error);
    });

    return () => unsubscribe();
  }, [user]);
  
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError("Please fill in both email and password.");
      return;
    }
    
    setIsAuthSubmitting(true);
    setAuthError(null);
    
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Email authentication error: ", error);
      let message = error.message || "Authentication failed.";
      if (error.code === 'auth/user-not-found') message = "No account found with this email.";
      if (error.code === 'auth/wrong-password') message = "Incorrect password.";
      if (error.code === 'auth/email-already-in-use') message = "This email is already registered.";
      if (error.code === 'auth/weak-password') message = "Password should be at least 6 characters.";
      if (error.code === 'auth/invalid-email') message = "Please enter a valid email address.";
      setAuthError(message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError("Please enter your email address first.");
      return;
    }
    
    setIsAuthSubmitting(true);
    setAuthError(null);
    setAuthSuccess(null);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthSuccess("Password reset link sent! Please check your inbox.");
    } catch (error: any) {
      console.error("Password reset error: ", error);
      let message = error.message || "Failed to send reset email.";
      if (error.code === 'auth/user-not-found') message = "No account found with this email.";
      if (error.code === 'auth/invalid-email') message = "Please enter a valid email address.";
      setAuthError(message);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Authentication error: ", error);
      
      // Provide a friendlier message for common iframe/domain errors
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("Unauthorized domain. Please add this app's URL to your Firebase Authorized Domains in the Firebase Console.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in popup was closed before completion.");
      } else if (error.message && error.message.includes('missing initial state')) {
        setAuthError("Browser storage is blocked inside this preview window. To log in, please click the settings gear (top right of this preview) and select 'Open App in new tab'.");
      } else {
        setAuthError(error.message || "Failed to sign in. The preview environment might be blocking popups. Try opening the app in a new tab.");
      }
    }
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const addItem = async (itemData: Partial<GroceryItem>) => {
    if (!user) throw new Error("No authenticated user.");
    
    const docRef = doc(collection(db, 'users', user.uid, 'inventory'));
    const newItem: GroceryItem = {
      id: docRef.id,
      name: itemData.name || 'Unknown Item',
      quantity: itemData.quantity || '1 unit',
      category: itemData.category || 'Other',
      addedAt: new Date().toISOString(),
      expiresAt: itemData.expiresAt || addDays(new Date(), 7).toISOString(),
      imageUrl: itemData.imageUrl || null, 
      status: 'fresh'
    };
    
    // We do NOT suppress the error here so that the form UI can display it
    // Firebase hangs indefinitely if the DB doesn't exist, so we add a timeout.
    let timeoutId: NodeJS.Timeout;
    const savePromise = setDoc(docRef, newItem);
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Database connection timed out. Did you click 'Create database' in the Firebase Console?")), 8000);
    });

    try {
      await Promise.race([savePromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }

    setIsAddingManual(false);
    setIsScannerOpen(false); // Close scanner on successful save
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'inventory', id));
    } catch (error) {
      console.error("Error deleting item: ", error);
    }
  };

  const getStatus = (expiryDate: string): 'fresh' | 'expiring' | 'expired' => {
    const date = new Date(expiryDate);
    if (isPast(date)) return 'expired';
    if (differenceInDays(date, new Date()) <= 3) return 'expiring';
    return 'fresh';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="animate-spin text-ink-muted" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg font-sans text-dark flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-surface p-10 rounded-[2rem] border-[3px] border-dark shadow-[8px_8px_0px_#121212] flex flex-col items-center relative overflow-hidden"
        >
          <div className="w-20 h-20 bg-secondary rounded-[1rem] border-[3px] border-dark shadow-[4px_4px_0px_#121212] flex items-center justify-center text-dark mb-8 overflow-hidden relative group">
            <UtensilsCrossed size={36} className="absolute transition-transform group-hover:scale-110" strokeWidth={2.5} />
          </div>
          
          <h1 className="text-4xl font-black tracking-tight leading-none mb-3 text-dark font-sans uppercase">FreshStock</h1>
          <p className="text-dark/70 mb-8 font-medium max-w-[260px] text-lg">Your super-smart kitchen inventory.</p>

          <form onSubmit={handleEmailAuth} className="w-full space-y-5 mb-6">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/40 group-focus-within:text-dark transition-colors" size={20} strokeWidth={2.5} />
              <input 
                type="email"
                placeholder="Email address"
                required
                className="w-full pl-12 pr-4 py-4 bg-surface border-[3px] border-dark rounded-xl outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0px_#121212] focus:bg-[#EAE8FC] transition-all text-dark font-bold placeholder:text-dark/40"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/40 group-focus-within:text-dark transition-colors" size={20} strokeWidth={2.5} />
              <input 
                type="password"
                placeholder="Password"
                required
                className="w-full pl-12 pr-4 py-4 bg-surface border-[3px] border-dark rounded-xl outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0px_#121212] focus:bg-[#EAE8FC] transition-all text-dark font-bold placeholder:text-dark/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {authMode === 'login' && (
              <div className="flex justify-end pr-2">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-xs font-black text-dark/70 hover:text-accent transition-colors uppercase tracking-widest font-mono"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button 
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full bg-accent text-white border-[3px] border-dark rounded-xl py-4 font-black uppercase tracking-wide hover:-translate-y-1 hover:shadow-[6px_6px_0px_#121212] transition-all active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2 mt-2"
            >
              {isAuthSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>{authMode === 'login' ? 'LOGGING IN...' : 'CREATING...'}</span>
                </>
              ) : (
                <span>{authMode === 'login' ? 'Login' : 'Create Account'}</span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 w-full mb-6 text-dark/20">
            <div className="h-[3px] bg-dark/10 flex-1"></div>
            <span className="text-[12px] font-black uppercase tracking-widest text-dark/40">OR</span>
            <div className="h-[3px] bg-dark/10 flex-1"></div>
          </div>
          
          <button 
            type="button"
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-surface border-[3px] border-dark text-dark rounded-xl py-4 font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all active:translate-y-0 active:shadow-none"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            CONTINUE WITH GOOGLE
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError(null);
            }}
            className="mt-6 text-sm font-bold text-dark/50 hover:text-dark transition-colors inline-block border-b-[2px] border-transparent hover:border-dark pb-0.5"
          >
            {authMode === 'login' ? "DON'T HAVE AN ACCOUNT?" : "ALREADY HAVE AN ACCOUNT?"}
          </button>

          <AnimatePresence>
            {authError && (
              <motion.div 
                key="auth-error"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: [0, -10, 10, -10, 10, 0] }}
                transition={{ x: { duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }, opacity: { duration: 0.2 } }}
                className="mt-6 p-4 bg-primary text-white rounded-xl border-[3px] border-dark text-sm w-full text-left flex gap-3 shadow-[4px_4px_0px_#121212]"
              >
                <AlertTriangle className="shrink-0 mt-0.5" size={18} strokeWidth={3} />
                <div className="flex-1">
                  <p className="font-black mb-0.5 font-mono">ERROR</p>
                  <p className="font-medium">{authError}</p>
                </div>
                <button onClick={() => setAuthError(null)} className="shrink-0 pt-0.5">
                  <X size={16} strokeWidth={3} />
                </button>
              </motion.div>
            )}
            {authSuccess && (
              <motion.div 
                key="auth-success"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mt-6 p-4 bg-secondary text-dark rounded-xl border-[3px] border-dark text-sm w-full text-left flex gap-3 shadow-[4px_4px_0px_#121212]"
              >
                <CheckCircle2 className="shrink-0 mt-0.5" size={18} strokeWidth={3} />
                <div className="flex-1">
                  <p className="font-black mb-0.5 font-mono">SUCCESS</p>
                  <p className="font-bold">{authSuccess}</p>
                </div>
                <button onClick={() => setAuthSuccess(null)} className="shrink-0 pt-0.5">
                  <X size={16} strokeWidth={3} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  const filteredItems = items
    .map(item => ({ ...item, status: getStatus(item.expiresAt) }))
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === 'all' || item.status === filter;
      return matchesSearch && matchesFilter;
    });

  const expiringSoonCount = items.filter(i => getStatus(i.expiresAt) === 'expiring').length;
  const expiredCount = items.filter(i => getStatus(i.expiresAt) === 'expired').length;

  return (
    <div className="min-h-screen bg-bg font-sans text-dark pb-20 selection:bg-secondary">
      {/* Header */}
      <header className="bg-surface border-b-[3px] border-dark px-6 py-6 md:py-8 sticky top-0 z-10 shadow-[0_4px_0px_rgba(18,18,18,0.05)]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-secondary text-dark font-black tracking-widest uppercase text-[10px] px-3 py-1 rounded-md border-2 border-dark shadow-[2px_2px_0px_#121212]">
                <UtensilsCrossed size={14} strokeWidth={3} />
                <span>SUPER PANTRY APP</span>
              </div>
              <button 
                onClick={handleSignOut}
                className="md:hidden p-2 text-dark bg-white border-2 border-dark rounded-xl shadow-[2px_2px_0px_#121212] active:translate-y-px active:shadow-none transition-all"
                title="Sign out"
              >
                <LogOut size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-dark leading-none uppercase">
              Fresh<span className="text-primary">Stock</span>
            </h1>
          </div>
          
          <div className="flex gap-3 items-center">
            <button 
              onClick={() => setIsAddingManual(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface border-[3px] border-dark text-dark font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all active:translate-y-0 active:shadow-none uppercase"
            >
              <Plus size={20} strokeWidth={3} />
              <span>MANUAL</span>
            </button>
            <button 
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-accent text-white border-[3px] border-dark font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all active:translate-y-0 active:shadow-none uppercase tracking-wide"
            >
              <Camera size={20} strokeWidth={3} />
              <span>SCAN</span>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="hidden md:flex p-3 text-dark bg-white border-[3px] border-dark rounded-xl hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all active:translate-y-0 active:shadow-none ml-2"
              title="Sign out"
            >
              <LogOut size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-12 space-y-12">
        {/* Alerts Section */}
        {(expiringSoonCount > 0 || expiredCount > 0) && (
          <div className="flex flex-col md:flex-row gap-4">
            {expiringSoonCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-secondary border-[3px] border-dark p-6 rounded-[2rem] flex items-start gap-4 shadow-[4px_4px_0px_#121212]"
              >
                <div className="p-2 bg-surface rounded-xl text-dark border-2 border-dark shadow-[2px_2px_0px_#121212]">
                  <AlertTriangle size={20} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="font-sans font-black text-xl text-dark uppercase">{expiringSoonCount} item{expiringSoonCount > 1 ? 's' : ''} expiring soon</h3>
                  <p className="text-sm text-dark font-medium mt-1">Consume these within the next 3 days to avoid waste.</p>
                </div>
              </motion.div>
            )}
            {expiredCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-primary border-[3px] border-dark p-6 rounded-[2rem] flex items-start gap-4 shadow-[4px_4px_0px_#121212]"
              >
                <div className="p-2 bg-surface rounded-xl text-primary border-2 border-dark shadow-[2px_2px_0px_#121212]">
                  <Clock size={20} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="font-sans font-black text-xl text-white uppercase">{expiredCount} item{expiredCount > 1 ? 's' : ''} expired</h3>
                  <p className="text-sm text-white font-bold mt-1">Check these items before using them.</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Dashboard/Filter */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-3xl font-black text-dark uppercase">Inventory</h2>
            <div className="flex flex-wrap gap-2">
              {(['all', 'fresh', 'expiring', 'expired'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all border-2 border-dark ${
                    filter === f 
                    ? 'bg-accent text-white shadow-[2px_2px_0px_#121212] translate-x-[-2px] translate-y-[-2px]' 
                    : 'bg-surface text-dark shadow-[2px_2px_0px_transparent] hover:bg-bg hover:shadow-[2px_2px_0px_#121212] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-dark/40 group-focus-within:text-dark transition-colors" size={24} strokeWidth={3} />
            <input 
              className="w-full bg-surface border-[3px] border-dark rounded-2xl pl-16 pr-6 py-5 outline-none focus:-translate-y-1 focus:shadow-[6px_6px_0px_#121212] transition-all text-dark font-bold text-lg placeholder:text-dark/40"
              type="text" 
              placeholder="Search your stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface p-6 rounded-[2rem] border-[3px] border-dark shadow-[4px_4px_0px_#121212] hover:-translate-y-1 hover:shadow-[8px_8px_0px_#121212] transition-all group flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex gap-4">
                        {item.imageUrl ? (
                          <div className="w-16 h-16 rounded-xl overflow-hidden border-[3px] border-dark shrink-0">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy='no-referrer' />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-bg flex items-center justify-center text-dark shrink-0 border-[3px] border-dark">
                            <Package size={32} strokeWidth={2.5} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-sans font-black text-2xl leading-tight text-dark uppercase">{item.name}</h3>
                          <p className="text-dark/60 font-mono text-sm font-bold mt-1 uppercase tracking-wider">{item.category}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-dark bg-surface border-2 border-transparent hover:border-dark hover:bg-primary hover:text-white transition-all rounded-xl hover:shadow-[2px_2px_0px_#121212]"
                      >
                        <Trash2 size={24} strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4 py-3 px-4 bg-bg rounded-xl border-[3px] border-dark">
                      <div className="flex items-center gap-2 text-sm text-dark font-black tracking-widest font-mono uppercase">
                        <Calendar size={18} strokeWidth={3} />
                        <span>EXP {format(new Date(item.expiresAt), 'MMM dd')}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest border-2 border-dark ${
                        item.status === 'expired' ? 'bg-primary text-white' :
                        item.status === 'expiring' ? 'bg-secondary text-dark' :
                        'bg-surface text-dark'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-24 h-24 bg-surface rounded-[2rem] flex items-center justify-center mx-auto text-dark border-[3px] border-dark shadow-[4px_4px_0px_#121212]">
                    <Filter size={40} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-2xl font-black text-dark/40 uppercase tracking-widest">No items found</h3>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Manual Add Dialog */}
      <AnimatePresence>
        {isAddingManual && (
          <Dialog onClose={() => setIsAddingManual(false)}>
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-serif tracking-tight text-ink">Manual Add</h2>
                <p className="text-ink-muted text-sm">Enter the details of your grocery item</p>
              </div>
              <ManualAddForm onSubmit={addItem} onCancel={() => setIsAddingManual(false)} />
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Scanner */}
      <AnimatePresence>
        {isScannerOpen && (
          <Scanner 
            onScan={async (data, image) => {
              await addItem({
                name: data.name,
                category: data.category,
                quantity: data.quantity,
                imageUrl: image,
                expiresAt: addDays(new Date(), data.suggestedExpiryDays).toISOString()
              });
            }} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Dialog({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-dark/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface w-full max-w-md rounded-[2.5rem] border-[3px] border-dark shadow-[12px_12px_0px_#121212] p-8 overflow-hidden relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-dark hover:bg-dark hover:text-white border-2 border-transparent hover:border-dark rounded-lg p-1 transition-all">
          <X size={24} strokeWidth={3} />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

function ManualAddForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void> | void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    quantity: '1',
    category: 'Pantry',
    expiryDays: '7'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        setSubmitError("Please enter an item name.");
        return;
      }
      if (!formData.quantity.trim()) {
        setSubmitError("Please enter a quantity.");
        return;
      }
      if (!formData.expiryDays || isNaN(parseInt(formData.expiryDays))) {
        setSubmitError("Please enter a valid number of days for expiry.");
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      
      await onSubmit({
        name: formData.name,
        quantity: formData.quantity,
        category: formData.category,
        expiresAt: addDays(new Date(), parseInt(formData.expiryDays)).toISOString()
      });
      
    } catch (err: any) {
       console.error("Submit error caught:", err);
       setSubmitError(err.message || 'Failed to communicate with Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-4xl font-black uppercase text-dark">Add Manual</h2>
      </div>

      {submitError && (
        <div className="p-4 bg-primary text-white rounded-xl border-[3px] border-dark text-sm flex items-start gap-3 shadow-[4px_4px_0px_#121212]">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" strokeWidth={3} />
          <p className="font-bold">{submitError}</p>
        </div>
      )}
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-dark ml-1 font-mono">Item Name</label>
          <input 
            autoFocus
            className="w-full bg-surface border-[3px] border-dark rounded-xl px-4 py-4 outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0px_#121212] focus:bg-bg transition-all text-dark font-bold"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Milk, Eggs..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-dark ml-1 font-mono">Quantity</label>
            <input 
              className="w-full bg-surface border-[3px] border-dark rounded-xl px-4 py-4 outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0px_#121212] focus:bg-bg transition-all text-dark font-bold"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-dark ml-1 font-mono">Expires (Days)</label>
            <input 
              type="number"
              className="w-full bg-surface border-[3px] border-dark rounded-xl px-4 py-4 outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0px_#121212] focus:bg-bg transition-all text-dark font-bold"
              value={formData.expiryDays}
              onChange={e => setFormData({...formData, expiryDays: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-dark ml-1 font-mono">Category</label>
          <select 
            className="w-full bg-surface border-[3px] border-dark rounded-xl px-4 py-4 outline-none focus:-translate-y-1 focus:shadow-[4px_4px_0px_#121212] focus:bg-bg transition-all text-dark font-bold appearance-none cursor-pointer"
            value={formData.category}
            onChange={e => setFormData({...formData, category: e.target.value})}
          >
            <option>Produce</option>
            <option>Dairy</option>
            <option>Meat</option>
            <option>Pantry</option>
            <option>Frozen</option>
            <option>Beverages</option>
             <option>Other</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button disabled={isSubmitting} type="button" onClick={onCancel} className="flex-1 px-6 py-4 rounded-xl bg-surface border-[3px] border-dark text-dark font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all disabled:opacity-50 uppercase tracking-widest text-sm">Cancel</button>
        <button 
          disabled={isSubmitting} 
          type="button" 
          onClick={(e) => { e.preventDefault(); handleSubmit(); }}
          onPointerUp={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex-1 px-6 py-4 rounded-xl bg-accent border-[3px] border-dark text-white font-black hover:-translate-y-1 hover:shadow-[4px_4px_0px_#121212] transition-all disabled:opacity-50 uppercase tracking-widest text-sm"
        >
          {isSubmitting ? 'WORKING...' : 'ADD ITEM'}
        </button>
      </div>
    </div>
  );
}

