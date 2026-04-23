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
      <div className="min-h-screen bg-paper font-sans text-ink flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-surface p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-neutral-100 flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-[#fbf9f4] rounded-full flex items-center justify-center text-olive mb-6 overflow-hidden relative group border border-stone-200/50">
            <UtensilsCrossed size={32} className="absolute transition-transform group-hover:scale-110" />
          </div>
          
          <h1 className="text-4xl font-serif tracking-tight leading-none mb-3 text-ink">FreshStock</h1>
          <p className="text-ink-muted mb-8 leading-relaxed max-w-[260px]">Your smart, beautifully organized kitchen inventory.</p>

          <form onSubmit={handleEmailAuth} className="w-full space-y-4 mb-6">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted group-focus-within:text-olive transition-colors" size={20} />
              <input 
                type="email"
                placeholder="Email address"
                required
                className="w-full pl-12 pr-4 py-4 bg-[#fbf9f4] border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted group-focus-within:text-olive transition-colors" size={20} />
              <input 
                type="password"
                placeholder="Password"
                required
                className="w-full pl-12 pr-4 py-4 bg-[#fbf9f4] border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {authMode === 'login' && (
              <div className="flex justify-end pr-2">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-ink-muted hover:text-ink transition-colors uppercase tracking-widest font-sans"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button 
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full bg-olive text-white rounded-2xl py-4 font-medium hover:bg-olive-dark transition-all shadow-md shadow-olive/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAuthSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>{authMode === 'login' ? 'Logging in...' : 'Creating Account...'}</span>
                </>
              ) : (
                <span>{authMode === 'login' ? 'Login' : 'Create Account'}</span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 w-full mb-6 text-stone-300">
            <div className="h-px bg-stone-200 flex-1"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">or</span>
            <div className="h-px bg-stone-200 flex-1"></div>
          </div>
          
          <button 
            type="button"
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 text-ink rounded-2xl py-4 font-medium hover:bg-[#fbf9f4] transition-all active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError(null);
            }}
            className="mt-6 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
          >
            {authMode === 'login' ? "Don't have an account? Create one" : "Already have an account? Login"}
          </button>

          <AnimatePresence>
            {authError && (
              <motion.div 
                key="auth-error"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0,
                  x: [0, -10, 10, -10, 10, 0] 
                }}
                transition={{ 
                  x: { duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
                  opacity: { duration: 0.2 }
                }}
                className="mt-6 p-4 bg-terracotta/10 text-terracotta rounded-2xl text-sm w-full text-left flex gap-3 border border-terracotta/20 shadow-sm"
              >
                <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="font-bold mb-0.5">Authentication Issue</p>
                  <p className="opacity-90 leading-relaxed">{authError}</p>
                </div>
                <button 
                  onClick={() => setAuthError(null)}
                  className="shrink-0 p-1 hover:bg-terracotta/20 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
            {authSuccess && (
              <motion.div 
                key="auth-success"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mt-6 p-4 bg-olive/10 text-olive rounded-2xl text-sm w-full text-left flex gap-3 border border-olive/20 shadow-sm"
              >
                <CheckCircle2 className="shrink-0 mt-0.5" size={18} />
                <div className="flex-1">
                  <p className="font-bold mb-0.5">Success</p>
                  <p className="opacity-90 leading-relaxed">{authSuccess}</p>
                </div>
                <button 
                  onClick={() => setAuthSuccess(null)}
                  className="shrink-0 p-1 hover:bg-olive/20 rounded-lg transition-colors"
                >
                  <X size={14} />
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
    <div className="min-h-screen bg-paper font-sans text-ink pb-20">
      {/* Header */}
      <header className="bg-surface border-b border-stone-200 px-6 py-8 md:py-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-ink-muted font-medium tracking-tight uppercase text-xs">
                <UtensilsCrossed size={16} className="text-olive" />
                <span>FreshStock Kitchen</span>
              </div>
              <button 
                onClick={handleSignOut}
                className="md:hidden p-2 text-ink-muted hover:text-ink bg-[#fbf9f4] rounded-full transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-ink leading-none">
              Your Pantry, <br />
              <span className="italic text-olive">Perfectly Tracked</span>
            </h1>
          </div>
          
          <div className="flex gap-3 items-center">
            <button 
              onClick={() => setIsAddingManual(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#f4ebd8] text-[#5c4b2e] font-medium hover:bg-[#ebdcc1] transition-colors"
            >
              <Plus size={18} />
              <span>Add Manual</span>
            </button>
            <button 
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-olive text-surface font-medium hover:bg-olive-dark transition-all shadow-md shadow-olive/20 hover:shadow-lg active:scale-95"
            >
              <Camera size={18} />
              <span>Scan Item</span>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="hidden md:flex p-3 text-ink-muted hover:text-ink bg-[#fbf9f4] rounded-full hover:bg-stone-200 transition-colors ml-2"
              title="Sign out"
            >
              <LogOut size={18} />
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
                className="flex-1 bg-amber-50/50 border border-amber-200/60 p-6 rounded-[2rem] flex items-start gap-4 shadow-sm"
              >
                <div className="p-2 bg-amber-100/50 rounded-xl text-amber-700 border border-amber-200/50">
                  <AlertTriangle size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-xl text-amber-900">{expiringSoonCount} item{expiringSoonCount > 1 ? 's' : ''} expiring soon</h3>
                  <p className="text-sm text-amber-800/80 font-medium mt-0.5">Consume these within the next 3 days to avoid waste.</p>
                </div>
              </motion.div>
            )}
            {expiredCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-terracotta/5 border border-terracotta/10 p-6 rounded-[2rem] flex items-start gap-4 shadow-sm"
              >
                <div className="p-2 bg-terracotta/10 rounded-xl text-terracotta border border-terracotta/20">
                  <Clock size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-xl text-terracotta">{expiredCount} item{expiredCount > 1 ? 's' : ''} expired</h3>
                  <p className="text-sm text-terracotta/70 font-medium mt-0.5">Check these items before using them.</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Dashboard/Filter */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-serif italic text-ink">Inventory</h2>
            <div className="flex flex-wrap gap-2">
              {(['all', 'fresh', 'expiring', 'expired'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === f 
                    ? 'bg-olive text-surface ring-4 ring-olive/10' 
                    : 'bg-surface text-ink-muted hover:bg-stone-100 border border-stone-200 shadow-sm'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted group-focus-within:text-olive transition-colors" size={20} />
            <input 
              className="w-full bg-surface border border-stone-200 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-sm placeholder:text-stone-300"
              type="text" 
              placeholder="Search your stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-surface p-6 rounded-[2rem] border border-stone-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all group flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex gap-4">
                        {item.imageUrl ? (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-stone-100 shrink-0 shadow-inner">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy='no-referrer' />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-paper flex items-center justify-center text-stone-300 shrink-0 border border-stone-100">
                            <Package size={24} strokeWidth={1.5} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-serif font-bold text-xl leading-tight text-ink">{item.name}</h3>
                          <p className="text-ink-muted text-sm font-medium mt-0.5">{item.category}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-stone-300 hover:text-terracotta hover:bg-terracotta/10 transition-all rounded-xl"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4 py-3 px-4 bg-paper rounded-2xl border border-stone-100/50">
                      <div className="flex items-center gap-2 text-sm text-ink-muted font-medium">
                        <Calendar size={16} className="opacity-70" />
                        <span>Exp {format(new Date(item.expiresAt), 'MMM dd')}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        item.status === 'expired' ? 'bg-terracotta/10 text-terracotta' :
                        item.status === 'expiring' ? 'bg-amber-100 text-amber-700' :
                        'bg-olive-light/10 text-olive-dark'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-paper rounded-full flex items-center justify-center mx-auto text-stone-300 border border-stone-200">
                    <Filter size={32} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-serif text-ink-muted">No items found</h3>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/20 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 overflow-hidden relative border border-stone-200/50"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-stone-400 hover:text-ink transition-colors">
          <X size={24} />
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
    <div className="space-y-5">
      {submitError && (
        <div className="p-4 bg-terracotta/10 text-terracotta rounded-2xl text-sm border border-terracotta/20 flex items-start gap-3 shadow-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p className="font-medium">{submitError}</p>
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-ink-muted ml-1">Item Name</label>
          <input 
            autoFocus
            className="w-full bg-[#fbf9f4] border border-stone-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="Milk, Eggs, etc."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-muted ml-1">Quantity</label>
            <input 
              className="w-full bg-[#fbf9f4] border border-stone-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-muted ml-1">Expires in (Days)</label>
            <input 
              type="number"
              className="w-full bg-[#fbf9f4] border border-stone-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]"
              value={formData.expiryDays}
              onChange={e => setFormData({...formData, expiryDays: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-ink-muted ml-1">Category</label>
          <select 
            className="w-full bg-[#fbf9f4] border border-stone-200 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive transition-all text-ink shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] appearance-none"
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
        <button disabled={isSubmitting} type="button" onClick={onCancel} className="flex-1 px-6 py-4 rounded-2xl bg-paper border border-stone-200 text-ink font-medium hover:bg-stone-200 transition-colors disabled:opacity-50">Cancel</button>
        <button 
          disabled={isSubmitting} 
          type="button" 
          onClick={(e) => { e.preventDefault(); handleSubmit(); }}
          onPointerUp={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex-1 px-6 py-4 rounded-2xl bg-olive text-surface font-medium hover:bg-olive-dark transition-all shadow-md shadow-olive/20 disabled:opacity-50 active:scale-95"
        >
          {isSubmitting ? 'Adding...' : 'Add Item'}
        </button>
      </div>
    </div>
  );
}

