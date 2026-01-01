
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Transaction, FoundItem, MatchedItemPair } from '../types';

interface SettingsProps {
  settings: AppSettings;
  transactions: Transaction[];
  aiFoundItems: FoundItem[];
  aiMatchedItems: MatchedItemPair[];
  onSave: (s: AppSettings) => void;
  onImportData: (data: any) => void;
  onNavigateToCategories: () => void;
  onNavigateToBudget: () => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  transactions, 
  aiFoundItems, 
  aiMatchedItems,
  onSave, 
  onImportData,
  onNavigateToCategories, 
  onNavigateToBudget 
}) => {
  const [formUrl, setFormUrl] = useState(settings.sheetDbUrl);
  const [saved, setSaved] = useState(false);
  const [showDailyBudgeting, setShowDailyBudgeting] = useState(false);
  const [storageUsed, setStorageUsed] = useState<string>('0');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    setFormUrl(settings.sheetDbUrl);
    // Calculate approximate storage usage
    const size = JSON.stringify(localStorage).length;
    setStorageUsed((size / 1024).toFixed(1));
  }, [settings, transactions]);

  const handleSave = () => {
    onSave({
      ...settings,
      sheetDbUrl: formUrl.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onSave({ ...settings, cumulativeStartMonth: e.target.value });
  };
  
  const handleToggleDailyCategory = (cat: string) => {
    const current = settings.dailyViewCategories || [];
    const updated = current.includes(cat) 
        ? current.filter(c => c !== cat)
        : [...current, cat];
    onSave({ ...settings, dailyViewCategories: updated });
  };

  const handleFreqChange = (cat: string, val: string) => {
    const num = parseInt(val) || 0;
    onSave({
        ...settings,
        dailyTransactionsPerMonth: {
            ...settings.dailyTransactionsPerMonth,
            [cat]: num
        }
    });
  };

  const handleDragSort = () => {
      if (dragItem.current === null || dragOverItem.current === null) return;
      const updated = [...settings.dailyViewCategories];
      const draggedItemContent = updated.splice(dragItem.current, 1)[0];
      updated.splice(dragOverItem.current, 0, draggedItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      onSave({ ...settings, dailyViewCategories: updated });
  };

  const handleDownloadBackup = () => {
    const backupData = { version: "2.3", timestamp: new Date().toISOString(), transactions, settings, aiFoundItems, aiMatchedItems };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (window.confirm(`Found ${json.transactions?.length || 0} transactions. Overwrite?`)) {
                  onImportData(json);
              }
          } catch (err) { alert("Failed to parse backup."); }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        <div className="text-right">
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Device Storage</p>
           <p className="text-xs font-mono font-bold text-blue-600">{storageUsed} KB / 5MB</p>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
         <div className="bg-blue-600 text-white rounded-full p-1 mt-0.5 shrink-0">
           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </div>
         <p className="text-[11px] text-blue-800 leading-normal">
            <strong>Pro Tip:</strong> To prevent data loss, tap the "Share" icon and <strong>Add to Home Screen</strong>. This keeps your data separate from regular browser tabs which iOS may clear after 7 days of inactivity.
         </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        <button onClick={onNavigateToCategories} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800">Edit Categories</h3>
            <p className="text-xs text-gray-500">Add, remove, or rename categories.</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <button onClick={onNavigateToBudget} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800">Manage Budgets</h3>
            <p className="text-xs text-gray-500">Set monthly spending limits.</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <button onClick={() => setShowDailyBudgeting(!showDailyBudgeting)} className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-800">Daily Budgeting</h3>
            <p className="text-xs text-gray-500">Configure categories for the Daily View table.</p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showDailyBudgeting ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {showDailyBudgeting && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 animate-fade-in">
              <h3 className="font-bold text-gray-800">Daily View Configuration</h3>
              <p className="text-xs text-gray-500">Select which expense categories to track in the Daily View. Drag to reorder.</p>
              
              <div className="space-y-3">
                  {settings.dailyViewCategories.map((catId, idx) => (
                      <div 
                        key={catId} 
                        className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100"
                        draggable
                        onDragStart={() => dragItem.current = idx}
                        onDragEnter={() => dragOverItem.current = idx}
                        onDragEnd={handleDragSort}
                        onDragOver={(e) => e.preventDefault()}
                      >
                          <svg className="w-5 h-5 text-gray-300 cursor-grab" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                          <div className="flex-1 min-w-0">
                              <span className="text-sm font-bold text-gray-800 truncate block">{catId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <label className="text-[10px] font-bold text-gray-400 uppercase">Freq:</label>
                              <input 
                                type="number" 
                                value={settings.dailyTransactionsPerMonth[catId] || ''} 
                                onChange={(e) => handleFreqChange(catId, e.target.value)}
                                className="w-12 p-1 text-center bg-white border rounded text-xs"
                                placeholder="0"
                              />
                          </div>
                          <button onClick={() => handleToggleDailyCategory(catId)} className="text-red-400 p-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                          </button>
                      </div>
                  ))}
              </div>

              <div className="pt-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Add Category to View</label>
                  <select 
                    className="w-full p-3 bg-gray-50 rounded-xl text-sm outline-none border-none"
                    onChange={(e) => {
                        if (e.target.value) handleToggleDailyCategory(e.target.value);
                        e.target.value = "";
                    }}
                    value=""
                  >
                      <option value="" disabled>Choose an expense category...</option>
                      {settings.expenseCategories
                        .filter(c => !settings.dailyViewCategories.includes(c))
                        .map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
          </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800">Display Preferences</h3>
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Cumulative View Start Month</label>
            <input type="month" value={settings.cumulativeStartMonth || ''} onChange={handleStartMonthChange} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-mono text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
      </div>
      
      <div className="bg-orange-50 p-6 rounded-2xl shadow-sm border border-orange-100 space-y-4">
        <h3 className="font-bold text-orange-900 flex items-center gap-2">Data Safety (Offline Mode)</h3>
        <p className="text-[10px] text-orange-700 italic">Your data is stored locally. Save a backup file often to prevent accidental loss if browser storage is cleared.</p>
        <div className="grid grid-cols-2 gap-3">
             <button onClick={handleDownloadBackup} className="bg-white border border-orange-200 text-orange-800 py-3 px-2 rounded-xl text-sm font-bold shadow-sm flex flex-col items-center gap-1">Save Backup File</button>
             <button onClick={() => fileInputRef.current?.click()} className="bg-orange-600 text-white py-3 px-2 rounded-xl text-sm font-bold shadow-sm flex flex-col items-center gap-1">Restore from File</button>
             <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleRestoreBackup} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-gray-800">Cloud Sync (Google Sheets)</h3>
        <input type="text" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full p-3 bg-gray-50 rounded-xl text-sm font-mono text-gray-600 break-all" />
      </div>

      <button onClick={handleSave} className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'}`}>{saved ? 'Saved!' : 'Save Configuration'}</button>

      <div className="text-center text-xs text-gray-400 mt-8">My AI Expense Tracker v2.3 <br/>Powered by Gemini</div>
    </div>
  );
};

export default Settings;
