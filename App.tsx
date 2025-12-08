import React, { useState, useEffect, useMemo } from 'react';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import Statistics from './components/Statistics';
import AiTools from './components/AiTools';
import Settings from './components/Settings';
import Budgeting from './components/Budgeting';
import EditCategories from './components/EditCategories';
import Database from './components/Database';
import { Transaction, AppView, AppSettings, FoundItem, MatchedItemPair } from './types';
import { fetchTransactions } from './services/sheetService';
import { DEFAULT_SHEET_ID, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INVESTMENT_CATEGORIES } from './constants';
import { format } from 'date-fns';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    const defaults: AppSettings = { 
        sheetDbUrl: DEFAULT_SHEET_ID, 
        monthlyBudget: 3000,
        monthlyCategoryBudgets: {},
        incomeCategories: DEFAULT_INCOME_CATEGORIES,
        expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        investmentCategories: DEFAULT_INVESTMENT_CATEGORIES
    };
    if (saved) {
        const parsed = JSON.parse(saved);
        // Migration for old data structure
        if (parsed.categoryBudgets && !parsed.monthlyCategoryBudgets) {
            const currentMonthKey = format(new Date(), 'yyyy-MM');
            parsed.monthlyCategoryBudgets = { [currentMonthKey]: parsed.categoryBudgets };
            delete parsed.categoryBudgets;
        }
        return { ...defaults, ...parsed };
    }
    return defaults;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [aiFoundItems, setAiFoundItems] = useState<FoundItem[]>(() => {
      const saved = localStorage.getItem('aiFoundItems');
      return saved ? JSON.parse(saved) : [];
  });

  const [aiMatchedItems, setAiMatchedItems] = useState<MatchedItemPair[]>(() => {
    const saved = localStorage.getItem('aiMatchedItems');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [notification, setNotification] = useState<string | null>(null);
  const [isAiSelectModeActive, setIsAiSelectModeActive] = useState(false);


  // Memoize sorted transactions
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);
  
  useEffect(() => {
    localStorage.setItem('aiFoundItems', JSON.stringify(aiFoundItems));
  }, [aiFoundItems]);

  useEffect(() => {
    localStorage.setItem('aiMatchedItems', JSON.stringify(aiMatchedItems));
  }, [aiMatchedItems]);
  
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRefreshFromSheet = async () => {
      const urlToFetch = settings.sheetDbUrl || DEFAULT_SHEET_ID;
      try {
        const fetchedData = await fetchTransactions(
            urlToFetch, 
            settings.incomeCategories, 
            settings.investmentCategories
        );
        
        setTransactions(prevTxs => {
            const existingIds = new Set(prevTxs.map(t => t.id));
            const newTxsFromSheet = fetchedData.filter(t => t && t.id && !existingIds.has(t.id));
            if (newTxsFromSheet.length > 0) {
                showNotification(`${newTxsFromSheet.length} new transaction(s) synced.`);
                return [...prevTxs, ...newTxsFromSheet];
            } else {
                showNotification("No new transactions found.");
            }
            return prevTxs;
        });

      } catch (error) {
        console.error("Failed to refresh transactions from source:", error);
        showNotification("Failed to sync from sheet.");
      }
  };


  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    showNotification("Settings Saved!");
  };
  
  const handleAddCategory = (type: 'income' | 'expense' | 'investment', category: string) => {
    if (!category.trim()) return;
    const key = `${type}Categories`;
    const currentCategories = settings[key];
    if (currentCategories.includes(category.trim())) {
      showNotification("Category already exists.");
      return;
    }
    setSettings(prev => ({ ...prev, [key]: [...currentCategories, category.trim()] }));
    showNotification(`Added category: ${category}`);
  };

  const handleDeleteCategory = (type: 'income' | 'expense' | 'investment', categoryToDelete: string) => {
    const isUsed = transactions.some(t => t.category === categoryToDelete);
    if (isUsed) {
      showNotification(`Cannot delete "${categoryToDelete}" as it's in use.`);
      return;
    }
    const key = `${type}Categories`;
    setSettings(prev => ({ ...prev, [key]: prev[key].filter(c => c !== categoryToDelete) }));
    showNotification(`Deleted category: ${categoryToDelete}`);
  };

  const handleEditCategory = (
    type: 'income' | 'expense' | 'investment',
    oldName: string,
    newName: string
  ) => {
    if (!newName.trim() || oldName === newName) return;
    const key = `${type}Categories` as const;
    const currentCategories = settings[key];
    if (currentCategories.includes(newName.trim())) {
      showNotification("Category name already exists.");
      return;
    }

    setSettings(prev => ({
      ...prev,
      [key]: prev[key].map(c => c === oldName ? newName.trim() : c)
    }));

    setTransactions(prev => 
        prev.map(t => t.category === oldName ? { ...t, category: newName.trim() } : t)
    );
    
    // Update budgets
    const newMonthlyBudgets = { ...settings.monthlyCategoryBudgets };
    Object.keys(newMonthlyBudgets).forEach(monthKey => {
      if (newMonthlyBudgets[monthKey][oldName]) {
        newMonthlyBudgets[monthKey][newName.trim()] = newMonthlyBudgets[monthKey][oldName];
        delete newMonthlyBudgets[monthKey][oldName];
      }
    });
    setSettings(prev => ({ ...prev, monthlyCategoryBudgets: newMonthlyBudgets }));


    showNotification(`Renamed "${oldName}" to "${newName.trim()}"`);
  };

  const handleReorderCategories = (
    type: 'income' | 'expense' | 'investment',
    reorderedCategories: string[]
  ) => {
    const key = `${type}Categories` as const;
    setSettings(prev => ({ ...prev, [key]: reorderedCategories }));
  };

  const handleUpdateCategoryBudget = (monthKey: string, category: string, amount: number) => {
      const newMonthlyBudgets = { ...settings.monthlyCategoryBudgets };
      const currentMonthBudgets = { ...(newMonthlyBudgets[monthKey] || {}) };
      
      if (amount > 0) {
        currentMonthBudgets[category] = amount;
      } else {
        delete currentMonthBudgets[category];
      }
      
      newMonthlyBudgets[monthKey] = currentMonthBudgets;
      setSettings(prev => ({ ...prev, monthlyCategoryBudgets: newMonthlyBudgets }));
  };

  const handleAddTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
    const shortNote = t.note && t.note.length > 20 ? t.note.substring(0, 20) + '...' : t.note;
    showNotification(`Added: ${shortNote || t.category}`);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
      setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
      showNotification("Transaction updated!");
  };

  const handleDeleteTransaction = (txId: string) => {
      setTransactions(prev => prev.filter(tx => tx.id !== txId));
      showNotification("Transaction deleted!");
  };

  const renderHeaderTitle = () => {
    switch (view) {
        case AppView.DASHBOARD: return 'Overview';
        case AppView.STATISTICS: return 'Analytics';
        case AppView.ADD_TRANSACTION: return 'New Entry';
        case AppView.BUDGET: return 'Budgeting';
        case AppView.DATABASE: return 'Database';
        case AppView.AI_TOOLS: return 'AI Tools';
        case AppView.SETTINGS: return 'Configuration';
        case AppView.EDIT_CATEGORIES: return 'Edit Categories';
        default: return '';
    }
  };

  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const currentMonthBudgets = useMemo(() => settings.monthlyCategoryBudgets[currentMonthKey] || {}, [settings.monthlyCategoryBudgets, currentMonthKey]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans relative">
      {notification && (
        <div className="fixed top-5 left-1/2 bg-gray-900/80 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-2xl z-[100] animate-fade-in-down">
          <p className="text-sm font-medium">{notification}</p>
        </div>
      )}

      <div className="pt-safe-top px-6 py-4 flex justify-between items-center bg-gray-50 z-10 sticky top-0">
         <div className="font-bold text-lg tracking-tight text-gray-400">
             {renderHeaderTitle()}
         </div>
         <button 
             className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all focus:outline-none"
             onClick={() => setView(AppView.SETTINGS)}
             aria-label="Settings"
         >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
         </button>
      </div>

      <main className="flex-1 px-6 pt-2 pb-6 max-w-2xl mx-auto w-full">
        {view === AppView.DASHBOARD && <Dashboard transactions={sortedTransactions} currentMonthBudgets={currentMonthBudgets} incomeCategories={settings.incomeCategories} expenseCategories={settings.expenseCategories} investmentCategories={settings.investmentCategories} />}
        {view === AppView.ADD_TRANSACTION && <AddTransaction onAdd={handleAddTransaction} sheetDbUrl={settings.sheetDbUrl} incomeCategories={settings.incomeCategories} expenseCategories={settings.expenseCategories} investmentCategories={settings.investmentCategories} />}
        {view === AppView.STATISTICS && <Statistics transactions={sortedTransactions} incomeCategories={settings.incomeCategories} investmentCategories={settings.investmentCategories} expenseCategories={settings.expenseCategories} />}
        {view === AppView.DATABASE && <Database transactions={sortedTransactions} onUpdate={handleUpdateTransaction} onDelete={handleDeleteTransaction} settings={settings} onRefresh={handleRefreshFromSheet} />}
        {view === AppView.BUDGET && <Budgeting onUpdateBudget={handleUpdateCategoryBudget} settings={settings} onBack={() => setView(AppView.SETTINGS)} onShowNotification={showNotification}/>}
        {view === AppView.AI_TOOLS && <AiTools 
            sheetDbUrl={settings.sheetDbUrl} 
            onAddTransaction={handleAddTransaction} 
            transactions={sortedTransactions} 
            foundTransactions={aiFoundItems} 
            setFoundTransactions={setAiFoundItems} 
            matchedItems={aiMatchedItems}
            setMatchedItems={setAiMatchedItems}
            incomeCategories={settings.incomeCategories} 
            expenseCategories={settings.expenseCategories} 
            investmentCategories={settings.investmentCategories} 
            onShowNotification={showNotification}
            isSelectModeActive={isAiSelectModeActive}
            onToggleSelectMode={setIsAiSelectModeActive}
        />}
        {view === AppView.SETTINGS && <Settings settings={settings} onSave={handleSaveSettings} onNavigateToCategories={() => setView(AppView.EDIT_CATEGORIES)} onNavigateToBudget={() => setView(AppView.BUDGET)} />}
        {view === AppView.EDIT_CATEGORIES && <EditCategories settings={settings} onAddCategory={handleAddCategory} onDeleteCategory={handleDeleteCategory} onEditCategory={handleEditCategory} onReorderCategories={handleReorderCategories} transactions={sortedTransactions} onBack={() => setView(AppView.SETTINGS)} />}
      </main>

      {!isAiSelectModeActive && <Navigation currentView={view} onChangeView={setView} />}
    </div>
  );
};

export default App;