import React from 'react';
import { Loader2 } from 'lucide-react';

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="space-y-1">
          <div className="h-6 w-48 bg-slate-800 rounded-lg flex items-center space-x-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin ml-2" />
          </div>
          <div className="h-3 w-64 bg-slate-800/60 rounded" />
        </div>
        <div className="h-8 w-28 bg-slate-800 rounded-xl" />
      </div>

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="h-4 w-36 bg-slate-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-10 bg-slate-950 rounded-xl border border-slate-800/60" />
          <div className="h-10 bg-slate-950 rounded-xl border border-slate-800/60" />
          <div className="h-10 bg-slate-950 rounded-xl border border-slate-800/60" />
          <div className="h-10 bg-slate-950 rounded-xl border border-slate-800/60" />
        </div>
      </div>
    </div>
  );
}
