# /project:scaffold

Scaffold the broker-dashboard Vite + React + TypeScript project from scratch.

## Steps

1. Run:
```bash
npm create vite@latest broker-dashboard -- --template react-ts
cd broker-dashboard
npm install recharts axios tailwindcss @tailwindcss/vite
```

2. Replace `vite.config.ts` with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://uat.xfltrade.com:20121',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

3. Create `.env.local`:
```
VITE_JWT_TOKEN=PASTE_YOUR_TOKEN_HERE
```

4. Add `.env.local` to `.gitignore`.

5. Delete: `src/App.css`, `src/assets/react.svg`

6. Replace `src/App.tsx` with bare shell:
```tsx
export default function App() {
  return <div />
}
```

7. Replace `src/index.css` with:
```css
@import "tailwindcss";
```

Confirm: `npm run dev` starts without errors.
