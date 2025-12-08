import React, { useState, useRef } from 'react';
import { Transaction, FoundItem, MatchedItemPair } from '../types';
import { analyzeStatement, fileToGenerativePart } from '../services/geminiService';
import { saveTransaction } from '../services/sheetService';
import { getTransactionType } from '../constants';

interface AiToolsProps {
  sheetDbUrl: string;
  onAddTransaction: (t: Transaction) => void;
  transactions: Transaction[];
  foundTransactions: FoundItem[];
  setFoundTransactions: React.Dispatch<React.SetStateAction<FoundItem[]>>;
  matchedItems: MatchedItemPair[];
  setMatchedItems: React.Dispatch<React.SetStateAction<MatchedItemPair[]>>;
  incomeCategories: string[];
  expenseCategories: string[];
  investmentCategories: string[];
  onShowNotification: (message: string) => void;
  isSelectModeActive: boolean;
  onToggleSelectMode: (isActive: boolean) => void;
}

const AiTools: React.FC<AiToolsProps> = ({ 
  sheetDbUrl, onAddTransaction, transactions,
  foundTransactions, setFoundTransactions, 
  matchedItems, setMatchedItems,
  incomeCategories, expenseCategories, investmentCategories,
  onShowNotification, isSelectModeActive, onToggleSelectMode
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [selectedItem, setSelectedItem] = useState<{item: FoundItem, originalId: string} | null>(null);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<'expense' | 'income' | 'investment'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAnalyzing(true);
    setProgress(0);

    const interval = setInterval(() => setProgress(p => Math.min(p + Math.floor(Math.random() * 15) + 5, 90)), 500);

    try {
      let allResults: FoundItem[] = [];
      // FIX: Explicitly cast FileList to a File array to resolve type inference issues.
      for (const file of Array.from(files) as File[]) {
          const base64 = await fileToGenerativePart(file);
          const results = await analyzeStatement(base64, file.type);
          allResults.push(...results.map((r, i) => ({ ...r, id: `ai-${file.name}-${i}-${Date.now()}` })));
      }
      
      const suggestedItems: FoundItem[] = [];
      for (const scannedTx of allResults) {
        if (!scannedTx.amount) continue;
        const isDuplicate = transactions.some(existingTx => 
            Math.abs(Math.abs(scannedTx.amount!) - Math.abs(existingTx.amount)) < 0.01
        );
        if (!isDuplicate) {
          suggestedItems.push(scannedTx);
        }
      }
      
      if (suggestedItems.length > 0) {
          setFoundTransactions(prev => [...suggestedItems, ...prev]);
          onShowNotification(`${suggestedItems.length} new suggested transaction(s) found.`);
      } else {
          onShowNotification("No new transactions found. Your records seem up to date!");
      }

      setProgress(100);
    } catch (err) {
      alert(`Error analyzing file(s): ${err instanceof Error ? err.message : "An unknown error occurred."}`);
      setProgress(0);
    } finally {
      clearInterval(interval);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => { setAnalyzing(false); setProgress(0); }, 500);
    }
  };
  
  // FIX: Changed the second parameter to a more specific callback function type
  // to prevent TypeScript from inferring an incorrect union type for the callback argument.
  const reanalyzeList = (list: FoundItem[], onReanalyzeComplete: (keptItems: FoundItem[]) => void) => {
    const itemsToKeep: FoundItem[] = [];
    const newlyMatched: MatchedItemPair[] = [];

    list.forEach(item => {
        if (item.added) return;

        const match = transactions.find(existingTx => {
            if (item.amount && Math.abs(Math.abs(item.amount) - Math.abs(existingTx.amount)) < 0.01) {
                const itemDate = new Date(item.date!);
                const existingDate = new Date(existingTx.date);
                if (isNaN(itemDate.getTime()) || isNaN(existingDate.getTime())) return false;
                const timeDiff = Math.abs(itemDate.getTime() - existingDate.getTime());
                const dayDiff = timeDiff / (1000 * 3600 * 24);
                return dayDiff <= 10;
            }
            return false;
        });

        if (!match) {
            itemsToKeep.push(item);
        } else {
            newlyMatched.push({ suggested: item, matched: match });
        }
    });

    onReanalyzeComplete(itemsToKeep);
    setMatchedItems(prev => [...newlyMatched, ...prev]);
    return newlyMatched.length;
  };
  
  const handleGlobalReanalyze = () => {
    const count = reanalyzeList(foundTransactions, setFoundTransactions);

    if(count > 0){
        onShowNotification(`Moved ${count} item(s) to the matched section.`);
    } else {
        onShowNotification("No new matches found in suggested items.");
    }
    onToggleSelectMode(false);
  };

  const openAddModal = (item: FoundItem, originalId: string) => {
    const initialType = getTransactionType(item.category || '', incomeCategories, investmentCategories);
    
    setSelectedItem({item, originalId});
    setSelectedType(initialType);
    const defaultCat = initialType === 'expense' ? expenseCategories[0] 
                     : initialType === 'income' ? incomeCategories[0] 
                     : investmentCategories[0];
                     
    const allCats = [...expenseCategories, ...incomeCategories, ...investmentCategories];
    const isKnown = allCats.includes(item.category || '');
    setSelectedCategory(isKnown ? item.category! : defaultCat);
    
    setModalStep(1);
  };

  const confirmAddTransaction = () => {
    if (!selectedItem) return;

    const { item, originalId } = selectedItem;
    const absoluteAmount = Math.abs(item.amount || 0);
    const finalAmount = selectedType === 'income' ? absoluteAmount : -absoluteAmount;

    const newTx: Transaction = {
        id: `local-${Date.now()}`,
        date: item.date || new Date().toISOString().split('T')[0],
        amount: finalAmount, category: selectedCategory,
        note: item.note || "Imported Statement Item", type: selectedType,
        source: 'PDF file'
    };
    onAddTransaction(newTx);
    saveTransaction(sheetDbUrl, newTx).catch(err => console.error("Sync failed:", err));
    
    setFoundTransactions(prev => prev.map(it => it.id === originalId ? { ...it, added: true } : it));
    setMatchedItems(prev => prev.map(pair => pair.suggested.id === originalId ? { ...pair, suggested: { ...pair.suggested, added: true } } : pair));

    setSelectedItem(null);
  };
  
  const toggleSelectMode = () => {
    onToggleSelectMode(!isSelectModeActive);
    if (isSelectModeActive) { // Turning off
        setSelectedIds(new Set()); 
    }
  };
  
  const handleSelectItem = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };
  
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBatchDelete = () => {
    setFoundTransactions(prev => prev.filter(item => !selectedIds.has(item.id)));
    setMatchedItems(prev => prev.filter(pair => !selectedIds.has(pair.suggested.id)));
    setShowDeleteConfirm(false);
    onToggleSelectMode(false);
  };

  const currentCategories = selectedType === 'expense' ? expenseCategories :
                            selectedType === 'income' ? incomeCategories :
                            investmentCategories;

  const renderItem = (item: FoundItem, isMatched = false, matchedTx?: Transaction) => {
      const isSelected = selectedIds.has(item.id);

      return (
        <div key={item.id}>
            <div onClick={() => isSelectModeActive && handleSelectItem(item.id)} className={`bg-white rounded-xl shadow-sm border ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-100'} flex items-center transition-colors ${isSelectModeActive ? 'cursor-pointer' : ''}`}>
              {isSelectModeActive && (
                <div className="p-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                </div>
              )}
              <div className={`flex-grow flex justify-between items-center p-4 ${isSelectModeActive ? 'pl-0' : ''}`}>
                <div>
                  <p className="font-bold text-gray-900 text-sm line-clamp-1">{item.note}</p>
                  <p className="text-xs text-gray-500">{item.date} • {item.category}</p>
                   {item.added && <p className="text-xs font-bold text-green-500 mt-1">✓ Added to Home & Stats</p>}
                </div>
                {!isSelectModeActive && (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-semibold">${item.amount?.toFixed(2)}</span>
                       {!item.added && <button onClick={() => openAddModal(item, item.id)} className="p-2 rounded-lg border transition-colors bg-green-50 text-green-600 hover:bg-green-100 border-green-200"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></button>}
                    </div>
                )}
              </div>
            </div>
            {isMatched && matchedTx && (
                <div className="bg-yellow-50 border-t border-b border-yellow-200 px-4 py-2 text-xs text-yellow-800 -mt-2 mb-3 rounded-b-xl">
                    <strong>Matched:</strong> {matchedTx.category} ({matchedTx.source}) for ${matchedTx.amount.toFixed(2)} on {matchedTx.date}
                </div>
            )}
        </div>
      );
  };
  
  const renderListHeader = (title: string, onReanalyze: () => void) => (
    <div className="flex justify-between items-center px-2">
      <h4 className="font-bold text-gray-800">{title}</h4>
       <div className="flex items-center space-x-2">
          <button onClick={onReanalyze} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Re-analyze list for new matches">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
          <button onClick={toggleSelectMode} className="text-sm font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg">
              {isSelectModeActive ? 'Cancel' : 'Select'}
          </button>
       </div>
    </div>
  );

  return (
    <div className="pb-40 relative">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
        <div className="mb-4 text-blue-500"><svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
        <h3 className="font-bold text-gray-900 mb-2">Upload Statement</h3>
        <p className="text-sm text-gray-500 mb-6">
            Upload a statement. We will find and suggest transactions that are missing from your records.
        </p>
        <input type="file" accept="image/*,application/pdf" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e)} multiple />
        {analyzing ? (
           <div className="w-full">
               <div className="flex justify-between text-xs font-semibold text-blue-600 mb-2"><span>Analyzing...</span><span>{progress}%</span></div>
               <div className="w-full bg-blue-200 rounded-full h-4 overflow-hidden"><div className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div></div>
           </div>
        ) : ( <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 w-full shadow-md transition-transform active:scale-95">Select File(s) (PDF/Image)</button> )}
    </div>

      <div className="space-y-6 mt-6">
          {foundTransactions.length > 0 && (
              <>
                {renderListHeader("Suggested Items", handleGlobalReanalyze)}
                <div className="space-y-3 animate-fade-in-up">
                  {foundTransactions.map((t) => renderItem(t))}
                </div>
              </>
          )}

          {matchedItems.length > 0 && (
            <div className="space-y-4 animate-fade-in-up mt-8">
               {renderListHeader("Matched Items", () => {
                   const matchedSuggestions = matchedItems.map(p => p.suggested);
                   const count = reanalyzeList(matchedSuggestions, (items) => {
                       // This is tricky. We need to update the matchedItems list.
                       const remainingIds = new Set(items.map(i => i.id));
                       setMatchedItems(prev => prev.filter(p => remainingIds.has(p.suggested.id)));
                   });
                   if (count === 0) onShowNotification("No new matches found in this section.");
               })}
              <div className="space-y-3">
                {matchedItems.map((pair) => renderItem(pair.suggested, true, pair.matched))}
              </div>
            </div>
          )}
      </div>
      
      {isSelectModeActive && (
         <div className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 transform translate-y-0">
           <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200 px-6 py-3 pb-safe-area flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             <span className="font-bold text-gray-800">{selectedIds.size} Selected</span>
             <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="text-red-600 disabled:text-gray-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
           </div>
         </div>
      )}

      {showDeleteConfirm && (
         <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
           <div className="bg-white w-full max-w-xs rounded-2xl p-6 shadow-2xl animate-fade-in-up text-center">
             <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Items?</h3>
             <p className="text-sm text-gray-500 mb-6">Found {selectedIds.size} selected items. Are you sure you want to delete them?</p>
             <div className="flex space-x-3">
               <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold">Cancel</button>
               <button onClick={confirmBatchDelete} className="flex-1 py-2 rounded-lg bg-red-500 text-white font-semibold">Yes, Delete</button>
             </div>
           </div>
         </div>
      )}

      {selectedItem !== null && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-all">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in-up flex flex-col items-center">
                  <div className="flex justify-between items-center w-full mb-4">
                      <h3 className="text-lg font-bold text-gray-800">{modalStep === 1 ? 'Select Type' : 'Select Category'}</h3>
                      <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                  {modalStep === 1 && (
                      <div className="space-y-3 w-full">
                          <p className="text-sm text-gray-500 mb-2">What kind of transaction is this?</p>
                          {(['expense', 'income', 'investment'] as const).map(type => (
                              <button key={type} onClick={() => { setSelectedType(type); setModalStep(2); setSelectedCategory(currentCategories[0] || ''); }} className={`w-full py-4 rounded-xl font-bold text-left px-6 capitalize flex justify-between items-center transition-transform active:scale-95 ${type === 'expense' ? 'bg-red-50 text-red-600 hover:bg-red-100' : type === 'income' ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                                  <span>{type}</span><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </button>
                          ))}
                      </div>
                  )}
                  {modalStep === 2 && (
                      <div className="space-y-4 w-full">
                           <div className="flex justify-between items-center">
                                <button onClick={() => setModalStep(1)} className="text-sm text-gray-500 flex items-center hover:text-gray-800"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Back</button>
                                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${selectedType === 'expense' ? 'bg-red-100 text-red-600' : selectedType === 'income' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{selectedType}</span>
                           </div>
                           <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                {currentCategories.map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`py-2 px-2 text-xs rounded-lg font-medium transition-colors text-center ${selectedCategory === cat ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
                                ))}
                           </div>
                           <button onClick={confirmAddTransaction} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Confirm & Add</button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default AiTools;