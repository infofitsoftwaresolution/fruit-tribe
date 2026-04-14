import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToPayProps {
  onSuccess: () => void;
  submitting?: boolean;
  className?: string;
  themeStyle?: string;
}

export function SwipeToPay({ onSuccess, submitting, className, themeStyle }: SwipeToPayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const [complete, setComplete] = useState(false);
  const width = containerRef.current?.offsetWidth || 300;
  
  // Drag thumb constraints
  const dragConstraintsParams = { left: 0, right: width > 80 ? width - 64 : 200 };

  // Interpolations
  const bgWidth = useTransform(dragX, [0, dragConstraintsParams.right], [64, width]);
  const textOpacity = useTransform(dragX, [0, width / 2], [1, 0]);

  // Handle external submit resets
  useEffect(() => {
    if (submitting) setComplete(true);
    if (!submitting && complete) {
      // Revert if submitting failed
      setTimeout(() => {
         setComplete(false);
         dragX.set(0);
      }, 500);
    }
  }, [submitting]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x >= dragConstraintsParams.right - 20) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([30, 50, 30]);
      setComplete(true);
      onSuccess();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-16 sm:h-20 bg-slate-900 overflow-hidden flex items-center justify-center p-2 shadow-2xl",
        themeStyle === 'round' ? 'rounded-full' : themeStyle === 'square' ? 'rounded-md' : 'rounded-2xl sm:rounded-[1.75rem]',
        className
      )}
    >
      <motion.div style={{ opacity: textOpacity }} className="absolute text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-white/50 z-10 pointer-events-none pr-8">
        {submitting ? 'Placing Order...' : 'Swipe to Pay'}
      </motion.div>
      
      {/* Expanding progress background */}
      <motion.div
        style={{ width: bgWidth }}
        className="absolute left-0 top-0 bottom-0 bg-emerald-500 z-0 origin-left"
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      />
      
      {/* Slider Thumb */}
      <motion.div
        drag={!complete && !submitting ? "x" : false}
        dragConstraints={dragConstraintsParams}
        dragSnapToOrigin={!complete}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        animate={complete ? { x: dragConstraintsParams.right } : {}}
        className={cn(
          "h-12 w-12 sm:h-16 sm:w-16 bg-white shadow-xl flex items-center justify-center z-20 absolute cursor-grab active:cursor-grabbing",
          themeStyle === 'round' ? 'rounded-full' : themeStyle === 'square' ? 'rounded-sm' : 'rounded-[1.2rem]'
        )}
        style={{ x: dragX, left: '8px' }}
      >
        {submitting ? (
           <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 animate-spin" />
        ) : complete ? (
           <Check className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
        ) : (
           <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" />
        )}
      </motion.div>
    </div>
  );
}
