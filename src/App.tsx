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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isPast, isBefore, differenceInDays } from 'date-fns';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

import { GroceryItem } from './types';
import { Scanner } from './components/Scanner';
import { ScannedGrocery } from './services/geminiService';
import { auth, db, googleProvider } from './firebase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
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
  
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Authentication error: ", error);
      
      // Provide a friendlier message for common iframe/domain errors
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("Unauthorized domain. Please add this app's URL to your Firebase Authorized Domains.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in popup was closed before completion.");
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
      imageUrl: itemData.imageUrl,
      status: 'fresh'
    };
    
    // We do NOT suppress the error here so that the form UI can display it
    // Firebase hangs indefinitely if the DB doesn't exist, so we add a timeout.
    const savePromise = setDoc(docRef, newItem);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database connection timed out. Did you click 'Create database' in the Firebase Console?")), 8000);
    });

    await Promise.race([savePromise, timeoutPromise]);

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
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <Loader2 className="animate-spin text-neutral-400" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] font-sans text-neutral-900 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-neutral-100 flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-neutral-100 rounded-3xl flex items-center justify-center text-neutral-800 mb-8 overflow-hidden relative group">
            <UtensilsCrossed size={36} className="absolute transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 border-2 border-neutral-900/10 rounded-3xl"></div>
          </div>
          
          <h1 className="text-4xl font-serif tracking-tight leading-none mb-3">FreshStock</h1>
          <p className="text-neutral-500 mb-10 leading-relaxed">Your smart, AI-powered kitchen inventory. Keep track of what you have and what's expiring soon.</p>
          
          <button 
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-neutral-950 text-white rounded-full py-4 font-medium hover:bg-neutral-800 transition-all shadow-xl active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          {authError && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm w-full text-left flex gap-3 border border-red-100">
              <AlertTriangle className="shrink-0" size={18} />
              <p>{authError}</p>
            </div>
          )}
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
    <div className="min-h-screen bg-[#F5F5F0] font-sans text-neutral-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-8 md:py-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-neutral-400 font-medium tracking-tight uppercase text-xs">
                <UtensilsCrossed size={16} />
                <span>FreshStock Kitchen</span>
              </div>
              <button 
                onClick={handleSignOut}
                className="md:hidden p-2 text-neutral-400 hover:text-neutral-900 bg-neutral-50 rounded-full"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-neutral-900 leading-none">
              Your Pantry, <br />
              <span className="italic">Perfectly Tracked</span>
            </h1>
          </div>
          
          <div className="flex gap-3 items-center">
            <button 
              onClick={() => setIsAddingManual(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-neutral-100 font-medium hover:bg-neutral-200 transition-colors"
            >
              <Plus size={18} />
              <span>Add Manual</span>
            </button>
            <button 
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-neutral-950 text-white font-medium hover:bg-neutral-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <Camera size={18} />
              <span>Scan Item</span>
            </button>
            
            <button 
              onClick={handleSignOut}
              className="hidden md:flex p-3 text-neutral-400 hover:text-neutral-900 bg-neutral-50 rounded-full hover:bg-neutral-200 transition-colors ml-2"
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
                className="flex-1 bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-start gap-4"
              >
                <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">{expiringSoonCount} item{expiringSoonCount > 1 ? 's' : ''} expiring soon</h3>
                  <p className="text-sm text-amber-700 opacity-80">Consume these within the next 3 days to avoid waste.</p>
                </div>
              </motion.div>
            )}
            {expiredCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-red-50 border border-red-200 p-6 rounded-3xl flex items-start gap-4"
              >
                <div className="p-2 bg-red-100 rounded-xl text-red-600">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">{expiredCount} item{expiredCount > 1 ? 's' : ''} expired</h3>
                  <p className="text-sm text-red-700 opacity-80">Check these items before using them.</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Dashboard/Filter */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-serif italic text-neutral-800">Inventory</h2>
            <div className="flex flex-wrap gap-2">
              {(['all', 'fresh', 'expiring', 'expired'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    filter === f 
                    ? 'bg-neutral-900 text-white ring-4 ring-neutral-900/10' 
                    : 'bg-white text-neutral-500 hover:bg-neutral-200 border border-neutral-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search your stock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-2xl py-4 pl-12 pr-6 outline-none focus:ring-4 focus:ring-neutral-900/5 focus:border-neutral-900 transition-all text-neutral-900 placeholder:text-neutral-300"
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
                    className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex gap-4">
                        {item.imageUrl ? (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-neutral-100 shrink-0">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy='no-referrer' />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-300 shrink-0">
                            <Package size={24} />
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                          <p className="text-neutral-400 text-sm font-medium">{item.category}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4 py-3 px-4 bg-neutral-50 rounded-2xl">
                      <div className="flex items-center gap-2 text-sm text-neutral-500 font-medium">
                        <Calendar size={16} />
                        <span>Exp {format(new Date(item.expiresAt), 'MMM dd')}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        item.status === 'expired' ? 'bg-red-100 text-red-600' :
                        item.status === 'expiring' ? 'bg-amber-100 text-amber-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                    <Filter size={32} />
                  </div>
                  <h3 className="text-xl font-medium text-neutral-400">No items found</h3>
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
                <h2 className="text-2xl font-serif tracking-tight">Manual Add</h2>
                <p className="text-neutral-500 text-sm">Enter the details of your grocery item</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 overflow-hidden relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-neutral-400 hover:text-neutral-900">
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

  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        await onSubmit({
          name: formData.name,
          quantity: formData.quantity,
          category: formData.category,
          expiresAt: addDays(new Date(), parseInt(formData.expiryDays)).toISOString()
        });
      } catch (err: any) {
         setSubmitError(err.message || 'Failed to communicate with Firebase.');
      } finally {
        setIsSubmitting(false);
      }
    }}>
      {submitError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm border border-red-100 flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>{submitError}</p>
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1">Item Name</label>
          <input 
            autoFocus
            required
            className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-neutral-900/5 focus:border-neutral-900 transition-all"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="Milk, Eggs, etc."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1">Quantity</label>
            <input 
              required
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-neutral-900/5 focus:border-neutral-900 transition-all"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1">Expires in (Days)</label>
            <input 
              type="number"
              required
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-neutral-900/5 focus:border-neutral-900 transition-all"
              value={formData.expiryDays}
              onChange={e => setFormData({...formData, expiryDays: e.target.value})}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1">Category</label>
          <select 
            className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-neutral-900/5 focus:border-neutral-900 transition-all"
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
        <button disabled={isSubmitting} type="button" onClick={onCancel} className="flex-1 px-6 py-4 rounded-2xl bg-neutral-100 font-bold hover:bg-neutral-200 transition-colors disabled:opacity-50">Cancel</button>
        <button disabled={isSubmitting} type="submit" className="flex-1 px-6 py-4 rounded-2xl bg-neutral-950 text-white font-bold hover:bg-neutral-800 transition-colors disabled:opacity-50">
          {isSubmitting ? 'Adding...' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

