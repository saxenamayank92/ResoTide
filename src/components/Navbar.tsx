'use client';

import React from 'react';
import { useTableTide } from '../context/TableTideContext';
import { 
  Square, Circle, Link, Unlink, Trash, 
  Monitor, Eye, BookOpen, Layers
} from 'lucide-react';
import LinkNext from 'next/link';

export default function Navbar() {
  const {
    addTable,
    selectedTableIds,
    setSelectedTableIds,
    tables,
    joinedGroups,
    joinSelectedTables,
    splitJoinedGroup,
    deleteTable,
  } = useTableTide();

  // B. Contextual button visibility logic
  const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id));
  const canJoin = selectedTables.length >= 2 && selectedTables.every((t) => !t.isJoined);
  
  // Find if a selected table belongs to a group
  const selectedJoinedGroup = selectedTables.find((t) => t.isJoined && t.parentId);
  const canSplit = !!selectedJoinedGroup;

  // Handles splitting selected group
  const handleSplit = () => {
    if (selectedJoinedGroup?.parentId) {
      splitJoinedGroup(selectedJoinedGroup.parentId);
      setSelectedTableIds([]);
    }
  };

  // Handles deleting selected tables
  const handleDelete = () => {
    selectedTableIds.forEach((id) => deleteTable(id));
    setSelectedTableIds([]);
  };

  return (
    <div className="w-full h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between z-10 shadow-sm">
      
      {/* 1. BUILDER ACTIONS PANEL */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-100 border border-zinc-200 rounded-lg p-1">
          <button
            onClick={() => addTable('rectangle')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition"
            title="Insert a rectangular table onto the floor"
          >
            <Square className="w-3.5 h-3.5 text-slate-500" />
            Add Rect
          </button>
          
          <button
            onClick={() => addTable('round')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition"
            title="Insert a circular banquet table onto the floor"
          >
            <Circle className="w-3.5 h-3.5 text-slate-500" />
            Add Round
          </button>
        </div>

        {/* 2. CONTEXTUAL CANVAS SELECTIONS ACTIONS */}
        {selectedTableIds.length > 0 && (
          <div className="flex items-center gap-2 animate-fadeIn border-l border-zinc-200 pl-4">
            
            {/* Join Tables */}
            {canJoin && (
              <button
                onClick={joinSelectedTables}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
              >
                <Link className="w-3.5 h-3.5" />
                Join Tables
              </button>
            )}

            {/* Split Tables */}
            {canSplit && (
              <button
                onClick={handleSplit}
                className="flex items-center gap-1.5 bg-slate-100 border border-zinc-300 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                <Unlink className="w-3.5 h-3.5" />
                Split Joined Group
              </button>
            )}

            {/* Delete Tables */}
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Trash className="w-3.5 h-3.5" />
              Delete Table ({selectedTableIds.length})
            </button>
          </div>
        )}
      </div>

      {/* 3. VIEW TOGGLER */}
      <div className="flex items-center gap-3">
        {/* Unified hostess panel active */}
      </div>

    </div>
  );
}
