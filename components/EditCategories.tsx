
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, Transaction } from '../types';

interface EditCategoriesProps {
  settings: AppSettings;
  transactions: Transaction[];
  onAddCategory: (type: 'income' | 'expense' | 'investment', category: string) => void;
  onDeleteCategory: (type: 'income' | 'expense' | 'investment', category: string) => void;
  onEditCategory: (type: 'income' | 'expense' | 'investment', oldName: string, newName: string) => void;
  onReorderCategories: (type: 'income' | 'expense' | 'investment', reorderedCategories: string[]) => void;
  onBack: () => void;
}

interface DragState {
  index: number;
  type: string;
  startY: number;
  currentY: number;
  initialCategories: string[];
}

const EditCategories: React.FC<EditCategoriesProps> = ({ 
    settings, onAddCategory, onDeleteCategory, 
    onEditCategory, onReorderCategories, onBack 
}) => {
  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [newInvestmentCat, setNewInvestmentCat] = useState('');
  
  const [editing, setEditing] = useState<{ type: string; name: string } | null>(null);
  const [editingText, setEditingText] = useState('');

  // Enhanced Drag State
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleEditClick = (type: string, name: string) => {
    setEditing({ type, name });
    setEditingText(name);
  };

  const handleSaveEdit = (type: 'income' | 'expense' | 'investment', oldName: string) => {
    if (!editingText.trim()) {
        setEditing(null);
        return;
    }
    onEditCategory(type, oldName, editingText.trim());
    setEditing(null);
    setEditingText('');
  };

  /**
   * Fluid Pointer Move Logic
   * Updates coordinates for visual translation and triggers logical swaps when crossing thresholds.
   */
  const handlePointerMove = (e: PointerEvent) => {
    if (!dragState) return;

    const deltaY = e.clientY - dragState.startY;
    const container = containerRefs.current[dragState.type];
    if (!container) return;

    const children = Array.from(container.children) as HTMLElement[];
    const itemHeight = children[0]?.offsetHeight || 60;
    const gap = 12; // space-y-3 is 0.75rem = 12px
    const fullStep = itemHeight + gap;

    // Calculate how many steps we've moved
    const stepsMoved = Math.round(deltaY / fullStep);
    const newTargetIndex = Math.max(0, Math.min(dragState.initialCategories.length - 1, dragState.index + stepsMoved));

    // Update the visual current Y for translation
    setDragState(prev => prev ? ({ ...prev, currentY: e.clientY }) : null);

    // If the logical index has changed, perform the swap in the background
    if (newTargetIndex !== -1 && newTargetIndex !== undefined) {
      const currentOrder = settings[`${dragState.type as 'income' | 'expense' | 'investment'}Categories`];
      // We only reorder if the target has actually changed from where the item is CURRENTLY in the state
      const currentIndexInState = currentOrder.indexOf(dragState.initialCategories[dragState.index]);
      
      if (currentIndexInState !== newTargetIndex) {
          const newCategories = [...currentOrder];
          const [movedItem] = newCategories.splice(currentIndexInState, 1);
          newCategories.splice(newTargetIndex, 0, movedItem);
          onReorderCategories(dragState.type as any, newCategories);
      }
    }
  };

  const handlePointerUp = () => {
    setDragState(null);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const startDrag = (e: React.PointerEvent, index: number, type: string, categories: string[]) => {
    // Crucial for iOS: prevent magnification and other default behaviors
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    setDragState({
      index,
      type,
      startY: e.clientY,
      currentY: e.clientY,
      initialCategories: [...categories]
    });

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const renderCategoryManager = (
    title: string,
    type: 'income' | 'expense' | 'investment',
    categories: string[],
    newCatValue: string,
    setNewCatValue: (val: string) => void
  ) => {
    const handleAdd = () => {
      if (!newCatValue.trim()) return;
      onAddCategory(type, newCatValue.trim());
      setNewCatValue('');
    };

    const isDraggingSection = dragState?.type === type;

    return (
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-6 transition-all duration-300">
        <h3 className="font-bold text-lg mb-5 text-gray-800 flex justify-between items-center select-none px-1">
            {title}
            <span className="text-[10px] uppercase text-gray-400 tracking-widest font-black bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                {categories.length} Total
            </span>
        </h3>
        
        <div 
            ref={el => containerRefs.current[type] = el}
            className="space-y-3 mb-6 relative"
        >
          {categories.map((cat, index) => {
            const isBeingEdited = editing?.name === cat && editing?.type === type;
            const isActiveItem = isDraggingSection && dragState.initialCategories[dragState.index] === cat;
            
            // Calculate visual translation for the active item
            let transformStyle = '';
            if (isActiveItem) {
                const offset = dragState.currentY - dragState.startY;
                transformStyle = `translateY(${offset}px)`;
            }

            return (
              <div 
                key={cat} 
                className={`flex justify-between items-center border rounded-2xl transition-all duration-200 
                  ${isActiveItem 
                    ? 'bg-blue-50 border-blue-400 shadow-2xl z-50 scale-[1.05] ring-8 ring-blue-500/5 cursor-grabbing' 
                    : isDraggingSection 
                        ? 'bg-gray-50/40 border-gray-100 opacity-60 scale-[0.98]' 
                        : 'bg-gray-50 border-gray-100'
                  } 
                  ${isBeingEdited ? 'ring-2 ring-blue-500 bg-white border-blue-200 z-10' : ''}
                  select-none touch-none
                `}
                style={{ 
                    transform: transformStyle,
                    transition: isActiveItem ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s, opacity 0.2s, scale 0.2s',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                }}
              >
                {/* Dedicated Drag Handle */}
                <div 
                    className={`w-14 h-14 flex items-center justify-center transition-colors shrink-0 cursor-grab active:cursor-grabbing
                        ${isActiveItem ? 'text-blue-600' : 'text-gray-300 active:text-gray-600'}
                    `}
                    onPointerDown={(e) => startDrag(e, index, type, categories)}
                >
                  <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8h16M4 16h16" />
                  </svg>
                </div>

                <div className="flex-grow min-w-0 py-3 px-1">
                  {isBeingEdited ? (
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-2 bg-white border border-blue-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-100"
                      autoFocus
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(type, cat);
                          if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <span className={`text-sm font-bold truncate block transition-colors ${isActiveItem ? 'text-blue-700' : 'text-gray-700'}`}>
                        {cat}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center shrink-0">
                  {isBeingEdited ? (
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); handleSaveEdit(type, cat); }} 
                        className="w-14 h-14 flex items-center justify-center text-green-600 active:bg-green-50 rounded-r-2xl transition-colors"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                  ) : (
                    <>
                      <button 
                        onPointerDown={(e) => { e.stopPropagation(); handleEditClick(type, cat); }} 
                        className={`w-14 h-14 flex items-center justify-center transition-colors hover:text-blue-600 active:bg-blue-50 ${isDraggingSection ? 'pointer-events-none text-gray-200' : 'text-gray-400'}`}
                        disabled={isDraggingSection}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
                        </svg>
                      </button>
                      
                      <button
                        onPointerDown={(e) => { e.stopPropagation(); onDeleteCategory(type, cat); }}
                        className={`w-14 h-14 flex items-center justify-center rounded-r-2xl transition-colors active:bg-red-50 active:scale-90 ${isDraggingSection ? 'pointer-events-none text-gray-200' : 'text-red-500'}`}
                        disabled={isDraggingSection}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newCatValue}
            onChange={e => setNewCatValue(e.target.value)}
            placeholder={`New ${title} Name...`}
            className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd} 
            className="bg-blue-600 text-white font-black px-6 py-4 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-600/20"
          >
              Add
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 pb-24">
      <div className="flex items-center mb-6 px-1 select-none">
          <button onClick={onBack} className="flex items-center text-sm font-black text-gray-500 hover:text-gray-800 bg-gray-100 px-5 py-3 rounded-full transition-all active:scale-95 shadow-sm">
             <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
             </svg>
             Settings
          </button>
      </div>

      <div className="animate-fade-in-up">
        {renderCategoryManager('Income', 'income', settings.incomeCategories, newIncomeCat, setNewIncomeCat)}
        {renderCategoryManager('Expenses', 'expense', settings.expenseCategories, newExpenseCat, setNewExpenseCat)}
        {renderCategoryManager('Investments / Savings', 'investment', settings.investmentCategories, newInvestmentCat, setNewInvestmentCat)}
      </div>
    </div>
  );
};

export default EditCategories;
