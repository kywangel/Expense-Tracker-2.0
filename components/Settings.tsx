
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onNavigateToCategories: () => void;
  onNavigateToBudget: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, onNavigateToCategories, onNavigateToBudget }) => {
  const [url, setUrl] = useState(settings.sheetDbUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUrl(settings.sheetDbUrl);
  }, [settings]);

  const handleSave = () => {
    onSave({
      ...settings,
      sheetDbUrl: url.trim()
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Google Sheet URL</label>
            <input 
                type="text" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full p-3 bg-gray-50 rounded-xl text-sm font-mono text-gray-600 break-all"
            />
            <p className="text-xs text-gray-400 mt-2">
                Paste the full URL from your browser. 
                <br/>
                <span className="text-orange-500">Note:</span> Ensure the Sheet is shared as <strong>"Anyone with the link"</strong> so the app can read it.
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
        My AI Expense Tracker v1.3 <br/>
        Powered by Gemini
      </div>
    </div>
  );
};

export default Settings;