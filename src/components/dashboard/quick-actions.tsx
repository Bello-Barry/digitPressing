// src/components/dashboard/quick-actions.tsx
'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  shortcut?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const colorClasses = {
    primary: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
    success: 'bg-green-50 text-green-600 hover:bg-green-100 border-green-200',
    warning: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
    secondary: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Actions rapides</h2>
      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border-2 transition-all',
                colorClasses[action.color]
              )}
            >
              <div className="flex-shrink-0">
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{action.title}</p>
                <p className="text-sm opacity-75 truncate">{action.description}</p>
              </div>
              {action.shortcut && (
                <div className="flex-shrink-0">
                  <kbd className="px-2 py-1 text-xs font-semibold bg-white rounded border opacity-75">
                    {action.shortcut}
                  </kbd>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}