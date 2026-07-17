---
name: tailwind-performance
user-invocable: false
description: Use when optimizing Tailwind CSS v4 in React 19 and Next.js apps for production CSS size, source scanning, build performance, class composition, and runtime rendering.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Tailwind CSS - Performance Optimization

Tailwind CSS v4 uses a CSS-first compiler, automatic source detection, and `@theme` tokens. Optimize performance by keeping the CSS entry lean, using complete static class names in React components, and letting the framework production build handle minification and route-level splitting.

## Key Concepts

### CSS-First Entry Point

Use one app-level CSS entry that imports Tailwind and defines shared tokens:

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: #c50404;
  --color-surface: #f7f7f7;
  --font-sans: var(--font-inter);
}
```

### Source Detection

Tailwind v4 detects app sources automatically. Add `@source` only when classes live outside the normal app tree, such as a linked workspace package:

```css
@import "tailwindcss";
@source "../shared-ui";
```

## Best Practices

### 1. Keep Source Detection Narrow

Avoid adding broad `@source` directives. Point only at source folders that actually contain class names:

```css
/* Good: external shared package */
@source "../shared-ui";

/* Bad: broad dependency or output folders */
@source "../";
```

### 2. Use Complete Dynamic Class Alternatives

When UI state changes classes, keep every possible class name as a complete string:

```tsx
const tabClass = cn(
  "rounded-full px-4 py-2 text-sm transition-colors",
  selected ? "bg-brand text-white" : "bg-surface text-muted"
);
```

### 3. Avoid String Concatenation

Don't construct class names dynamically:

```jsx
// Bad: These classes won't be detected
<div className={`text-${size}`}>
<div className={`bg-${color}-500`}>

// Good: Use complete class names
<div className={size === 'large' ? 'text-lg' : 'text-sm'}>
<div className={color === 'red' ? 'bg-red-500' : 'bg-blue-500'}>

// Or map dynamic values to complete class names
```

### 4. Minimize Custom CSS

Rely on utilities to reduce overall CSS size:

```css
/* Bad: Custom CSS that duplicates utilities */
.my-button {
  background-color: #3b82f6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

/* Good: Use utilities or @apply */
@layer components {
  .my-button {
    @apply bg-blue-500 text-white px-4 py-2 rounded-md;
  }
}

/* Better: Component abstraction (no custom CSS) */
```

### 5. Let Next.js Minify CSS

Use the framework production build for CSS optimization:

```bash
npm run build
```

### 6. Use `@theme` Variables Strategically

Keep shared theme values in the Tailwind v4 `@theme` block:

```css
@theme {
  --color-brand: #c50404;
  --color-brand-dark: #a80303;
  --font-sans: var(--font-inter);

  --animate-fade-in: fade-in 0.2s ease-out;
}
```

## Build Optimization

### Next.js Configuration

Next.js optimizes the compiled Tailwind output during `next build`. Keep `next.config.ts` focused on app-level settings and avoid extra CSS tooling unless a measured bottleneck requires it.

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

## Performance Patterns

### 1. Code Splitting

Split CSS by route or component:

```javascript
// Using dynamic imports
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Tailwind classes in HeavyComponent will be in a separate chunk
```

### 2. Critical CSS

Extract critical CSS for above-the-fold UI:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Inline critical CSS */
    .hero { /* ... */ }
    .nav { /* ... */ }
  </style>
  <!-- Load full CSS async -->
  <link rel="preload" href="/styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles.css"></noscript>
</head>
```

### 3. Lazy Load Non-Critical Styles

```javascript
// Load additional styles when needed
if (shouldLoadDarkMode) {
  import('./dark-mode.css')
}
```

### 4. Font Optimization

Use `next/font` for font loading and expose the font through a Tailwind v4 theme variable:

```tsx
// app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
```

```css
@theme {
  --font-sans: var(--font-inter);
}
```

## Monitoring Performance

### Bundle Size Analysis

```bash
# Analyze CSS bundle size
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify

# Check file size
ls -lh dist/output.css

# Detailed analysis with webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
```

### Lighthouse Metrics

Target metrics:

- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **CSS Bundle Size**: < 50KB (gzipped)

### Performance Checklist

```markdown
✅ Tailwind is imported once from the app CSS entry
✅ Shared tokens live in `@theme`
✅ `@source` is used only for external source folders
✅ React class names are complete static strings
✅ Dynamic variants use conditionals or `cn()`
✅ Custom CSS is limited and intentional
✅ Fonts are loaded with `next/font`
✅ Client component boundaries are minimal
✅ Production output is checked with `next build`
```

## Examples

### Production Build Script

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

### CDN vs Bundle Comparison

```html
<!-- Bad: browser-side Tailwind compilation in production -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Good: framework-built CSS from the production bundle -->
<link href="/_next/static/css/app.css" rel="stylesheet">
```

## Common Pitfalls

### ❌ Using CDN Tailwind in Production

The CDN build performs browser-side compilation and is not appropriate for production apps. Always use the framework build output.

### ❌ Overly Broad `@source`

```css
/* Bad: broad source folders can scan dependencies or generated files */
@source "../";

/* Good: point only at an external package that contains classes */
@source "../shared-ui";
```

### ❌ Runtime Class Construction

```jsx
// Bad: Class is assembled from partial strings
const colors = ['red', 'blue', 'green']
<div className={`bg-${colors[index]}-500`} />

// Good: Use complete alternatives or a lookup table
const colorClasses = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
}
<div className={colorClasses[color]} />
```

### ❌ Importing Tailwind In Components

```javascript
// Bad: Imports Tailwind from a component boundary
import 'tailwindcss'

// Good: Import Tailwind once in the app CSS entry
import '@/app/globals.css'
```

## Anti-Patterns

### ❌ Don't Use @apply Excessively

```css
/* Bad: Defeating the purpose of utilities */
.btn { @apply px-4 py-2 bg-blue-500 text-white rounded; }
.card { @apply p-6 bg-white shadow-lg rounded-lg; }
.header { @apply flex items-center justify-between p-4; }
/* ...hundreds of components */

/* This negates Tailwind's optimization benefits */
```

### ❌ Don't Ignore Build Warnings

```bash
# Pay attention to warnings like:
# "Cannot resolve source path"
# "No utility classes were detected in your source files"
```

## Related Skills

- **tailwind-configuration**: Customizing Tailwind config and theme
- **tailwind-utility-classes**: Using Tailwind's utility classes effectively
- **tailwind-responsive-design**: Building responsive designs efficiently
