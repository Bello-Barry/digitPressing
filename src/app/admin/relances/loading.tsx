import React from 'react';

export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse p-2 sm:p-4">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="h-7 w-48 bg-slate-800 rounded-xl" />
        <div className="h-9 w-32 bg-slate-800 rounded-xl" />
      </div>

      <div className="space-y-3 pt-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="h-4 w-1/3 bg-slate-800 rounded" />
              <div className="h-3 w-1/2 bg-slate-800/60 rounded" />
            </div>
            <div className="h-8 w-24 bg-slate-800 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
