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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, addDays, isPast, isBefore, differenceInDays } from 'date-fns';
import { GroceryItem } from './types';
import { Scanner } from './components/Scanner';
import { ScannedGrocery } from './services/geminiService';

export default function App() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'fresh' | 'expiring' | 'expired'>('all');

  // Load from storage
  useEffect(() => {
    const saved = localStorage.getItem('fresh-stock-items');
    if (saved) {
      setItems(JSON.parse(saved));
    }
  }, []);

  // Save to storage
  useEffect(() => {
    localStorage.setItem('fresh-stock-items', JSON.stringify(items));
  }, [items]);

  const addItem = (itemData: Partial<GroceryItem>) => {
    const newItem: GroceryItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: itemData.name || 'Unknown Item',
      quantity: itemData.quantity || '1 unit',
      category: itemData.category || 'Other',
      addedAt: new Date().toISOString(),
      expiresAt: itemData.expiresAt || addDays(new Date(), 7).toISOString(),
      imageUrl: itemData.imageUrl,
      status: 'fresh'
    };
    setItems(prev => [newItem, ...prev]);
    setIsAddingManual(false);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const getStatus = (expiryDate: string): 'fresh' | 'expiring' | 'expired' => {
    const date = new Date(expiryDate);
    if (isPast(date)) return 'expired';
    if (differenceInDays(date, new Date()) <= 3) return 'expiring';
    return 'fresh';
  };

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
            <div className="flex items-center gap-3 text-neutral-400 font-medium tracking-tight uppercase text-xs">
              <UtensilsCrossed size={16} />
              <span>FreshStock Kitchen</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-neutral-900 leading-none">
              Your Pantry, <br />
              <span className="italic">Perfectly Tracked</span>
            </h1>
          </div>
          
          <div className="flex gap-3">
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
            onScan={(data, image) => {
              addItem({
                name: data.name,
                category: data.category,
                quantity: data.quantity,
                imageUrl: image,
                expiresAt: addDays(new Date(), data.suggestedExpiryDays).toISOString()
              });
              setIsScannerOpen(false);
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

function ManualAddForm({ onSubmit, onCancel }: { onSubmit: (data: any) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    quantity: '1',
    category: 'Pantry',
    expiryDays: '7'
  });

  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      onSubmit({
        name: formData.name,
        quantity: formData.quantity,
        category: formData.category,
        expiresAt: addDays(new Date(), parseInt(formData.expiryDays)).toISOString()
      });
    }}>
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
        <button type="button" onClick={onCancel} className="flex-1 px-6 py-4 rounded-2xl bg-neutral-100 font-bold hover:bg-neutral-200 transition-colors">Cancel</button>
        <button type="submit" className="flex-1 px-6 py-4 rounded-2xl bg-neutral-950 text-white font-bold hover:bg-neutral-800 transition-colors">Add Item</button>
      </div>
    </form>
  );
}

