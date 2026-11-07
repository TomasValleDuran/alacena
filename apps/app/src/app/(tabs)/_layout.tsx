import { NativeTabs } from 'expo-router/native-tabs'

import { useShopping } from '@/store/shopping'
import { useTheme } from '@/theme/use-theme'

export default function TabsLayout() {
  const { c } = useTheme()
  const toBuy = useShopping((s) => s.items.filter((r) => !r.checked).length)

  return (
    <NativeTabs tintColor={c.accent} indicatorColor={c.accentSoft}>
      <NativeTabs.Trigger name="(pantry)">
        <NativeTabs.Trigger.Icon sf={{ default: 'cabinet', selected: 'cabinet.fill' }} md="kitchen" />
        <NativeTabs.Trigger.Label>Despensa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scan">
        <NativeTabs.Trigger.Icon sf="barcode.viewfinder" md="barcode_scanner" />
        <NativeTabs.Trigger.Label>Escanear</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(list)">
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} md="shopping_cart" />
        <NativeTabs.Trigger.Label>Lista</NativeTabs.Trigger.Label>
        {toBuy > 0 ? <NativeTabs.Trigger.Badge>{String(toBuy)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
