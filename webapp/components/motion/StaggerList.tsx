'use client';

import { motion } from 'framer-motion';
import { staggerParent, staggerItem } from './variants';

export function StaggerList({
  children,
  className,
  as: As = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const Component = motion[As as 'div'];
  return (
    <Component
      initial="hidden"
      animate="visible"
      variants={staggerParent}
      className={className}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as: As = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const Component = motion[As as 'div'];
  return (
    <Component variants={staggerItem} className={className}>
      {children}
    </Component>
  );
}
