'use client';

import { motion } from 'framer-motion';

export function HoverLift({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ x: -2, y: -2 }}
      whileTap={{ x: 2, y: 2 }}
      transition={{ duration: 0.12 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
