import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function IronIcon({ className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 17h18a1 1 0 0 0 1-1V9a4 4 0 0 0-4-4H8.5a5.5 5.5 0 0 0-5.5 5.5V16a1 1 0 0 0 1 1z" />
      <path d="M6 9h10a2 2 0 0 1 2 2v1" />
      <path d="M3 20h18" />
      <circle cx="12" cy="13" r="0.5" fill="currentColor" />
      <circle cx="15" cy="13" r="0.5" fill="currentColor" />
    </svg>
  );
}
