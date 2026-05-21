'use client';

import { motion } from 'framer-motion';
import { fadeUp } from './variants';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}
