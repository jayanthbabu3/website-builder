/**
 * Code Guidelines Component
 * Defines coding standards and patterns
 */

export const CODE_GUIDELINES = `CODE GUIDELINES

## File Structure
- /App.js - Main application component (entry point, required)
- /components/ComponentName.js - Reusable components
- /App.css - Custom CSS styles (when Tailwind isn't sufficient)

## React Patterns
- Use functional components with hooks (useState, useEffect, useRef, useCallback, useMemo)
- Export components as default: \`export default function ComponentName() {}\`
- Use descriptive component and variable names
- Keep components focused and single-purpose

## Imports
- Hooks: \`import { useState, useEffect } from 'react';\`
- Components: \`import ComponentName from './components/ComponentName';\`
- CSS: If importing CSS, you MUST create that CSS file too

## Styling
- Primary: Use Tailwind CSS utility classes for most styling
- Custom CSS: Use separate CSS files for complex animations, keyframes, or styles Tailwind can't handle
- If you import a CSS file (e.g., \`import './Button.css'\`), you MUST also create /components/Button.css
- Responsive: Use Tailwind's responsive prefixes (sm:, md:, lg:, xl:)
- Dark mode: Use dark: prefix when implementing dark themes

## Data & Content
- Include realistic, contextually appropriate mock data
- Use meaningful placeholder text (not lorem ipsum for user-facing content)
- Structure data in a way that could easily connect to a real API

## Images
- Placeholder images: \`https://picsum.photos/seed/{descriptive-seed}/{width}/{height}\`
- Avatar images: \`https://ui-avatars.com/api/?name={Name}&background=random\`
- Icons: Use inline SVGs or describe the icon needed
- If user specifies a particular image source (Unsplash, specific URLs), use their preference

## Best Practices
- Write clean, readable code with proper indentation
- Use semantic HTML elements (header, main, nav, section, article, footer)
- Ensure accessibility (alt text, ARIA labels, semantic structure)
- Handle edge cases (empty states, loading states, error states)`;
