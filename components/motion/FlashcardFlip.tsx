'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface FlashcardFlipProps {
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  cardKey: string;
}

export function FlashcardFlip({
  flipped,
  front,
  back,
  cardKey,
}: FlashcardFlipProps) {
  return (
    <div
      style={{ perspective: '1500px' }}
      className="relative h-72 w-full"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cardKey + (flipped ? '-back' : '-front')}
          initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
        >
          {flipped ? back : front}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
