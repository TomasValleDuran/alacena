import { ScanScreen } from '@/components/scan-screen'

/**
 * One thin route file on every platform. The screen is `scan-screen.tsx`
 * (camera, native) or `scan-screen.web.tsx` (keyboard-wedge console). Both
 * live outside `app/` on purpose: expo-router bundles every route file, a
 * `.web.tsx` sibling included, so camera code in a route ships in the web
 * export.
 */
export default function Scan() {
  return <ScanScreen />
}
