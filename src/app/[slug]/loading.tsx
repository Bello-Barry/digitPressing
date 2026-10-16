import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-6 animate-pulse max-w-5xl mx-auto">
      <div className="h-10 bg-slate-900 rounded-2xl w-1/3" />
      <div className="h-40 bg-slate-900 rounded-3xl w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="h-28 bg-slate-900 rounded-2xl" />
        <div className="h-28 bg-slate-900 rounded-2xl" />
        <div className="h-28 bg-slate-900 rounded-2xl" />
      </div>
    </div>
  );
}
