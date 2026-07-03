import React, { useState, useMemo } from 'react';
import { RecurringItem, Transaction } from '../types';
import { toHKDateString } from '../constants';

interface RecurringProps {
  recurringItems: RecurringItem[];
  onAddRecurring: (item: Omit<RecurringItem, 'id'>) => void;
  onUpdateRecurring: (item: RecurringItem) => void;
  onDeleteRecurring: (id: string) => void;
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
  categoryIcons: Record<string, string>;
  billingCycleStartDay: number;
  transactions: Transaction[];
}

const Recurring: React.FC<RecurringProps> = ({
  recurringItems,
  onAddRecurring,
  onUpdateRecurring,
  onDeleteRecurring,
  incomeCategories,
  expenseCategories,
  investmentCategories,
  categoryIcons,
  billingCycleStartDay,
  transactions = []
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'investment' | 'cumulative'>('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);

  // Form states
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<'expense' | 'income' | 'investment'>('expense');
  const [startDate, setStartDate] = useState('');

  // Filtering & Sorting for Cumulative tab
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'investment'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  const categoriesForType = {
    expense: expenseCategories,
    income: incomeCategories,
    investment: investmentCategories
  };

  const handleOpenAdd = () => {
    const defaultType = activeTab === 'cumulative' ? 'expense' : activeTab;
    setType(defaultType);
    const availableCats = categoriesForType[defaultType];
    setCategory(availableCats[0] || '');
    setAmount('');
    setNote('');
    setStartDate(toHKDateString(new Date()));
    setIsAdding(true);
  };

  const handleOpenEdit = (item: RecurringItem) => {
    setEditingItem(item);
    setType(item.type);
    setCategory(item.category);
    setAmount(item.amount.toString());
    setNote(item.note || '');
    setStartDate(item.startDate || toHKDateString(new Date()));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (editingItem) {
      onUpdateRecurring({
        ...editingItem,
        type,
        category,
        amount: numAmount,
        note: note.trim(),
        startDate: startDate || toHKDateString(new Date())
      });
      setEditingItem(null);
    } else {
      onAddRecurring({
        type,
        category,
        amount: numAmount,
        note: note.trim(),
        isActive: true,
        startDate: startDate || toHKDateString(new Date())
      });
      setIsAdding(false);
    }

    // Reset
    setAmount('');
    setNote('');
    setStartDate('');
  };

  // Get active item lists for non-cumulative tab
  const filteredItems = recurringItems.filter(item => item.type === activeTab);

  // Extract, filter and sort completed recurring transactions for Cumulative tab
  const recurringTransactions = useMemo(() => {
    return transactions.filter(tx => tx.source === 'recurring');
  }, [transactions]);

  const filteredRecurringTransactions = useMemo(() => {
    return recurringTransactions.filter(tx => {
      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesSearch = !searchQuery || 
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (tx.note || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    }).sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      const amtA = Math.abs(a.amount);
      const amtB = Math.abs(b.amount);
      
      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'highest') return amtB - amtA;
      if (sortBy === 'lowest') return amtA - amtB;
      return 0;
    });
  }, [recurringTransactions, filterType, searchQuery, sortBy]);

  const getEmoji = (cat: string) => categoryIcons[cat] || '📁';

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Informative Help Card */}
      <div className="bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100/80 rounded-2xl p-5 shadow-sm">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm">Automated Billing Cycles</h4>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              These recurring items will repeat on the <strong>first day of each billing cycle</strong> (currently Day <span className="font-bold text-blue-600">{billingCycleStartDay}</span> of the month). They are added as real transactions in the database with a <strong>Recurring</strong> source stamp.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="bg-gray-100 p-1 rounded-xl flex items-center justify-between shadow-inner">
        {(['expense', 'income', 'investment', 'cumulative'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setIsAdding(false);
              setEditingItem(null);
            }}
            className={`flex-1 text-center py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all capitalize ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab === 'cumulative' ? 'Cumulative' : `${tab}s`}
          </button>
        ))}
      </div>

      {/* List / Form Area */}
      {!isAdding && !editingItem ? (
        activeTab === 'cumulative' ? (
          /* Cumulative Done Items Tab */
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
                  Executed History
                </h3>
                <span className="text-xs bg-gray-100 text-gray-600 font-bold px-2.5 py-1 rounded-full border border-gray-200">
                  {filteredRecurringTransactions.length} Items Done
                </span>
              </div>

              {/* Filtering Controls */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by category or note..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 text-gray-800 placeholder-gray-400"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Type and Sorting */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-50">
                  {/* Type filters */}
                  <div className="flex gap-1">
                    {(['all', 'expense', 'income', 'investment'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilterType(t)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all capitalize border ${
                          filterType === t
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Sort dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-600 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest">Highest Amount</option>
                    <option value="lowest">Lowest Amount</option>
                  </select>
                </div>
              </div>

              {/* Sum stats cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-red-50/50 border border-red-100/50 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] font-bold text-red-500 uppercase">Expense</span>
                  <p className="font-mono font-black text-xs text-red-600 mt-0.5">
                    ${filteredRecurringTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </p>
                </div>
                <div className="bg-green-50/50 border border-green-100/50 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] font-bold text-green-500 uppercase">Income</span>
                  <p className="font-mono font-black text-xs text-green-600 mt-0.5">
                    ${filteredRecurringTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </p>
                </div>
                <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] font-bold text-blue-500 uppercase">Investment</span>
                  <p className="font-mono font-black text-xs text-blue-600 mt-0.5">
                    ${filteredRecurringTransactions.filter(t => t.type === 'investment').reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Table List of Done Items */}
            {filteredRecurringTransactions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-10 px-6 text-center shadow-sm">
                <span className="text-3xl">📭</span>
                <p className="text-xs text-gray-400 font-medium mt-3">No matched completed recurring items found.</p>
                <p className="text-[10px] text-gray-300 mt-1">Adjust your filter options or wait for cycle posting.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Date & Category</th>
                        <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Type</th>
                        <th className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredRecurringTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl bg-gray-50 w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                                {getEmoji(tx.category)}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-gray-800 text-xs">{tx.category}</span>
                                </div>
                                <div className="flex flex-col mt-0.5">
                                  <span className="text-[9px] text-gray-400 font-bold uppercase">{tx.date}</span>
                                  {tx.note && <span className="text-[9px] text-gray-400 italic max-w-[150px] truncate">{tx.note}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                              tx.type === 'income' 
                                ? 'bg-green-100 text-green-700' 
                                : tx.type === 'expense' 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-blue-100 text-blue-700'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-bold text-xs">
                            <span className={tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-600' : 'text-blue-600'}>
                              {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Template List View for Expense/Income/Investment tabs */
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
                {activeTab} Templates
              </h3>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1 text-xs font-bold bg-blue-600 text-white px-3.5 py-1.5 rounded-full shadow-md shadow-blue-500/20 active:scale-95 transition-transform"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add New
              </button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-10 px-6 text-center shadow-sm">
                <span className="text-3xl">🔄</span>
                <p className="text-xs text-gray-400 font-medium mt-3">No recurring {activeTab}s configured yet.</p>
                <p className="text-[10px] text-gray-300 mt-1">Tap Add New above to create one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl bg-gray-50 w-11 h-11 rounded-xl flex items-center justify-center shadow-inner shrink-0">
                        {getEmoji(item.category)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">{item.category}</span>
                          {!item.isActive && (
                            <span className="text-[9px] bg-gray-100 text-gray-400 font-bold px-1.5 py-0.5 rounded uppercase">Paused</span>
                          )}
                        </div>
                        <p className="text-xs font-mono font-bold text-gray-900 mt-0.5">
                          ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="text-[10px] text-gray-400 font-bold">Starts: {item.startDate || 'Immediate'}</span>
                          {item.note && (
                            <>
                              <span className="text-[10px] text-gray-300">•</span>
                              <span className="text-[10px] text-gray-400 italic max-w-[150px] truncate">{item.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Active/Inactive Toggle */}
                      <button
                        onClick={() => {
                          const nextActive = !item.isActive;
                          const updatedItem = {
                            ...item,
                            isActive: nextActive
                          };
                          if (nextActive) {
                            updatedItem.startDate = toHKDateString(new Date());
                          }
                          onUpdateRecurring(updatedItem);
                        }}
                        className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          item.isActive ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                            item.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => onDeleteRecurring(item.id)}
                        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        /* Edit / Add Form */
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-md space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-800 text-sm">
              {editingItem ? 'Edit Recurring Item' : `New Recurring ${type}`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingItem(null);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold"
            >
              Cancel
            </button>
          </div>

          {/* Type Picker if adding */}
          {!editingItem && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</label>
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1 rounded-lg">
                {(['expense', 'income', 'investment'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t);
                      setCategory(categoriesForType[t][0] || '');
                    }}
                    className={`py-1.5 text-xs font-bold rounded-md capitalize transition-all ${
                      type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 text-gray-800"
            >
              {categoriesForType[type].map((cat) => (
                <option key={cat} value={cat}>
                  {getEmoji(cat)} {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500/20 text-gray-800"
            />
          </div>

          {/* Note Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Monthly Rent, Netflix, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 text-gray-800 placeholder-gray-300"
            />
          </div>

          {/* Start Date Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 text-gray-800"
            />
            <p className="text-[10px] text-gray-400 italic mt-1 leading-normal">
              Transactions are only posted for cycles starting on or after this date.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/10 active:scale-95 transition-all text-sm mt-2"
          >
            {editingItem ? 'Save Changes' : 'Create Template'}
          </button>
        </form>
      )}
    </div>
  );
};

export default Recurring;
