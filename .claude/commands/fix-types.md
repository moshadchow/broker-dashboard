# /project:fix-types

Run `npx tsc --noEmit`, read all errors, and fix them.

## Steps

1. Run:
```bash
npx tsc --noEmit
```

2. For each error, apply the minimal fix. Do NOT refactor unrelated code.

3. Common fixes for this project:

**Recharts Tooltip type mismatch:**
```tsx
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

const CustomTooltip = ({
  active, payload, label, marketRow,
}: TooltipProps<ValueType, NameType> & { marketRow: MarketRow | null }) => { ... }

// In ComposedChart:
<Tooltip content={(props) => <CustomTooltip {...props} marketRow={marketRow} />} />
```

**Hook called with potentially stale params before first fetch:**
Simplify `activeParams` logic — just always pass `params` and guard inside the hook with `fetchTrigger`.

**Array.from map missing return type:**
Add explicit type annotation or use `Array(n).fill(null).map(...)`.

4. Re-run `npx tsc --noEmit` until output is clean (zero errors).
