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
import WidgetMode from './components/WidgetMode';
import { Transaction, AppView, AppSettings, FoundItem, MatchedItemPair } from './types';
import { fetchTransactions } from './services/sheetService';
import { DEFAULT_SHEET_ID, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INVESTMENT_CATEGORIES, toHKDateString } from './constants';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('appSettings');
      const defaults: AppSettings = { 
          sheetDbUrl: DEFAULT_SHEET_ID, 
          masterSheetUrl: "https://docs.google.com/spreadsheets/d/1vfnpOxHRtljZlbnHyGe86A_1Xmb-RyweRd1aT1Ojk3M/edit?usp=sharing",
          monthlyBudget: 3000,
          monthlyCategoryBudgets: {},
          baseCategoryBudgets: {},
          yearlyBudgets: {},
          incomeCategories: DEFAULT_INCOME_CATEGORIES,
          expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
          investmentCategories: DEFAULT_INVESTMENT_CATEGORIES,
          categoryIcons: {},
          dailyViewCategories: [],
          dailyTransactionsPerMonth: {}
      };

      if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...defaults,
            ...parsed,
            categoryIcons: parsed.categoryIcons || {},
            yearlyBudgets: parsed.yearlyBudgets || {},
            dailyViewCategories: parsed.dailyViewCategories || [],
            dailyTransactionsPerMonth: parsed.dailyTransactionsPerMonth || {}
          };
      }
      return defaults;
    } catch (e) {
      return { 
          sheetDbUrl: DEFAULT_SHEET_ID, 
          masterSheetUrl: "", 
          monthlyBudget: 3000,
          monthlyCategoryBudgets: {},
          baseCategoryBudgets: {},
          yearlyBudgets: {},
          incomeCategories: DEFAULT_INCOME_CATEGORIES,
          expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
          investmentCategories: DEFAULT_INVESTMENT_CATEGORIES,
          categoryIcons: {},
          dailyViewCategories: [],
          dailyTransactionsPerMonth: {}
      };
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('transactions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [aiFoundItems, setAiFoundItems] = useState<FoundItem[]>(() => {
    try {
      const saved = localStorage.getItem('aiFoundItems');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [aiMatchedItems, setAiMatchedItems] = useState<MatchedItemPair[]>(() => {
    try {
      const saved = localStorage.getItem('aiMatchedItems');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [notification, setNotification] = useState<string | null>(null);
  const [isAiSelectModeActive, setIsAiSelectModeActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'widget') setView(AppView.WIDGET);
    else if (viewParam === 'add') setView(AppView.ADD_TRANSACTION);
    else if (viewParam === 'statistics') setView(AppView.STATISTICS);
  }, []);

  const sortedTransactions = useMemo(() => {
    // Globally ensure Latest First (Reverse Chronological)
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  const safeSave = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        setNotification("Storage full!");
      }
    }
  };

  useEffect(() => safeSave('transactions', transactions), [transactions]);
  useEffect(() => safeSave('aiFoundItems', aiFoundItems), [aiFoundItems]);
  useEffect(() => safeSave('aiMatchedItems', aiMatchedItems), [aiMatchedItems]);
  useEffect(() => safeSave('appSettings', settings), [settings]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSyncData = async (sourceUrl: string, sourceName: string) => {
      if (!sourceUrl) return;
      try {
        const fetchedData = await fetchTransactions(
            sourceUrl, 
            settings.incomeCategories, 
            settings.investmentCategories,
            settings.expenseCategories,
            settings.categoryIcons
        );
        setTransactions(prevTxs => {
            const manualTxs = prevTxs.filter(t => t.source !== 'IOS shortcut');
            showNotification(`Synced ${fetchedData.length} items from sheet.`);
            return [...manualTxs, ...fetchedData];
        });
      } catch (error) {
        showNotification(`Sync failed.`);
      }
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    showNotification("Settings Saved!");
  };
  
  const handleImportData = (data: any) => {
      if (data.transactions) setTransactions(data.transactions);
      if (data.settings) setSettings(data.settings);
      showNotification("Data restored!");
  };
  
  const handleAddCategory = (type: 'income' | 'expense' | 'investment', category: string, icon?: string) => {
    const key = `${type}Categories` as 'incomeCategories' | 'expenseCategories' | 'investmentCategories';
    if (settings[key].includes(category.trim())) return;
    setSettings(prev => ({ 
        ...prev, 
        [key]: [...prev[key], category.trim()],
        categoryIcons: { ...prev.categoryIcons, [category.trim()]: icon || '' }
    }));
  };

  const handleDeleteCategory = (type: 'income' | 'expense' | 'investment', categoryToDelete: string) => {
    setTransactions(prev => prev.map(t => t.category === categoryToDelete ? { ...t, category: "Others", note: `[${categoryToDelete}] ${t.note || ''}`.trim() } : t));
    const key = `${type}Categories` as 'incomeCategories' | 'expenseCategories' | 'investmentCategories';
    setSettings(prev => {
        const newIcons = { ...prev.categoryIcons };
        delete newIcons[categoryToDelete];
        return { 
            ...prev, 
            [key]: prev[key].filter(c => c !== categoryToDelete),
            categoryIcons: newIcons,
            dailyViewCategories: prev.dailyViewCategories.filter(c => c !== categoryToDelete) 
        };
    });
  };

  const handleEditCategory = (type: 'income' | 'expense' | 'investment', oldName: string, newName: string, newIcon?: string) => {
    const key = `${type}Categories` as 'incomeCategories' | 'expenseCategories' | 'investmentCategories';
    setSettings(prev => {
        const newIcons = { ...prev.categoryIcons };
        delete newIcons[oldName];
        newIcons[newName.trim()] = newIcon || '';
        
        const updatedFreq = { ...prev.dailyTransactionsPerMonth };
        if (updatedFreq[oldName]) {
            updatedFreq[newName.trim()] = updatedFreq[oldName];
            delete updatedFreq[oldName];
        }

        return {
            ...prev,
            [key]: prev[key].map(c => c === oldName ? newName.trim() : c),
            categoryIcons: newIcons,
            dailyViewCategories: prev.dailyViewCategories.map(c => c === oldName ? newName.trim() : c),
            dailyTransactionsPerMonth: updatedFreq
        };
    });
    setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: newName.trim() } : t));
    showNotification(`Updated "${newName.trim()}"`);
  };

  const handleReorderCategories = (type: 'income' | 'expense' | 'investment', reorderedCategories: string[]) => {
    const key = `${type}Categories` as 'incomeCategories' | 'expenseCategories' | 'investmentCategories';
    setSettings(prev => ({ ...prev, [key]: reorderedCategories }));
  };

  const handleUpdateBudget = (category: string, amount: number, year: number) => {
      setSettings(prev => {
          const newYearlyBudgets = { ...(prev.yearlyBudgets || {}) };
          const yearKey = year.toString();
          if (!newYearlyBudgets[yearKey]) newYearlyBudgets[yearKey] = {};
          if (amount > 0) newYearlyBudgets[yearKey][category] = amount;
          else delete newYearlyBudgets[yearKey][category];
          return { ...prev, yearlyBudgets: newYearlyBudgets };
      });
  };

  const handleAddTransaction = (t: Transaction) => {
    setTransactions(prev => [t, ...prev]);
    showNotification(`Added Entry`);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    showNotification(`Updated Entry`);
  };

  const handleDeleteTransaction = (txId: string) => {
    setTransactions(prev => prev.filter(t => t.id !== txId));
    showNotification(`Deleted Entry`);
  };

  const dashboardBudgets = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const base = settings.baseCategoryBudgets || {};
    const yearly = settings.yearlyBudgets?.[currentYear.toString()] || {};
    return { ...base, ...yearly };
  }, [settings.baseCategoryBudgets, settings.yearlyBudgets]);

  const viewTitle = useMemo(() => {
    switch(view) {
        case AppView.DASHBOARD: return "Dashboard";
        case AppView.STATISTICS: return "Statistics";
        case AppView.DATABASE: return "Database";
        case AppView.AI_TOOLS: return "AI Tools";
        case AppView.SETTINGS: return "Settings";
        case AppView.ADD_TRANSACTION: return "Add Transaction";
        case AppView.BUDGET: return "Manage Budget";
        case AppView.EDIT_CATEGORIES: return "Edit Categories";
        case AppView.WIDGET: return "Summary Widget";
        default: return "App";
    }
  }, [view]);

  const isWidgetView = view === AppView.WIDGET;

  return (
    <div className={`min-h-screen ${isWidgetView ? 'bg-black' : 'bg-gray-50'} text-gray-900 flex flex-col font-sans relative`}>
      {notification && (
        <div className="fixed top-5 left-1/2 bg-gray-900/80 backdrop-blur-sm text-white px-5 py-2.5 rounded-full shadow-2xl z-[1500] animate-fade-in-down">
          <p className="text-sm font-medium">{notification}</p>
        </div>
      )}

      {/* Header */}
      <div className={`pt-safe-top px-6 py-4 flex justify-between items-center ${isWidgetView ? 'bg-black text-white' : 'bg-gray-50/95 backdrop-blur-md'} z-[1200] sticky top-0 border-b ${isWidgetView ? 'border-white/10' : 'border-gray-100'}`}>
         <div className="font-black text-2xl tracking-tight text-gray-800">{viewTitle}</div>
         <button className={`w-10 h-10 rounded-full flex items-center justify-center ${isWidgetView ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-500'} active:scale-90 transition-transform`} onClick={() => setView(AppView.SETTINGS)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
         </button>
      </div>

      <main className={`flex-1 px-6 pt-2 pb-6 max-w-2xl mx-auto w-full relative z-10 ${isWidgetView ? 'bg-black' : ''}`}>
        {view === AppView.DASHBOARD && <Dashboard transactions={sortedTransactions} baseCategoryBudgets={dashboardBudgets} incomeCategories={settings.incomeCategories} expenseCategories={settings.expenseCategories} investmentCategories={settings.investmentCategories} categoryIcons={settings.categoryIcons} cumulativeStartMonth={settings.cumulativeStartMonth} isBalanceVisible={isBalanceVisible} setIsBalanceVisible={setIsBalanceVisible} />}
        {view === AppView.ADD_TRANSACTION && <AddTransaction onAdd={handleAddTransaction} sheetDbUrl={settings.sheetDbUrl} incomeCategories={settings.incomeCategories} expenseCategories={settings.expenseCategories} investmentCategories={settings.investmentCategories} />}
        {view === AppView.STATISTICS && <Statistics transactions={sortedTransactions} incomeCategories={settings.incomeCategories} investmentCategories={settings.investmentCategories} expenseCategories={settings.expenseCategories} settings={settings} isBalanceVisible={isBalanceVisible} setIsBalanceVisible={setIsBalanceVisible} />}
        {view === AppView.DATABASE && <Database transactions={sortedTransactions} onUpdate={handleUpdateTransaction} onDelete={handleDeleteTransaction} settings={settings} onRefresh={() => handleSyncData(settings.sheetDbUrl, "Form Input")} />}
        {view === AppView.BUDGET && <Budgeting onUpdateBudget={handleUpdateBudget} settings={settings} transactions={sortedTransactions} onBack={() => setView(AppView.SETTINGS)} onShowNotification={showNotification}/>}
        {view === AppView.AI_TOOLS && <AiTools sheetDbUrl={settings.sheetDbUrl} onAddTransaction={handleAddTransaction} transactions={sortedTransactions} foundTransactions={aiFoundItems} setFoundTransactions={setAiFoundItems} matchedItems={aiMatchedItems} setMatchedItems={setAiMatchedItems} incomeCategories={settings.incomeCategories} expenseCategories={settings.expenseCategories} investmentCategories={settings.investmentCategories} onShowNotification={showNotification} isSelectModeActive={isAiSelectModeActive} onToggleSelectMode={setIsAiSelectModeActive} />}
        {view === AppView.SETTINGS && <Settings settings={settings} transactions={transactions} aiFoundItems={aiFoundItems} aiMatchedItems={aiMatchedItems} onSave={handleSaveSettings} onImportData={handleImportData} onNavigateToCategories={() => setView(AppView.EDIT_CATEGORIES)} onNavigateToBudget={() => setView(AppView.BUDGET)} />}
        {view === AppView.EDIT_CATEGORIES && <EditCategories settings={settings} onAddCategory={handleAddCategory} onDeleteCategory={handleDeleteCategory} onEditCategory={handleEditCategory} onReorderCategories={handleReorderCategories} transactions={sortedTransactions} onBack={() => setView(AppView.SETTINGS)} />}
        {view === AppView.WIDGET && <WidgetMode transactions={sortedTransactions} settings={settings} onExit={() => setView(AppView.DASHBOARD)} />}
      </main>

      {!isAiSelectModeActive && !isWidgetView && <Navigation currentView={view} onChangeView={setView} />}
    </div>
  );
};

export default App;