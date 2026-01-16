import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, AppSettings } from '../types';

interface DatabaseProps {
  transactions: Transaction[];
  onUpdate: (tx: Transaction) => void;
  onDelete: (txId: string) => void;
  settings: AppSettings;
  onRefresh: () => Promise<void>;
}

type FilterType = 'all' | 'income' | 'expense' | 'investment';

const f1 = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const Database: React.FC<DatabaseProps> = ({ transactions, onUpdate, onDelete, settings, onRefresh }) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Filtering States
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [visibleMonths, setVisibleMonths] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
        const matchesType = typeFilter === 'all' || tx.type === typeFilter;
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query || 
                             tx.category.toLowerCase().includes(query) || 
                             (tx.note || '').toLowerCase().includes(query);
        const txDate = new Date(tx.date);
        const matchesStartDate = !startDate || txDate >= new Date(startDate);
        const matchesEndDate = !endDate || txDate <= new Date(endDate);
        const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(tx.category);

        return matchesType && matchesSearch && matchesStartDate && matchesEndDate && matchesCategory;
    });
  }, [transactions, typeFilter, searchQuery, startDate, endDate, selectedCategories]);

  const groupedTransactions = useMemo(() => {
    const groups = filteredTransactions.reduce((acc, tx) => {
        const monthKey = tx.date.substring(0, 7);
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    Object.keys(groups).forEach(key => {
        // Strict sort: Latest First
        groups[key].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return groups;
  }, [filteredTransactions]);

  const sortedMonths = useMemo(() => Object.keys(groupedTransactions).sort().reverse(), [groupedTransactions]);

  useEffect(() => {
    if (sortedMonths.length > 0) {
      const mostRecentMonth = sortedMonths[0];
      if (visibleMonths[mostRecentMonth] === undefined) {
         setVisibleMonths(prev => ({ ...prev, [mostRecentMonth]: true }));
      }
    }
  }, [sortedMonths]);
  
  const isFilterActive = searchQuery !== '' || startDate !== '' || endDate !== '' || selectedCategories.size > 0;

  const toggleMonthVisibility = (monthKey: string) => {
    setVisibleMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const handleSaveEdit = (updatedTx: Transaction) => {
    onUpdate(updatedTx);
    setIsEditModalOpen(false);
    setEditingTx(null);
  };

  const allCategories = useMemo(() => {
    return Array.from(new Set([
        ...settings.incomeCategories,
        ...settings.expenseCategories,
        ...settings.investmentCategories
    ])).sort();
  }, [settings]);

  const resetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setSelectedCategories(new Set());
  };

  const handleExport = () => {
    const headers = "Date,Amount,Category,Note,Type\n";
    const csvContent = filteredTransactions
      .map(tx => {
          const finalNote = tx.source || tx.note || '';
          return `${tx.date},${tx.amount.toFixed(1)},"${(tx.category || '').replace(/"/g, '""')}","${finalNote.replace(/"/g, '""')}",${tx.type}`;
      })
      .join("\n");
      
    const blob = new Blob([headers + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-32 space-y-3">
        {/* Type Filter Tabs */}
        <div className="bg-gray-200 p-1 rounded-2xl flex text-[10px] font-black uppercase tracking-widest mx-1 shadow-inner">
            {(['all', 'expense', 'income', 'investment'] as FilterType[]).map(f => (
                <button 
                    key={f} 
                    onClick={() => setTypeFilter(f)} 
                    className={`flex-1 py-2 rounded-xl transition-all duration-300 ${typeFilter === f ? 'bg-white text-gray-900 shadow-sm scale-[1.02]' : 'text-gray-500'}`}
                >
                    {f}
                </button>
            ))}
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-3 gap-3 px-1">
             <button onClick={handleRefresh} disabled={isRefreshing} className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 active:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 h-24">
                 <div className={`w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5"></path></svg>
                 </div>
                 <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sync</span>
            </button>

            <button onClick={() => setIsFilterModalOpen(true)} className={`p-3 rounded-[2rem] border shadow-sm flex flex-col items-center justify-center gap-2 active:scale-95 transition-all h-24 relative ${isFilterActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-100'}`}>
                 {isFilterActive && <div className="absolute top-4 right-6 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>}
                 <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isFilterActive ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-600'}`}>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                 </div>
                 <span className={`text-[10px] font-black uppercase tracking-widest ${isFilterActive ? 'text-white' : 'text-gray-400'}`}>Filter</span>
            </button>

            <button onClick={handleExport} className="bg-white p-3 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 active:bg-gray-50 active:scale-95 transition-all h-24">
                 <div className="w-9 h-9 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">CSV</span>
            </button>
        </div>

        {/* Transactions List Area */}
        <div className="space-y-4">
            {sortedMonths.length > 0 ? sortedMonths.map(monthKey => {
                const monthName = new Date(`${monthKey}-02`).toLocaleString('default', { month: 'long', year: 'numeric' });
                return (
                    <div key={monthKey} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
                        <button onClick={() => toggleMonthVisibility(monthKey)} className="w-full px-6 py-4 bg-gray-50/50 hover:bg-gray-50 flex justify-between items-center font-black text-gray-800 text-sm tracking-tight transition-colors">
                            <span>{monthName}</span>
                            <svg className={`w-5 h-5 transform transition-transform text-gray-400 ${visibleMonths[monthKey] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {visibleMonths[monthKey] && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <tbody className="divide-y divide-gray-50">
                                    {groupedTransactions[monthKey].map(tx => (
                                        <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap align-top">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                                <p className="font-bold text-gray-900 text-sm mt-0.5 tracking-tight">{tx.category}</p>
                                                <div className="mt-1 flex gap-1">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${tx.type === 'income' ? 'bg-green-100 text-green-700' : tx.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{tx.type}</span>
                                                </div>
                                                {tx.note && <p className="text-[10px] text-gray-400 mt-1 italic line-clamp-1 max-w-[180px]">{tx.note}</p>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right align-top">
                                                <div className="font-mono text-sm leading-none font-bold">
                                                    {tx.type === 'income' ? (
                                                        <span className="text-green-600">+ {f1(Math.abs(tx.amount))}</span>
                                                    ) : tx.type === 'expense' ? (
                                                        <span className="text-red-600">- {f1(Math.abs(tx.amount))}</span>
                                                    ) : (
                                                        <span className="text-gray-800">{f1(Math.abs(tx.amount))}</span>
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-gray-300 font-bold uppercase tracking-tighter mt-1">{tx.source}</p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                                                <div className="flex justify-end space-x-1">
                                                    <button onClick={() => { setEditingTx(tx); setIsEditModalOpen(true); }} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg></button>
                                                    <button onClick={() => setItemToDelete(tx.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-full transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
            }) : (
                <div className="bg-white p-16 rounded-[3rem] text-center border-2 border-dashed border-gray-100 mt-2 mx-1">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[11px]">No matches found</p>
                    <button onClick={resetFilters} className="mt-4 text-blue-600 font-black text-xs uppercase tracking-[0.2em] bg-blue-50 px-5 py-2 rounded-full active:scale-95 transition-all">Clear Filters</button>
                </div>
            )}
        </div>

        {/* COMPACT CENTERED FILTER MODAL */}
        {isFilterModalOpen && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-6 backdrop-blur-md animate-fade-in" onClick={() => setIsFilterModalOpen(false)}>
                <div className="bg-white w-full max-w-[340px] rounded-[2.5rem] shadow-2xl animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-7 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Filter</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Refine Data</p>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="bg-gray-100 p-2.5 rounded-full text-gray-400 hover:text-gray-900 active:scale-90 transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Search Input Section */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Search Keywords</label>
                            <input 
                                type="text" 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Note or Category..."
                                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:bg-white transition-all outline-none"
                            />
                        </div>

                        {/* Date Option Section */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Date Range</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold focus:bg-white outline-none" />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold focus:bg-white outline-none" />
                            </div>
                        </div>

                        {/* Category Option Section */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Categories</label>
                                {selectedCategories.size > 0 && <button onClick={() => setSelectedCategories(new Set())} className="text-[8px] font-black text-red-500 uppercase tracking-widest">Clear</button>}
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto no-scrollbar p-0.5">
                                {allCategories.map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => {
                                            const next = new Set(selectedCategories);
                                            if (next.has(cat)) next.delete(cat);
                                            else next.add(cat);
                                            setSelectedCategories(next);
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${selectedCategories.has(cat) ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-gray-50 text-gray-500 border-transparent'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => { resetFilters(); setIsFilterModalOpen(false); }} className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest">Reset</button>
                            <button onClick={() => setIsFilterModalOpen(false)} className="flex-[1.5] py-4 rounded-2xl bg-gray-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-gray-900/30">Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Modal (Centered) */}
        {isEditModalOpen && editingTx && (
            <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/60 p-6 backdrop-blur-md animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
                <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Edit Record</h3>
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(editingTx!); }} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Date</label>
                            <input type="date" value={editingTx.date} onChange={e => setEditingTx({...editingTx, date: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:bg-white transition-all outline-none"/>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                                <select 
                                    value={editingTx.type} 
                                    onChange={e => {
                                        const newType = e.target.value as Transaction['type'];
                                        const absoluteAmount = Math.abs(editingTx.amount);
                                        const newAmount = newType === 'income' ? absoluteAmount : -absoluteAmount;
                                        const cats = newType === 'expense' ? settings.expenseCategories : newType === 'income' ? settings.incomeCategories : settings.investmentCategories;
                                        setEditingTx({...editingTx, type: newType, amount: newAmount, category: cats[0]});
                                    }} 
                                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:bg-white outline-none"
                                >
                                    <option value="expense">Expense</option>
                                    <option value="income">Income</option>
                                    <option value="investment">Investment</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                                <select value={editingTx.category} onChange={e => setEditingTx({...editingTx, category: e.target.value})} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold focus:bg-white outline-none">
                                    {(editingTx.type === 'expense' ? settings.expenseCategories : editingTx.type === 'income' ? settings.incomeCategories : settings.investmentCategories).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Amount ($)</label>
                            <input type="number" step="0.01" value={Math.abs(editingTx.amount)} onChange={e => {
                                const absoluteAmount = Math.abs(parseFloat(e.target.value) || 0);
                                const finalAmount = editingTx.type === 'income' ? absoluteAmount : -absoluteAmount;
                                setEditingTx({...editingTx, amount: finalAmount});
                            }} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-lg font-black focus:bg-white outline-none" />
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest">Cancel</button>
                            <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        
        {/* Delete Modal (Centered) */}
        {itemToDelete && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 p-6 backdrop-blur-xl animate-fade-in" onClick={() => setItemToDelete(null)}>
              <div className="bg-white w-full max-w-[300px] rounded-[2.5rem] p-8 shadow-2xl animate-fade-in-up text-center" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-2">Delete?</h3>
                <p className="text-[10px] text-gray-400 font-bold leading-relaxed mb-8 uppercase tracking-widest">Permanent Action</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { onDelete(itemToDelete); setItemToDelete(null); }} className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all">Confirm</button>
                  <button onClick={() => setItemToDelete(null)} className="w-full py-4 rounded-2xl bg-gray-100 text-gray-500 font-black text-xs uppercase tracking-widest">Cancel</button>
                </div>
              </div>
            </div>
        )}
    </div>
  );
};

export default Database;