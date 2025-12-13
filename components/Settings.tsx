
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
  // We don't maintain local state for startMonth anymore to ensure immediate sync
  // but we can use it for rendering if needed. 
  const [saved, setSaved] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormUrl(settings.sheetDbUrl);
  }, [settings]);

  const handleSave = () => {
    onSave({
      ...settings,
      sheetDbUrl: formUrl.trim(),
      // preserving the masterSheetUrl from existing settings just in case, but it's hidden from UI
      masterSheetUrl: settings.masterSheetUrl 
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  const handleStartMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      // Immediate save
      onSave({
          ...settings,
          cumulativeStartMonth: newVal
      });
  };
  
  const handleDownloadBackup = () => {
    const backupData = {
        version: "2.0",
        timestamp: new Date().toISOString(),
        transactions,
        settings, // Use current settings directly
        aiFoundItems,
        aiMatchedItems
    };
    
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
              if (!json.transactions || !json.settings) {
                  alert("Invalid backup file. Missing transactions or settings.");
                  return;
              }
              if (window.confirm(`Found ${json.transactions.length} transactions from ${new Date(json.timestamp).toLocaleDateString()}. \n\nThis will OVERWRITE your current data. Are you sure?`)) {
                  onImportData(json);
                  alert("Data restored successfully!");
              }
          } catch (err) {
              alert("Failed to parse backup file.");
              console.error(err);
          }
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold text-gray-800">Settings</h2>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        <button 
          onClick={onNavigateToCategories}
          className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-gray-50"
        >
          <div>
            <h3 className="font-bold text-gray-800">Edit Categories</h3>
            <p className="text-xs text-gray-500">Add, remove, or rename your custom categories.</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <button 
          onClick={onNavigateToBudget}
          className="w-full flex justify-between items-center text-left p-2 rounded-lg hover:bg-gray-50"
        >
          <div>
            <h3 className="font-bold text-gray-800">Manage Budgets</h3>
            <p className="text-xs text-gray-500">Set monthly spending limits for your categories.</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-800">Display Preferences</h3>
        
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Cumulative View Start Month</label>
            <input 
                type="month" 
                value={settings.cumulativeStartMonth || ''}
                onChange={handleStartMonthChange}
                className="w-full p-3 bg-gray-50 rounded-xl text-sm font-mono text-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-2">
                Set the starting point for the "Cumulative" view on the dashboard. Budget and spending will be calculated from this month onwards.
                <br/><span className="text-green-600 font-bold">Auto-saves immediately.</span>
            </p>
        </div>
      </div>
      
      {/* New Data Persistence Section */}
      <div className="bg-orange-50 p-6 rounded-2xl shadow-sm border border-orange-100 space-y-4">
        <div>
            <h3 className="font-bold text-orange-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Data Safety (Offline Mode)
            </h3>
            <div className="text-xs text-orange-800 mt-2 space-y-2">
                <p>
                    <strong>Automatic:</strong> Your data saves to this browser's temporary memory. <br/>
                    <span className="text-red-600 font-bold">Warning:</span> If you clear your browser history or delete this app, you will lose everything.
                </p>
                <p>
                    <strong>Manual Backup:</strong> To prevent data loss, you must click the button below regularly to save a file to your phone.
                </p>
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
             <button onClick={handleDownloadBackup} className="bg-white border border-orange-200 text-orange-800 py-3 px-2 rounded-xl text-sm font-bold shadow-sm hover:bg-orange-100 active:scale-95 transition-transform flex flex-col items-center gap-1">
                 <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 Save Backup File
             </button>
             
             <button onClick={() => fileInputRef.current?.click()} className="bg-orange-600 text-white py-3 px-2 rounded-xl text-sm font-bold shadow-sm hover:bg-orange-700 active:scale-95 transition-transform flex flex-col items-center gap-1">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                 Restore from File
             </button>
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleRestoreBackup}
             />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-gray-800">Cloud Sync (Google Sheets)</h3>
        
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Google Form Sheet (Input)</label>
            <input 
                type="text" 
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full p-3 bg-gray-50 rounded-xl text-sm font-mono text-gray-600 break-all"
            />
            <p className="text-[10px] text-gray-400 mt-2">
                Paste the URL of a Google Sheet ("Anyone with the link" or "Published to Web") to pull transactions from it.
            </p>
        </div>
      </div>

      <button 
        onClick={handleSave}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white'}`}
      >
        {saved ? 'Saved!' : 'Save Configuration'}
      </button>

      <div className="text-center text-xs text-gray-400 mt-8">
        My AI Expense Tracker v2.1 <br/>
        Powered by Gemini
      </div>
    </div>
  );
};

export default Settings;
