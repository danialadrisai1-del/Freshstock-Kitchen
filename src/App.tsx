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
  Key,
  Menu,
  Edit2,
  User as UserIcon // Imported specifically from lucide-react
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
import { ScannedGrocery, analyzeGroceryImage } from './services/geminiService';
import { auth, db, googleProvider } from './firebase';
import { Logo } from './components/Logo';
import { ProfileSettings } from './components/ProfileSettings';

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
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [processingItems, setProcessingItems] = useState(0);
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

  const processCapturedImage = async (base64Data: string, fullImageData: string) => {
    setProcessingItems(prev => prev + 1);
    try {
      const { data: result, error } = await analyzeGroceryImage(base64Data);
      
      if (result) {
        await addItem({
          name: result.name,
          category: result.category,
          quantity: result.quantity,
          imageUrl: fullImageData,
          expiresAt: addDays(new Date(), result.suggestedExpiryDays).toISOString()
        });
      } else {
        alert("Failed to track item: " + error);
      }
    } catch (e) {
      console.error(e);
      alert("Error processing item.");
    } finally {
      setProcessingItems(prev => prev - 1);
    }
  };
  
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

  const editItem = async (id: string, updatedData: Partial<GroceryItem>) => {
    if (!user) throw new Error("No authenticated user.");
    
    const docRef = doc(db, 'users', user.uid, 'inventory', id);

    let timeoutId: NodeJS.Timeout;
    const savePromise = setDoc(docRef, updatedData, { merge: true });
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Database connection timed out.")), 8000);
    });

    try {
      await Promise.race([savePromise, timeoutPromise]);
      setEditingItem(null);
    } finally {
      if (timeoutId!) clearTimeout(timeoutId);
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
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-surface p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col items-center relative overflow-hidden border border-gray-100"
        >
          <Logo size={80} className="mb-6 shadow-sm" />
          
          <h1 className="text-3xl font-bold tracking-tight leading-none mb-3 text-dark">FreshStock</h1>
          <p className="text-dark-muted mb-8 font-medium max-w-[260px] text-base">Your smart, beautifully organized kitchen inventory.</p>

          <form onSubmit={handleEmailAuth} className="w-full space-y-4 mb-6">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors" size={20} strokeWidth={2} />
              <input 
                type="email"
                placeholder="Email address"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white transition-all text-dark font-medium placeholder:text-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors" size={20} strokeWidth={2} />
              <input 
                type="password"
                placeholder="Password"
                required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white transition-all text-dark font-medium placeholder:text-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {authMode === 'login' && (
              <div className="flex justify-end pr-2 pt-1">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button 
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full bg-brand text-white rounded-xl py-3.5 font-semibold text-lg hover:bg-brand-dark shadow-md shadow-brand/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
            >
              {isAuthSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  <span>{authMode === 'login' ? 'Logging in...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{authMode === 'login' ? 'Login' : 'Create Account'}</span>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 w-full mb-6">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">or</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>
          
          <button 
            type="button"
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-dark rounded-xl py-3.5 font-semibold hover:bg-gray-50 transition-all active:scale-[0.98] shadow-sm"
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
            className="mt-6 text-sm font-semibold text-gray-500 hover:text-dark transition-colors"
          >
            {authMode === 'login' ? "Don't have an account? Create one" : "Already have an account? Login"}
          </button>

          <AnimatePresence>
            {authError && (
              <motion.div 
                key="auth-error"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm w-full text-left flex gap-3 shadow-sm"
              >
                <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={18} strokeWidth={2.5} />
                <div className="flex-1">
                  <p className="font-bold mb-0.5">Authentication Error</p>
                  <p className="font-medium opacity-90">{authError}</p>
                </div>
                <button onClick={() => setAuthError(null)} className="shrink-0 pt-0.5 opacity-60 hover:opacity-100 transition-opacity">
                  <X size={16} strokeWidth={2.5} />
                </button>
              </motion.div>
            )}
            {authSuccess && (
              <motion.div 
                key="auth-success"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="mt-6 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-sm w-full text-left flex gap-3 shadow-sm"
              >
                <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-500" size={18} strokeWidth={2.5} />
                <div className="flex-1">
                  <p className="font-bold mb-0.5">Success</p>
                  <p className="font-medium opacity-90">{authSuccess}</p>
                </div>
                <button onClick={() => setAuthSuccess(null)} className="shrink-0 pt-0.5 opacity-60 hover:opacity-100 transition-opacity">
                  <X size={16} strokeWidth={2.5} />
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
    <div className="flex h-screen bg-bg overflow-hidden w-full relative">
      {/* Sidebar (Desktop) */}
      <aside className="w-[280px] bg-surface border-r border-gray-100 flex-col justify-between hidden md:flex shrink-0 z-20">
         <div className="p-6 pb-2">
            <div className="flex items-center gap-3 mb-8">
               <Logo size={40} />
               <div>
                  <h1 className="text-2xl font-bold tracking-tight text-dark leading-none">FreshStock</h1>
                  <p className="text-[10px] font-bold text-brand uppercase tracking-wider mt-1">Kitchen Inventory</p>
               </div>
            </div>
            
            <nav className="space-y-2">
               <div className="px-4 py-3 bg-brand-light/30 text-brand-dark rounded-xl font-bold flex items-center gap-3 border border-brand/10">
                  <Package size={20} className="text-brand" strokeWidth={2.5}/>
                  Inventory
               </div>
            </nav>
         </div>
         
         <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <button 
              onClick={() => setIsProfileSettingsOpen(true)}
              className="flex items-center gap-3 w-full p-2 hover:bg-gray-100/80 rounded-xl transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center shadow-sm group-hover:border-gray-300 transition-colors">
                 {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                    <UserIcon size={20} className="text-gray-400" strokeWidth={2.5} />
                 )}
              </div>
              <div className="flex-1 truncate">
                 <p className="font-bold text-dark text-sm truncate">{user.displayName || 'Kitchen User'}</p>
                 <p className="text-gray-500 text-xs font-semibold truncate">{user.email}</p>
              </div>
            </button>
         </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1 h-full relative overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-gray-100 z-10 shrink-0 shadow-sm">
           <div className="flex items-center gap-2">
              <Logo size={32} />
              <h1 className="text-xl font-bold tracking-tight text-dark leading-none">FreshStock</h1>
           </div>
           
           <button 
             onClick={() => setIsProfileSettingsOpen(true)}
             className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm"
           >
             {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
             ) : (
                <UserIcon size={20} className="text-gray-500" strokeWidth={2.5} />
             )}
           </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-32">
          <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Alerts Section */}
        {(expiringSoonCount > 0 || expiredCount > 0) && (
          <div className="flex flex-col md:flex-row gap-4">
            {expiringSoonCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-amber-50 border border-amber-100 p-5 rounded-2xl flex items-start gap-4 shadow-sm"
              >
                <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                  <AlertTriangle size={20} strokeWidth={2.5} />
                </div>
                <div className="pt-0.5">
                  <h3 className="font-bold text-amber-900">{expiringSoonCount} item{expiringSoonCount > 1 ? 's' : ''} expiring soon</h3>
                  <p className="text-sm text-amber-700 font-medium mt-0.5">Consume within the next 3 days.</p>
                </div>
              </motion.div>
            )}
            {expiredCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-red-50 border border-red-100 p-5 rounded-2xl flex items-start gap-4 shadow-sm"
              >
                <div className="p-2 bg-red-100 rounded-xl text-red-600">
                  <Clock size={20} strokeWidth={2.5} />
                </div>
                <div className="pt-0.5">
                  <h3 className="font-bold text-red-900">{expiredCount} item{expiredCount > 1 ? 's' : ''} expired</h3>
                  <p className="text-sm text-red-700 font-medium mt-0.5">Check before consuming or discard.</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Dashboard/Filter */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-dark">Inventory</h2>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(['all', 'fresh', 'expiring', 'expired'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
                    filter === f 
                    ? 'bg-dark text-white shadow-md' 
                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors" size={20} strokeWidth={2} />
            <input 
              className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-6 py-4 outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all text-dark font-medium shadow-sm placeholder:text-gray-400"
              type="text" 
              placeholder="Search your groceries..."
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
                    className="bg-surface p-5 rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all group flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex gap-4">
                        {item.imageUrl ? (
                          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden border border-gray-100 shrink-0">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy='no-referrer' />
                          </div>
                        ) : (
                          <div className="w-[72px] h-[72px] rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 shrink-0 border border-gray-100">
                            <UtensilsCrossed size={28} strokeWidth={2} />
                          </div>
                        )}
                        <div className="pt-1">
                          <h3 className="font-bold text-lg leading-tight text-dark capitalize">{item.name}</h3>
                          <p className="text-gray-500 text-sm font-medium mt-1">{item.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingItem(item)}
                          className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light/30 transition-colors rounded-xl"
                        >
                          <Edit2 size={18} strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors rounded-xl"
                        >
                          <Trash2 size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 py-3 px-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-dark font-semibold">
                        <Calendar size={16} className="text-gray-400" strokeWidth={2} />
                        <span>Exp {format(new Date(item.expiresAt), 'MMM dd')}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        item.status === 'expired' ? 'bg-red-100 text-red-700' :
                        item.status === 'expiring' ? 'bg-amber-100 text-amber-700' :
                        'bg-brand-light/50 text-brand-dark'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center space-y-4">
                  <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto text-gray-300 border border-gray-100">
                    <Filter size={32} strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-400">No items found</h3>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
        
        {/* Floating Action Buttons (Bottom Center) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/80 backdrop-blur-xl p-2 rounded-full shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-white/20 ring-1 ring-black/5">
           <button 
             onClick={() => setIsAddingManual(true)}
             className="flex items-center justify-center gap-2 px-5 md:px-6 py-3.5 rounded-full bg-gray-100 text-dark font-bold hover:bg-gray-200 transition-colors shrink-0"
           >
             <Plus size={20} strokeWidth={2.5} />
             <span className="hidden sm:inline">Manual</span>
           </button>
           <button 
             onClick={() => setIsScannerOpen(true)}
             className="flex items-center justify-center gap-2 px-6 md:px-8 py-3.5 rounded-full bg-brand text-white font-bold hover:bg-brand-dark transition-all shadow-md active:scale-[0.98] shrink-0 whitespace-nowrap"
           >
             <Camera size={20} className="text-white" strokeWidth={2.5} />
             <span>Scan Item</span>
           </button>
        </div>
      </div>

      {/* Item Form Dialog */}
      <AnimatePresence>
        {(isAddingManual || editingItem) && (
          <Dialog onClose={() => { setIsAddingManual(false); setEditingItem(null); }}>
            <GroceryItemForm 
              key={editingItem ? editingItem.id : 'add'}
              initialData={editingItem}
              onSubmit={async (data) => {
                if (editingItem) {
                  await editItem(editingItem.id, data);
                } else {
                  await addItem(data);
                }
                setIsAddingManual(false);
                setEditingItem(null);
              }} 
              onCancel={() => { setIsAddingManual(false); setEditingItem(null); }} 
            />
          </Dialog>
        )}
      </AnimatePresence>

      {/* Scanner */}
      <AnimatePresence>
        {isScannerOpen && (
          <Scanner 
            onCapture={processCapturedImage} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}
      </AnimatePresence>

      {/* Processing Toast */}
      <AnimatePresence>
        {processingItems > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 z-[100] flex items-center gap-3 bg-dark/90 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md"
          >
            <Loader2 className="animate-spin text-brand" size={18} strokeWidth={3} />
            <span className="font-bold text-sm tracking-wide">
              Analyzing {processingItems} item{processingItems !== 1 ? 's' : ''}...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Settings */}
      <AnimatePresence>
        {isProfileSettingsOpen && user && (
          <ProfileSettings 
            user={user} 
            onClose={() => setIsProfileSettingsOpen(false)} 
            onSignOut={() => {
              setIsProfileSettingsOpen(false);
              handleSignOut();
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Dialog({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-dark/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-surface w-full max-w-md rounded-[2rem] shadow-2xl p-8 overflow-hidden relative border border-gray-100"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:bg-gray-100 hover:text-dark rounded-full p-2 transition-all">
          <X size={20} strokeWidth={2.5} />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

interface GroceryItemFormProps {
  initialData?: GroceryItem | null;
  onSubmit: (data: any) => Promise<void> | void;
  onCancel: () => void;
}

const GroceryItemForm: React.FC<GroceryItemFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    quantity: initialData?.quantity || '1',
    category: initialData?.category || 'Produce',
    expiryDate: initialData?.expiresAt ? format(new Date(initialData.expiresAt), 'yyyy-MM-dd') : format(addDays(new Date(), 7), 'yyyy-MM-dd')
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
      if (!formData.expiryDate) {
        setSubmitError("Please select an expiry date.");
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);
      
      const [year, month, day] = formData.expiryDate.split('-').map(Number);
      const expiresAtDate = new Date(year, month - 1, day, 12, 0, 0);
      
      await onSubmit({
        name: formData.name,
        quantity: formData.quantity,
        category: formData.category,
        expiresAt: expiresAtDate.toISOString()
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
        <h2 className="text-3xl font-bold text-dark">{initialData ? 'Edit Item' : 'Add Item'}</h2>
        <p className="text-gray-500 text-sm font-medium">{initialData ? 'Update item details' : 'Manually input a stock item'}</p>
      </div>

      {submitError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm flex items-start gap-3 shadow-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" strokeWidth={2.5} />
          <p className="font-bold">{submitError}</p>
        </div>
      )}
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Item Name</label>
          <input 
            autoFocus
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white transition-all text-dark font-semibold"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Avocado, Milk..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Quantity</label>
            <input 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white transition-all text-dark font-semibold"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Expiry Date</label>
            <input 
              type="date"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white transition-all text-dark font-semibold h-[56px]"
              value={formData.expiryDate}
              onChange={e => setFormData({...formData, expiryDate: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500 ml-1">Category</label>
          <div className="relative">
            <select 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand focus:bg-white transition-all text-dark font-semibold appearance-none cursor-pointer"
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
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <ChevronRight size={18} className="rotate-90" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button disabled={isSubmitting} type="button" onClick={onCancel} className="flex-1 px-6 py-3.5 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors disabled:opacity-50">Cancel</button>
        <button 
          disabled={isSubmitting} 
          type="button" 
          onClick={(e) => { e.preventDefault(); handleSubmit(); }}
          onPointerUp={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex-1 px-6 py-3.5 rounded-xl bg-brand text-white font-bold hover:bg-brand-dark transition-all shadow-sm shadow-brand/20 disabled:opacity-50 active:scale-[0.98]"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </div>
  );
}

