import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function SuitIcon({ className = 'w-5 h-5', ...props }: IconProps) {
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
      <path d="M4 4l4 2 4 8 4-8 4-2v16H4V4z" />
      <path d="M12 14v6" />
      <path d="M10 10l2 2 2-2" />
      <path d="M8 6l4 3 4-3" />
    </svg>
  );
}
