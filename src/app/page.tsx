'use client';

import dynamic from 'next/dynamic';
import { TableTideProvider, useTableTide } from '../context/TableTideContext';
import ReservationSidebar from '../components/ReservationSidebar';
import Navbar from '../components/Navbar';
import { useEffect } from 'react';

// Dynamically import FloorCanvas to disable SSR
const FloorCanvas = dynamic(() => import('../components/FloorCanvas'), {
  ssr: false,
});

function DashboardContent() {
  const { reservations, isMounted } = useTableTide();

  // Accidental refresh protection when reservations exist & SW registration
  useEffect(() => {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[TableTide] SW Registered successfully:', reg.scope))
        .catch((err) => console.error('[TableTide] SW Registration failed:', err));
    }

    // 2. BeforeUnload Listener
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (reservations.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have active floor reservations. Are you sure you want to refresh the floor manager?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [reservations]);

  if (!isMounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6f9] text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-slate-900 border-t-transparent animate-spin"></div>
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500">Loading Dockside Floor Console...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#f4f6f9] select-none text-slate-900">
      
      {/* 1. Reservation & Cover Management Sidebar */}
      <ReservationSidebar />

      {/* 2. Main Floor Layout Canvas Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Layout Modifiers and Toolbar */}
        <Navbar />
        
        {/* Dotted Grid Viewport Area */}
        <div className="flex-1 p-6 overflow-auto bg-[#f8fafc] flex items-center justify-center">
          <div className="w-full max-w-5xl h-full flex flex-col justify-center">
            <FloorCanvas />
            
            {/* Live Canvas Footer Helper */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1 font-mono uppercase tracking-wider font-bold">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-slate-700 bg-white"></span> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-amber-600 bg-[#fffbeb]"></span> Assigned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-emerald-600 bg-[#f0fdf4]"></span> Seated
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-slate-300 bg-[#f1f5f9]"></span> Completed
                </span>
              </div>
              <div>
                Shift-Click to select multiple • Snaps to 20px Grid
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function Home() {
  return (
    <TableTideProvider>
      <DashboardContent />
    </TableTideProvider>
  );
}
