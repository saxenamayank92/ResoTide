'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FloorPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6f9] text-slate-500 font-mono text-xs uppercase tracking-widest font-bold">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin"></div>
        <span>Redirecting to Unified Cockside Console...</span>
      </div>
    </div>
  );
}
