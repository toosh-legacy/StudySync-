'use client';

import { motion } from 'framer-motion';

interface HeroHeadlineProps {
  text: string;
  className?: string;
}

export function HeroHeadline({ text, className }: HeroHeadlineProps) {
  const words = text.split(' ');
  return (
    <motion.h1
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
      }}
      aria-label={text}
    >
      {words.map((word, wi) => (
        <span
          key={wi}
          style={{ display: 'inline-block', whiteSpace: 'nowrap', marginRight: '0.4em' }}
        >
          {word.split('').map((char, ci) => (
            <motion.span
              key={ci}
              variants={{
                hidden: { opacity: 0, y: 24, rotateX: -45 },
                visible: {
                  opacity: 1,
                  y: 0,
                  rotateX: 0,
                  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              style={{ display: 'inline-block' }}
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
}
