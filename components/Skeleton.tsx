
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rectangular' }) => {
  const baseClasses = "animate-pulse bg-slate-800/50";
  const radius = variant === 'circular' ? 'rounded-full' : variant === 'text' ? 'rounded' : 'rounded-2xl';
  
  return (
    <div className={`${baseClasses} ${radius} ${className}`} />
  );
};

export const DashboardSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-slate-900/30 border border-slate-800/50 p-6 rounded-2xl h-40 flex flex-col justify-between">
         <div className="flex justify-between items-start">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-16" variant="text" />
         </div>
         <div className="space-y-2">
            <Skeleton className="h-4 w-full" variant="text" />
            <Skeleton className="h-4 w-2/3" variant="text" />
         </div>
         <div className="flex justify-between items-center mt-2">
            <Skeleton className="h-3 w-20" variant="text" />
            <Skeleton className="h-8 w-8" variant="circular" />
         </div>
      </div>
    ))}
  </div>
);
