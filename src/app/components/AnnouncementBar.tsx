import React from 'react';
import { Leaf } from 'lucide-react';

export function AnnouncementBar() {
  const content = (
    <div className="flex shrink-0 items-center gap-6 sm:gap-8">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-6 sm:gap-8">
          <span className="font-extrabold text-[10px] sm:text-xs uppercase tracking-[0.18em] text-white font-outfit">
            PRE ORDER NOW TO GET FLAT 10% OFF — USE COUPON CODE: PREORDER10
          </span>
          <Leaf className="w-3.5 h-3.5 text-emerald-300 fill-emerald-300/40 shrink-0" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full bg-emerald-600 py-2 sm:py-2.5 overflow-hidden select-none border-b border-emerald-500/20 relative z-[110] shadow-sm">
      <div className="flex whitespace-nowrap animate-marquee">
        {content}
        {content}
      </div>
    </div>
  );
}
