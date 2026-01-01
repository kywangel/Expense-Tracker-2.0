
import React, { useState, useRef } from 'react';
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

// Fixed: Explicitly defining all properties used in the drag logic
interface DragState {
  index: number;
  type: 'income' | 'expense' | 'investment';
  startY: number;
  currentY: number;
  initialItemName: string;
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

  // Drag state for physics-based movement
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({
    income: null,
    expense: null,
    investment: null
  });

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
   * Tracks movement and calculates when to swap items
   */
  const onPointerMove = (e: PointerEvent) => {
    if (!dragState) return;

    // Update current visual position for translateY
    setDragState(prev => prev ? ({ ...prev, currentY: e.clientY }) : null);

    const typeKey = `${dragState.type}Categories` as keyof AppSettings;
    const currentCategories = settings[typeKey] as string[];
    const container = containerRefs.current[dragState.type];
    
    if (!container || !Array.isArray(currentCategories)) return;

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length < 2) return;

    // Calculate item sizing for logical index shifting
    const itemHeight = children[0].offsetHeight;
    const gap = 12; // space-y-3 is 0.75rem (12px)
    const step = itemHeight + gap;
    
    const deltaY = e.clientY - dragState.startY;
    const indexShift = Math.round(deltaY / step);
    const targetIndex = Math.max(0, Math.min(currentCategories.length - 1, dragState.index + indexShift));

    // Logical Swap: Find where the item is now and move it to target
    const realCurrentIndex = currentCategories.indexOf(dragState.initialItemName);

    if (realCurrentIndex !== -1 && realCurrentIndex !== targetIndex) {
        const newCategories = [...currentCategories];
        const [movedItem] = newCategories.splice(realCurrentIndex, 1);
        newCategories.splice(targetIndex, 0, movedItem);
        onReorderCategories(dragState.type, newCategories);
    }
  };

  const onPointerUp = () => {
    setDragState(null);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const startDrag = (e: React.PointerEvent, index: number, type: 'income' | 'expense' | 'investment', name: string) => {
    // Prevent default touch behaviors like scrolling or text selection magnification
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const initialDrag: DragState = {
        index,
        type,
        startY: e.clientY,
        currentY: e.clientY,
        initialItemName: name
    };

    setDragState(initialDrag);

    // Using global listeners for high-precision tracking even if finger leaves the item bounds
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
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

    const isThisSectionDragging = dragState?.type === type;

    return (
      <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-gray-100 mb-6 transition-all duration-300">
        <div className="flex justify-between items-center mb-5 px-2 select-none">
            <h3 className="font-black text-xl text-gray-800 tracking-tight">{title}</h3>
            <span className="text-[10px] uppercase text-gray-400 tracking-[0.2em] font-black bg-gray-50 px-3 py-1.5 rounded-2xl border border-gray-100">
                {categories.length} Total
            </span>
        </div>
        
        <div 
            // Fixed: React 19 Ref assignment must return void/undefined
            ref={el => { containerRefs.current[type] = el; }}
            className="space-y-3 mb-6 relative"
        >
          {categories.map((cat, index) => {
            const isBeingEdited = editing?.name === cat && editing?.type === type;
            const isDraggedItem = isThisSectionDragging && dragState.initialItemName === cat;
            
            // Calculate real-time translation for the item following the finger
            let transformStyle = '';
            if (isDraggedItem) {
                const offset = dragState.currentY - dragState.startY;
                transformStyle = `translateY(${offset}px)`;
            }

            return (
              <div 
                key={cat} 
                className={`flex justify-between items-center border rounded-3xl transition-all duration-200
                  ${isDraggedItem 
                    ? 'bg-blue-50 border-blue-400 shadow-[0_20px_50px_rgba(37,99,235,0.25)] z-50 scale-[1.04] ring-8 ring-blue-500/10 cursor-grabbing' 
                    : isThisSectionDragging 
                        ? 'bg-gray-50/40 border-gray-100 opacity-40 scale-[0.98]' 
                        : 'bg-gray-50 border-gray-100'
                  } 
                  ${isBeingEdited ? 'ring-4 ring-blue-500/10 bg-white border-blue-300 z-10' : ''}
                  select-none touch-none
                `}
                style={{ 
                    transform: transformStyle,
                    transition: isDraggedItem ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s, opacity 0.3s, scale 0.3s',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                }}
              >
                {/* Visual Drag Handle - Dedicated interactive area */}
                <div 
                    className={`w-16 h-14 flex items-center justify-center transition-colors shrink-0 cursor-grab active:cursor-grabbing
                        ${isDraggedItem ? 'text-blue-600' : 'text-gray-300 active:text-gray-600'}
                    `}
                    onPointerDown={(e) => startDrag(e, index, type, cat)}
                    style={{ touchAction: 'none' }}
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
                      className="w-full p-2 bg-white border border-blue-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-100"
                      autoFocus
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(type, cat);
                          if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <span className={`text-sm font-bold truncate block transition-colors ${isDraggedItem ? 'text-blue-700' : 'text-gray-700'}`}>
                        {cat}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center shrink-0">
                  {isBeingEdited ? (
                    <button 
                        onPointerDown={(e) => { e.stopPropagation(); handleSaveEdit(type, cat); }} 
                        className="w-14 h-14 flex items-center justify-center text-green-600 active:bg-green-50 rounded-r-3xl transition-colors"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                  ) : (
                    <>
                      <button 
                        onPointerDown={(e) => { e.stopPropagation(); handleEditClick(type, cat); }} 
                        className={`w-14 h-14 flex items-center justify-center transition-colors hover:text-blue-600 active:bg-blue-50 ${isThisSectionDragging ? 'pointer-events-none text-gray-200' : 'text-gray-400'}`}
                        disabled={isThisSectionDragging}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
                        </svg>
                      </button>
                      
                      <button
                        onPointerDown={(e) => { e.stopPropagation(); onDeleteCategory(type, cat); }}
                        className={`w-14 h-14 flex items-center justify-center rounded-r-3xl transition-colors active:bg-red-50 active:scale-90 ${isThisSectionDragging ? 'pointer-events-none text-gray-200' : 'text-red-500'}`}
                        disabled={isThisSectionDragging}
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

        <div className="flex gap-3">
          <input
            type="text"
            value={newCatValue}
            onChange={e => setNewCatValue(e.target.value)}
            placeholder={`Add to ${title}...`}
            className="flex-grow p-4 bg-gray-50 border border-gray-100 rounded-3xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button 
            onClick={handleAdd} 
            className="bg-blue-600 text-white font-black px-7 py-4 rounded-3xl hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-600/20"
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
          <button onClick={onBack} className="flex items-center text-sm font-black text-gray-500 hover:text-gray-800 bg-gray-100 px-6 py-3.5 rounded-full transition-all active:scale-95 shadow-sm">
             <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
             </svg>
             Settings
          </button>
      </div>

      <div className="animate-fade-in-up">
        {renderCategoryManager('Income', 'income', settings.incomeCategories, newIncomeCat, setNewIncomeCat)}
        {renderCategoryManager('Expenses', 'expense', settings.expenseCategories, newExpenseCat, setNewExpenseCat)}
        {renderCategoryManager('Investments', 'investment', settings.investmentCategories, newInvestmentCat, setNewInvestmentCat)}
      </div>
    </div>
  );
};

export default EditCategories;
