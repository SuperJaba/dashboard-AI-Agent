---
name: motion-recipes
description: Standard animation variants and transition presets for Framer Motion 12.
---

# Motion Recipes (Framer Motion 12)

Standardized animation patterns for dashboard UI transitions.

## Presets

### 1. Fade & Slide Up (Cards & Panels)
```tsx
export const fadeInUpVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } 
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
};
```

### 2. Staggered Container (Lists & Tile Grids)
```tsx
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 }
  }
};
```

### 3. Smooth Layout Shifts
- Use `layout` or `layoutId` on dynamic tiles and expanded cards.
- Wrap conditionally mounted views in `<AnimatePresence mode="wait">`.
