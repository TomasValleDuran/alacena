import { router } from 'expo-router'
import Head from 'expo-router/head'
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui'
import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'

import { Icon, type IconName } from '@/components/icon'
import { useShopping } from '@/store/shopping'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

/**
 * Web tabs. expo-router's native tabs render a floating pill on web that sits
 * over the stack headers, so web gets its own shell on the headless
 * expo-router/ui tabs: a bottom bar on narrow windows, a sidebar from 900 px.
 * Screens (and their headers) take their width from one centred column.
 */
const WIDE = 900
const COLUMN = 760
const SIDEBAR = 220

const TABS: { name: string; href: '/' | '/scan' | '/list'; label: string; icon: IconName }[] = [
  { name: '(pantry)', href: '/', label: 'Despensa', icon: 'pantry' },
  { name: 'scan', href: '/scan', label: 'Escanear', icon: 'scan' },
  { name: '(list)', href: '/list', label: 'Lista', icon: 'cart' },
]

export default function TabsLayout() {
  const { c } = useTheme()
  const wide = useWindowDimensions().width >= WIDE
  const insets = useSafeAreaInsets()
  const toBuy = useShopping((s) => s.items.filter((r) => !r.checked).length)

  const triggers = TABS.map((tab) => (
    <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
      <TabButton label={tab.label} icon={tab.icon} badge={tab.name === '(list)' ? toBuy : 0} wide={wide} />
    </TabTrigger>
  ))

  return (
    <Tabs style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: c.bg }}>
      {wide ? (
        <TabList
          role="navigation"
          aria-label="Secciones"
          style={{
            width: SIDEBAR,
            flexDirection: 'column',
            justifyContent: 'flex-start',
            gap: space.xs,
            paddingHorizontal: space.md,
            paddingTop: space.xl + insets.top,
            paddingBottom: space.lg + insets.bottom,
            borderRightWidth: 1,
            borderRightColor: c.separator,
          }}
        >
          <Brand />
          {triggers}
          <View style={{ flex: 1 }} />
          <SettingsButton />
        </TabList>
      ) : null}

      <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: COLUMN, alignSelf: 'center' }}>
          <TabSlot />
        </View>
      </View>

      {wide ? null : (
        <TabList
          role="navigation"
          aria-label="Secciones"
          style={{
            paddingBottom: insets.bottom,
            borderTopWidth: 1,
            borderTopColor: c.separator,
            backgroundColor: c.bg,
          }}
        >
          {triggers}
        </TabList>
      )}
    </Tabs>
  )
}

/** react-native-web also reports hover in Pressable's style callback. */
type WebPressState = { pressed: boolean; hovered?: boolean }

type TabButtonProps =TabTriggerSlotProps & { label: string; icon: IconName; badge: number; wide: boolean }

/** Receives href/onPress/isFocused from <TabTrigger asChild>; with an href RNW renders a real link. */
function TabButton({ label, icon, badge, wide, isFocused, ref: _ref, ...props }: TabButtonProps) {
  const { c } = useTheme()
  const color = isFocused ? c.accent : c.text2
  const a11yLabel = badge > 0 ? `${label}, ${badge} para comprar` : label

  return (
    <Pressable
      {...props}
      aria-label={a11yLabel}
      aria-current={isFocused ? 'page' : undefined}
      style={(state) => {
        const { pressed, hovered } = state as WebPressState
        return wide
          ? {
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              minHeight: 44,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: isFocused ? c.accentSoft : pressed || hovered ? c.fill : 'transparent',
            }
          : {
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              minHeight: 60,
              paddingVertical: space.sm,
              backgroundColor: hovered && !isFocused ? c.fill : 'transparent',
              opacity: pressed ? 0.7 : 1,
            }
      }}
    >
      {isFocused ? (
        <Head>
          <title>{`${label} · Alacena`}</title>
        </Head>
      ) : null}
      <View
        style={
          wide
            ? null
            : {
                width: 56,
                height: 30,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isFocused ? c.accentSoft : 'transparent',
              }
        }
      >
        <Icon name={icon} size={wide ? 22 : 24} color={color} />
        {!wide && badge > 0 ? <Badge n={badge} style={{ position: 'absolute', top: -4, right: 4 }} /> : null}
      </View>
      <Text
        numberOfLines={1}
        style={[
          wide ? t.subhead : t.caption,
          { color: isFocused ? c.accent : wide ? c.text : c.text2, flexShrink: 1 },
        ]}
      >
        {label}
      </Text>
      {wide && badge > 0 ? <Badge n={badge} style={{ marginLeft: 'auto' }} /> : null}
    </Pressable>
  )
}

function Badge({ n, style }: { n: number; style?: object }) {
  const { c } = useTheme()
  return (
    <View
      aria-hidden
      style={[
        {
          minWidth: 18,
          height: 18,
          paddingHorizontal: 5,
          borderRadius: radius.pill,
          backgroundColor: c.danger,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text style={[t.caption, { fontSize: 11, lineHeight: 14, color: c.dangerSoft, fontVariant: ['tabular-nums'] }]}>
        {n > 99 ? '99+' : n}
      </Text>
    </View>
  )
}

function SettingsButton() {
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/settings')}
      style={(state) => {
        const { pressed, hovered } = state as WebPressState
        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: 44,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          backgroundColor: pressed || hovered ? c.fill : 'transparent',
        }
      }}
    >
      <Icon name="settings" size={22} color={c.text2} />
      <Text style={[t.subhead, { color: c.text }]}>Ajustes</Text>
    </Pressable>
  )
}

// assets/brand/svg/mark.svg (repo root), 100 × 100 box
const DOOR_L =
  'M21 30H42A5 5 0 0 1 47 35V81A5 5 0 0 1 42 86H21A5 5 0 0 1 16 81V35A5 5 0 0 1 21 30ZM41.5 48A2.5 2.5 0 0 1 44 50.5V61.5A2.5 2.5 0 0 1 41.5 64A2.5 2.5 0 0 1 39 61.5V50.5A2.5 2.5 0 0 1 41.5 48Z'
const DOOR_R =
  'M58 30H79A5 5 0 0 1 84 35V81A5 5 0 0 1 79 86H58A5 5 0 0 1 53 81V35A5 5 0 0 1 58 30ZM58.5 48A2.5 2.5 0 0 1 61 50.5V61.5A2.5 2.5 0 0 1 58.5 64A2.5 2.5 0 0 1 56 61.5V50.5A2.5 2.5 0 0 1 58.5 48Z'

function Brand() {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, marginBottom: space.lg }}>
      <Svg width={32} height={32} viewBox="0 0 100 100" aria-hidden>
        <Rect x={12} y={14} width={76} height={10} rx={4} fill={c.accent} />
        <Path d={DOOR_L} fill={c.accent} fillRule="evenodd" />
        <Path d={DOOR_R} fill={c.accent} fillRule="evenodd" />
      </Svg>
      <Text style={[t.title, { color: c.text }]}>Alacena</Text>
    </View>
  )
}
