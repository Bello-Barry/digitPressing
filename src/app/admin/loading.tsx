import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 space-y-6 animate-pulse max-w-5xl mx-auto">
      <div className="h-8 bg-slate-900 rounded-xl w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="h-32 bg-slate-900 rounded-2xl" />
        <div className="h-32 bg-slate-900 rounded-2xl" />
        <div className="h-32 bg-slate-900 rounded-2xl" />
        <div className="h-32 bg-slate-900 rounded-2xl" />
      </div>
      <div className="h-64 bg-slate-900 rounded-2xl w-full" />
    </div>
  );
}
