'use client';

import React, { useState } from 'react';
import { useTableTide } from '../context/TableTideContext';
import { Reservation, ReservationStatus } from '../types';
import { 
  Calendar, Plus, Trash2, CheckCircle2, User, Clock, 
  Users, ChevronLeft, ChevronRight, X, Sparkles, BookOpen, AlertTriangle
} from 'lucide-react';
import canvasConfetti from 'canvas-confetti';
import Link from 'next/link';

export default function ReservationSidebar() {
  const {
    reservations,
    tables,
    joinedGroups,
    activeReservationId,
    setActiveReservationId,
    activeDate,
    changeDate,
    addReservation,
    updateReservation,
    deleteReservation,
    clearDay,
    autoAssignAll,
  } = useTableTide();

  // Local component states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [pax, setPax] = useState(2);
  const [time, setTime] = useState('19:00');
  const [notes, setNotes] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    addReservation({
      guestName: guestName.trim(),
      pax,
      time,
      status: 'Pending',
      notes: notes.trim(),
      tableId: null,
    });

    // Reset form
    setGuestName('');
    setPax(2);
    setTime('19:00');
    setNotes('');
    setIsFormOpen(false);
  };

  // Helper to format date cleanly
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Switch date by +/- 1 day
  const handleShiftDate = (days: number) => {
    const current = new Date(activeDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    
    changeDate(`${year}-${month}-${day}`);
  };

  // Get assigned table or group name
  const getAssignedName = (tableId: string | null) => {
    if (!tableId) return null;
    
    if (tableId.startsWith('group_')) {
      const group = joinedGroups.find((g) => g.id === tableId);
      return group ? group.name : 'Joined Group';
    }
    
    const table = tables.find((t) => t.id === tableId);
    return table ? table.name : 'Table';
  };

  // Filter reservations for the active day
  const dayReservations = reservations.filter((r) => r.date === activeDate);

  // Status transition handler
  const handleStatusCycle = (res: Reservation) => {
    const statusSequence: ReservationStatus[] = ['Pending', 'Seated', 'Completed'];
    const currentIndex = statusSequence.indexOf(res.status);
    const nextStatus = statusSequence[(currentIndex + 1) % statusSequence.length];
    
    updateReservation(res.id, { status: nextStatus });

    // Confetti effect on completion!
    if (nextStatus === 'Completed') {
      canvasConfetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#15803d', '#d97706', '#1d4ed8'],
      });
    }
  };

  return (
    <div className="w-full lg:w-[420px] flex flex-col h-full bg-white border-r border-zinc-200 shadow-sm z-10">
      
      {/* 1. BRAND HEADER (Oakville Crest Embedded) */}
      <div className="p-5 border-b border-zinc-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3 select-none">
          <img 
            src="/oakville_club_logo.svg" 
            alt="Oakville Club Crest" 
            className="w-12 h-12 object-contain"
          />
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 font-serif leading-tight">Dockside</h1>
            <p className="text-[10px] text-amber-700 uppercase tracking-widest font-mono font-bold">The Oakville Club</p>
          </div>
        </div>
        
        {/* Date Navigator */}
        <div className="flex items-center gap-1 bg-slate-100 border border-zinc-200 rounded-lg p-1">
          <button 
            onClick={() => handleShiftDate(-1)} 
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold px-2 text-slate-700 min-w-[90px] text-center">
            {formatDisplayDate(activeDate)}
          </span>
          <button 
            onClick={() => handleShiftDate(1)} 
            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. STATS & CONTROL BAR */}
      <div className="px-5 py-3 border-b border-zinc-200 bg-slate-50/30 flex items-center justify-between text-xs text-slate-500">
        <div className="flex gap-3 font-medium">
          <div>
            Bookings: <span className="font-bold text-slate-900">{dayReservations.length}</span>
          </div>
          <div>
            Covers: <span className="font-bold text-slate-900">
              {dayReservations.reduce((sum, r) => sum + r.pax, 0)}
            </span>
          </div>
        </div>

        {/* AI Solver & Clear Day Triggers */}
        <div className="flex items-center gap-2">
          {dayReservations.some((r) => r.tableId === null) && (
            <button
              onClick={autoAssignAll}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-600/30 text-amber-800 font-bold py-1 px-2.5 rounded-lg transition shadow-sm animate-pulse"
              title="Automatically assign tables to all unassigned bookings using AI seating solver"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Auto-Assign</span>
            </button>
          )}

          {dayReservations.length > 0 && (
            <div className="relative">
              {showClearConfirm ? (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded px-2 py-1 text-rose-700 font-medium">
                  <span>Clear all?</span>
                  <button 
                    onClick={() => {
                      clearDay();
                      setShowClearConfirm(false);
                    }}
                    className="font-bold text-rose-800 hover:underline uppercase text-[10px]"
                  >
                    Yes
                  </button>
                  <span className="text-rose-200">|</span>
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="text-slate-400 hover:text-rose-600 transition flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-100 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Day
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. RESERVATION ADD FORM PANEL */}
      <div className="p-5 border-b border-zinc-200 bg-slate-50/10">
        {isFormOpen ? (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> New Cover Intake
              </h3>
              <button 
                type="button" 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guest Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Guest / Member Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Commodore Smith"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full bg-slate-50 border border-zinc-300 rounded-lg py-2 px-3 text-sm text-slate-900 placeholder-zinc-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20 transition font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Cover Count (Pax) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Covers (Pax)
                </label>
                <div className="flex items-center bg-slate-50 border border-zinc-300 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setPax(Math.max(1, pax - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 border border-zinc-200 text-slate-800 text-sm font-black"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center text-sm font-bold text-slate-800">{pax}</span>
                  <button
                    type="button"
                    onClick={() => setPax(pax + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 border border-zinc-200 text-slate-800 text-sm font-black"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Time */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Seating Time
                </label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-50 border border-zinc-300 rounded-lg py-2 px-3 text-sm text-slate-900 focus:outline-none focus:border-amber-600 transition h-[38px] font-bold"
                >
                  <option value="11:30">11:30</option>
                  <option value="12:00">12:00</option>
                  <option value="12:30">12:30</option>
                  <option value="13:00">13:00</option>
                  <option value="17:00">17:00</option>
                  <option value="17:30">17:30</option>
                  <option value="18:00">18:00</option>
                  <option value="18:30">18:30</option>
                  <option value="19:00">19:00</option>
                  <option value="19:30">19:30</option>
                  <option value="20:00">20:00</option>
                  <option value="20:30">20:30</option>
                  <option value="21:00">21:00</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Yacht Slip / Dietary Notes
              </label>
              <textarea
                placeholder="Slip 24 owner, gluten allergy, VIP..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-zinc-300 rounded-lg py-2 px-3 text-sm text-slate-900 placeholder-zinc-400 focus:outline-none focus:border-amber-600 transition resize-none font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg py-2.5 text-sm transition shadow-md shadow-slate-950/10 active:scale-[0.98]"
            >
              Confirm Cover Booking
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsFormOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-zinc-300 rounded-lg py-3 text-sm font-bold text-slate-700 hover:text-slate-900 transition group"
          >
            <Plus className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            Create Reservation
          </button>
        )}
      </div>

      {/* 4. RESERVATIONS LISTINGS */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/20">
        {dayReservations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 border border-dashed border-zinc-200 rounded-xl bg-white">
            <Calendar className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-500">No Seating Bookings</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Tap above to add a member's booking for today.
            </p>
          </div>
        ) : (
          dayReservations.map((res) => {
            const isAssigned = res.tableId !== null;
            const assignedName = getAssignedName(res.tableId);
            const isCurrentAssignee = activeReservationId === res.id;

            // Visual mapping based on Statuses
            let statusStyle = 'bg-slate-100 border border-zinc-300 text-slate-600';
            let cardBorderClass = 'border-zinc-200 hover:border-zinc-350 shadow-sm';
            let glowAccent = '';

            if (res.status === 'Pending') {
              statusStyle = 'bg-amber-50 text-amber-700 border-amber-600/30';
              cardBorderClass = isAssigned 
                ? 'border-amber-600/40 hover:border-amber-600/60' 
                : 'border-zinc-200';
              if (isAssigned) glowAccent = 'glow-gold';
            } else if (res.status === 'Seated') {
              statusStyle = 'bg-emerald-50 text-emerald-700 border-emerald-600/30';
              cardBorderClass = 'border-emerald-600/40 hover:border-emerald-600/60';
              glowAccent = 'glow-emerald';
            } else if (res.status === 'Completed') {
              statusStyle = 'bg-slate-100 text-slate-500';
              cardBorderClass = 'border-zinc-200 opacity-60 bg-slate-50/50 shadow-none';
            }

            if (isCurrentAssignee) {
              cardBorderClass = 'pulse-assign border-amber-500 border-2';
            }

            return (
              <div
                key={res.id}
                className={`p-4 rounded-xl border bg-white transition duration-200 ${cardBorderClass} ${glowAccent} relative overflow-hidden flex flex-col gap-3`}
              >
                {/* Status Indicator Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-slate-300"
                  style={{
                    backgroundColor: 
                      res.status === 'Pending' && isAssigned ? '#d97706' :
                      res.status === 'Seated' ? '#15803d' : 
                      res.status === 'Completed' ? '#64748b' : '#cbd5e1'
                  }}
                />

                {/* Card Title Header */}
                <div className="flex items-start justify-between">
                  <div className="pl-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900 tracking-tight text-md">{res.guestName}</span>
                    </div>
                    
                    {/* Time, Pax icons row */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono font-bold">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> {res.pax} Covers
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {res.time}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Delete */}
                  <button
                    onClick={() => deleteReservation(res.id)}
                    className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dietary Notes Display */}
                {res.notes && (
                  <div className="mx-1.5 p-2 bg-slate-50 border border-zinc-200 rounded-lg text-xs text-slate-600 leading-relaxed font-bold">
                    {res.notes}
                  </div>
                )}

                {/* Assignment & Status Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 pl-1.5">
                  
                  {/* Table Assignment Trigger */}
                  <div className="flex items-center gap-1 text-xs">
                    {isAssigned ? (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-600/30 text-amber-800 py-1 px-2.5 rounded-lg font-bold animate-fadeIn">
                        <span>Table {assignedName}</span>
                        <button 
                          onClick={() => updateReservation(res.id, { tableId: null })}
                          className="hover:bg-slate-200 rounded-full p-0.5 transition"
                        >
                          <X className="w-3 h-3 text-amber-600 hover:text-amber-900" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (isCurrentAssignee) {
                            setActiveReservationId(null);
                          } else {
                            setActiveReservationId(res.id);
                          }
                        }}
                        className={`py-1.5 px-3 rounded-lg font-bold transition text-[11px] border ${
                          isCurrentAssignee 
                            ? 'bg-amber-600 border-amber-600 text-white shadow-sm shadow-amber-500/20' 
                            : 'bg-white text-slate-700 hover:bg-slate-50 border-zinc-300'
                        }`}
                      >
                        {isCurrentAssignee ? 'Assigning...' : 'Assign Table'}
                      </button>
                    )}
                  </div>

                  {/* Status Button Toggle */}
                  <button
                    onClick={() => handleStatusCycle(res)}
                    className={`text-[10px] font-black py-1.5 px-3 rounded-lg border transition uppercase tracking-wider ${statusStyle}`}
                  >
                    {res.status}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
