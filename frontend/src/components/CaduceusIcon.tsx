import React from 'react';

interface CaduceusIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const CaduceusIcon: React.FC<CaduceusIconProps> = ({ className = 'w-6 h-6', ...props }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Top Sphere Knob */}
      <circle cx="50" cy="8.5" r="5.5" />

      {/* Central Staff / Rod */}
      <path d="M 48.5 13 L 51.5 13 L 51 92 L 50 97.5 L 49 92 Z" />

      {/* Finial Rings below Sphere */}
      <rect x="47.5" y="14" width="5" height="1.8" rx="0.9" />
      <rect x="46.8" y="17" width="6.4" height="1.8" rx="0.9" />

      {/* Symmetrical Outspread Wings with Feather Tiers */}
      {/* Left Wing */}
      <path d="M 48 19.5 C 37 10.5 19 11 5 19 C 14.5 24 26 26.5 35 30.5 C 24.5 32 15 37 9 44.5 C 21 42 33 38.5 48 37.5 Z" />
      
      {/* Right Wing */}
      <path d="M 52 19.5 C 63 10.5 81 11 95 19 C 85.5 24 74 26.5 65 30.5 C 75.5 32 85 37 91 44.5 C 79 42 67 38.5 52 37.5 Z" />

      {/* Dual Intertwined Serpents (Staff of Caduceus) */}
      {/* Left Snake */}
      <path d="M 44.5 26.5 C 41.5 24.5 37 26.5 35 30.5 C 32.5 36 39 42.5 49 45.5 C 58.5 48.5 67 53.5 66 61.5 C 65 68.5 56 71 51 72 C 44 73.5 36.5 76.5 37.5 82.5 C 38.5 88 44.5 89.5 49 90.5 L 50 91.5 L 50 88 C 45.5 87 40.5 86 39.5 82.5 C 38.5 78.5 45.5 75.5 50 74.5 C 58 72.5 68 70 68 60.5 C 68 51.5 58 46.5 50 43.5 C 41.5 40.5 35.5 35.5 37.5 31 C 39 27.5 43 26.5 45.5 28.5 Z" />

      {/* Right Snake */}
      <path d="M 55.5 26.5 C 58.5 24.5 63 26.5 65 30.5 C 67.5 36 61 42.5 51 45.5 C 41.5 48.5 33 53.5 34 61.5 C 35 68.5 44 71 49 72 C 56 73.5 63.5 76.5 62.5 82.5 C 61.5 88 55.5 89.5 51 90.5 L 50 91.5 L 50 88 C 54.5 87 59.5 86 60.5 82.5 C 61.5 78.5 54.5 75.5 50 74.5 C 42 72.5 32 70 32 60.5 C 32 51.5 42 46.5 50 43.5 C 58.5 40.5 64.5 35.5 62.5 31 C 61 27.5 57 26.5 54.5 28.5 Z" />
    </svg>
  );
};
