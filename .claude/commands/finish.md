# /project:finish

Wire App.tsx and verify the full build is type-error-free.

## Steps

1. Replace `src/App.tsx` with:
```tsx
import Dashboard from './components/Dashboard'

export default function App() {
  return <Dashboard />
}
```

2. Run type check:
```bash
npx tsc --noEmit
```

3. Fix ALL reported type errors before proceeding. Common issues to look for:
   - `useDashboardData` called with `null` → guard with a default params object
   - Recharts `content` prop type mismatch on `CustomTooltip` → cast with `as React.FC<TooltipProps<number, string>>`
   - Missing `key` props on mapped elements

4. Once `tsc --noEmit` passes with zero errors, run:
```bash
npm run dev
```

5. Open `http://localhost:5173`. Expected initial state:
   - Header visible
   - FilterBar with today's dates and "DSE"
   - Empty state message: "Set filters above and click Fetch Data to load."
   - No console errors

6. Paste your JWT into `.env.local`, restart dev server, click **Fetch Data**.
   - Table should render with broker rows + Aggregate + Market
   - Chart should render bars + reference lines
