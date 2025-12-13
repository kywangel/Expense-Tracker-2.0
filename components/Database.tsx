
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

const Database: React.FC<DatabaseProps> = ({ transactions, onUpdate, onDelete, settings, onRefresh }) => {
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [visibleMonths, setVisibleMonths] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync Input (Form)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
        if (filter === 'all') return true;
        return tx.type === filter;
    });
  }, [transactions, filter]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
        const monthKey = tx.date.substring(0, 7); // YYYY-MM format
        if (!acc[monthKey]) {
            acc[monthKey] = [];
        }
        acc[monthKey].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);
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
  
  const handleExport = () => {
    const headers = "Date,Amount,Category,Note,Type\n";
    const csvContent = filteredTransactions
      .map(tx => {
          // Use Source if present (e.g., 'IOS shortcut'), otherwise Note
          const finalNote = tx.source || tx.note || '';
          
          return `${tx.date},${tx.amount},"${(tx.category || '').replace(/"/g, '""')}","${finalNote.replace(/"/g, '""')}",${tx.type}`;
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

  const toggleMonthVisibility = (monthKey: string) => {
    setVisibleMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (txId: string) => {
    setItemToDelete(txId);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      onDelete(itemToDelete);
    }
    setItemToDelete(null);
  };

  const handleSave = (updatedTx: Transaction) => {
    onUpdate(updatedTx);
    setIsModalOpen(false);
    setEditingTx(null);
  };
  
  const renderAmount = (tx: Transaction) => {
    const amount = Math.abs(tx.amount);
    const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (tx.type === 'income') return <span className="text-green-600 font-semibold">+ {formattedAmount}</span>;
    if (tx.type === 'expense') return <span className="text-red-600 font-semibold">- {formattedAmount}</span>;
    return <span className="text-gray-800 font-semibold">{formattedAmount}</span>;
  };
  
  const renderTypeBadge = (type: Transaction['type']) => {
    if (!type) return null;
    const baseClasses = 'text-xs font-semibold px-2 py-0.5 rounded-full capitalize leading-none';
    switch (type) {
        case 'income':
            return <span className={`${baseClasses} bg-green-100 text-green-700`}>{type}</span>;
        case 'expense':
            return <span className={`${baseClasses} bg-red-100 text-red-700`}>{type}</span>;
        case 'investment':
            return <span className={`${baseClasses} bg-blue-100 text-blue-700`}>{type}</span>;
        default:
            return null;
    }
  };


  return (
    <div className="pb-24 space-y-5">
        {/* iOS Style Segmented Control */}
        <div className="bg-gray-200 p-1 rounded-xl flex text-xs font-semibold mx-1">
            {(['all', 'expense', 'income', 'investment'] as FilterType[]).map(f => (
                <button 
                    key={f} 
                    onClick={() => setFilter(f)} 
                    className={`flex-1 py-1.5 rounded-lg capitalize transition-all duration-200 leading-none ${filter === f ? 'bg-white text-gray-900 shadow-sm scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {f}
                </button>
            ))}
        </div>

        {/* Action Grid (2 buttons now) */}
        <div className="grid grid-cols-2 gap-3">
             <button onClick={handleRefresh} disabled={isRefreshing} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 active:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 h-24">
                 <div className={`w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}>
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5"></path></svg>
                 </div>
                 <span className="text-[10px] font-semibold text-gray-600">{isRefreshing ? 'Syncing...' : 'Sync Forms'}</span>
            </button>

            <button onClick={handleExport} disabled={isRefreshing} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-2 active:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 h-24">
                 <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <span className="text-[10px] font-semibold text-gray-600">Export CSV</span>
            </button>
        </div>

        {sortedMonths.map(monthKey => {
            const monthName = new Date(`${monthKey}-02`).toLocaleString('default', { month: 'long', year: 'numeric' });
            return (
                <div key={monthKey} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button onClick={() => toggleMonthVisibility(monthKey)} className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex justify-between items-center font-bold text-gray-700">
                        <span>{monthName}</span>
                        <svg className={`w-5 h-5 transform transition-transform text-gray-400 ${visibleMonths[monthKey] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {visibleMonths[monthKey] && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-100">
                                {groupedTransactions[monthKey].map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap align-top">
                                            <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                            <p className="font-semibold text-gray-800">{tx.category}</p>
                                            <div className="mt-1">
                                                {renderTypeBadge(tx.type)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right align-top">
                                            <div className="font-mono">{renderAmount(tx)}</div>
                                            <p className="text-xs text-gray-400 capitalize">{tx.source}</p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center align-middle pr-6">
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={() => handleEditClick(tx)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg></button>
                                                <button onClick={() => handleDeleteClick(tx.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-full" title="Delete"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
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
        })}

        {isModalOpen && editingTx && <EditModal tx={editingTx} onSave={handleSave} onClose={() => setIsModalOpen(false)} settings={settings} />}
        
        {itemToDelete && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-fade-in-up text-center">
                <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Transaction?</h3>
                <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
                <div className="flex space-x-3">
                  <button onClick={() => setItemToDelete(null)} className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold">Cancel</button>
                  <button onClick={confirmDelete} className="flex-1 py-2 rounded-lg bg-red-500 text-white font-semibold">Yes, Delete</button>
                </div>
              </div>
            </div>
        )}
    </div>
  );
};

const EditModal: React.FC<{ tx: Transaction, onSave: (tx: Transaction) => void, onClose: () => void, settings: AppSettings }> = ({ tx, onSave, onClose, settings }) => {
  const [formData, setFormData] = useState<Transaction>(tx);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const absoluteAmount = Math.abs(parseFloat(e.target.value) || 0);
    const finalAmount = formData.type === 'income' ? absoluteAmount : -absoluteAmount;
    setFormData(prev => ({ ...prev, amount: finalAmount }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as Transaction['type'];
    const absoluteAmount = Math.abs(formData.amount);
    const newAmount = newType === 'income' ? absoluteAmount : -absoluteAmount;
    const cats = newType === 'expense' ? settings.expenseCategories : newType === 'income' ? settings.incomeCategories : settings.investmentCategories;
    setFormData(prev => ({ ...prev, type: newType, amount: newAmount, category: cats[0] }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const currentCategories = formData.type === 'expense' ? settings.expenseCategories : formData.type === 'income' ? settings.incomeCategories : settings.investmentCategories;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up">
        <h3 className="text-lg font-bold mb-4">Edit Transaction</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 mt-1 bg-gray-50 rounded-lg"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Type</label>
            <select name="type" value={formData.type} onChange={handleTypeChange} className="w-full p-2 mt-1 bg-gray-50 rounded-lg">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="investment">Investment</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Category</label>
            <select name="category" value={formData.category} onChange={handleChange} className="w-full p-2 mt-1 bg-gray-50 rounded-lg">
                {currentCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Amount</label>
            <input type="number" step="0.01" value={Math.abs(formData.amount)} onChange={handleAmountChange} className="w-full p-2 mt-1 bg-gray-50 rounded-lg" />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Database;
