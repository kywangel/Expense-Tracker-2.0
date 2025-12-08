

import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { saveTransaction } from '../services/sheetService';

interface AddTransactionProps {
  onAdd: (t: Transaction) => void;
  sheetDbUrl: string;
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
}

const AddTransaction: React.FC<AddTransactionProps> = ({ onAdd, sheetDbUrl, incomeCategories, expenseCategories, investmentCategories }) => {
  const [type, setType] = useState<'expense' | 'income' | 'investment'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(expenseCategories[0] || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (type === 'expense') setCategory(expenseCategories[0] || '');
    else if (type === 'income') setCategory(incomeCategories[0] || '');
    else if (type === 'investment') setCategory(investmentCategories[0] || '');
  }, [type, incomeCategories, expenseCategories, investmentCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || loading || parseFloat(amount) === 0) return;

    setLoading(true);

    const absoluteAmount = Math.abs(parseFloat(amount));
    const finalAmount = type === 'income' ? absoluteAmount : -absoluteAmount;
    const newTx: Transaction = {
      id: `local-${Date.now()}`,
      date, 
      amount: finalAmount, 
      category, 
      type, 
      source: 'app input'
    };
    
    // Optimistically update the main app state so the UI is fast
    onAdd(newTx);
    
    // Reset the form for the next entry
    setAmount('');
    if (type === 'expense') setCategory(expenseCategories[0] || '');
    else if (type === 'income') setCategory(incomeCategories[0] || '');
    else if (type === 'investment') setCategory(investmentCategories[0] || '');

    // Save in the background (fire and forget)
    saveTransaction(sheetDbUrl, newTx)
      .catch(err => {
        console.error("Background sync failed for transaction:", err);
        // Optionally, show a failure notification to the user here
      });
      
    // Give visual feedback and then re-enable the button
    setTimeout(() => setLoading(false), 500);
  };

  const getThemeColor = () => {
    if (type === 'income') return 'text-green-600 focus:ring-green-500';
    if (type === 'investment') return 'text-blue-600 focus:ring-blue-500';
    return 'text-red-500 focus:ring-red-500';
  };

  const getButtonColor = () => {
    if (type === 'income') return 'bg-green-600 hover:bg-green-700';
    if (type === 'investment') return 'bg-blue-600 hover:bg-blue-700';
    return 'bg-red-500 hover:bg-red-600';
  };

  const categories = type === 'expense' ? expenseCategories 
                   : type === 'income' ? incomeCategories 
                   : investmentCategories;

  return (
    <div className="max-w-md mx-auto pb-40">
      <div className="flex bg-gray-200 p-1 rounded-xl mb-6">
          {(['expense', 'income', 'investment'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`flex-1 py-2 text-sm font-bold capitalize rounded-lg transition-all ${type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t}
              </button>
          ))}
      </div>
      <h2 className="text-2xl font-bold mb-4 text-gray-800 capitalize">New {type}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Amount</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`w-full pl-8 pr-4 py-3 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 font-bold text-lg ${getThemeColor()}`} required />
                </div>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {categories.map(c => (
                        <button key={c} type="button" onClick={() => setCategory(c)} className={`py-2 px-2 text-xs rounded-lg font-medium transition-colors truncate ${category === c ? (type === 'income' ? 'bg-green-500 text-white shadow-md' : type === 'investment' ? 'bg-blue-500 text-white shadow-md' : 'bg-red-500 text-white shadow-md') : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                            {c}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
                 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
            </div>
        </div>
        <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl text-white font-bold text-xl shadow-lg shadow-red-500/30 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 ${getButtonColor()}`}>
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            <span>{loading ? 'Saving...' : 'Add Entry'}</span>
        </button>
      </form>
    </div>
  );
};

export default AddTransaction;