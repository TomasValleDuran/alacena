import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { feedback } from '@/lib/feedback'
import { MODE_COPY, useScan, type ScanMode } from '@/store/scan'
import { overlay, radius, space, type as t } from '@/theme/tokens'

import { Icon, type IconName } from './icon'

/*
 * Scan-screen controls drawn in the dark "glass" overlay palette. They read
 * and drive `useScan` themselves and carry no positioning: the screen lays
 * them out (over the camera preview natively, on a dark band on web).
 */

/**
 * + · 🔍 · − (Guardar · Consultar · Usar), icons only so it fits between the
 * torch and keyboard buttons; the names stay as accessibility labels and the
 * hint under the viewfinder spells out the current mode. The selected mode takes its own color so
 * "am I adding or subtracting?" reads at a glance: green adds, amber
 * subtracts, white just looks.
 */
export const MODE_UI: Record<ScanMode, { icon: IconName; bg: string; fg: string }> = {
  add: { icon: 'modeAdd', bg: overlay.accent, fg: overlay.onAccent },
  check: { icon: 'search', bg: overlay.text, fg: '#10120F' },
  use: { icon: 'modeUse', bg: overlay.warn, fg: '#2A1A00' },
}

/** Segmented Guardar / Consultar / Usar switch, 48 tall. `style` is for layout (e.g. `{ flex: 1 }` in a row). */
export function ModeSwitch({ style }: { style?: StyleProp<ViewStyle> }) {
  const mode = useScan((s) => s.mode)
  const setMode = useScan((s) => s.setMode)
  const modes: ScanMode[] = ['add', 'check', 'use']
  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          backgroundColor: overlay.glass,
          borderRadius: radius.pill,
          padding: 4,
        },
        style,
      ]}
    >
      {modes.map((m) => {
        const selected = m === mode
        const ui = MODE_UI[m]
        const fg = selected ? ui.fg : overlay.text
        return (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={MODE_COPY[m].label}
            accessibilityHint={MODE_COPY[m].hint}
            onPress={() => {
              if (!selected) feedback.tick()
              setMode(m)
            }}
            style={({ pressed }) => ({
              flex: 1,
              height: 40, // + 2×4 padding = 48, same as the round buttons beside it
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? ui.bg : pressed ? overlay.glassPressed : 'transparent',
            })}
          >
            <Icon name={ui.icon} size={24} color={fg} />
          </Pressable>
        )
      })}
    </View>
  )
}

/** Round 48pt glass icon button; `selected` turns it white (e.g. torch on). */
export function GlassIcon({
  icon,
  label,
  onPress,
  selected,
}: {
  icon: IconName
  label: string
  onPress: () => void
  selected?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? overlay.text : pressed ? overlay.glassPressed : overlay.glass,
      })}
    >
      <Icon name={icon} size={22} color={selected ? '#10120F' : overlay.text} />
    </Pressable>
  )
}

/** Pill under the viewfinder: the current mode and its hint, or "Buscando {code}…" with a spinner. */
export function StatusPill() {
  const mode = useScan((s) => s.mode)
  const busy = useScan((s) => s.busy)
  return (
    <View
      style={{
        backgroundColor: overlay.glass,
        borderRadius: radius.pill,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
      }}
      accessibilityLiveRegion="polite"
    >
      {busy ? <ActivityIndicator size="small" color={overlay.text} /> : null}
      <Text style={[t.subhead, { color: overlay.text }]}>
        {busy ? (
          `Buscando ${busy}…`
        ) : (
          <>
            <Text style={{ color: MODE_UI[mode].bg, fontWeight: '700' }}>{MODE_COPY[mode].label}</Text>
            {` · ${MODE_COPY[mode].hint}`}
          </>
        )}
      </Text>
    </View>
  )
}

/** The scan store's notice (e.g. a lookup error) as a tap-to-dismiss banner; renders nothing without one. */
export function ScanNotice() {
  const notice = useScan((s) => s.notice)
  const dismissNotice = useScan((s) => s.dismissNotice)
  if (!notice) return null
  return (
    <Pressable
      onPress={dismissNotice}
      accessibilityRole="alert"
      accessibilityHint="Toca para cerrar"
      style={{
        backgroundColor: overlay.glass,
        borderRadius: radius.md,
        padding: space.md,
        flexDirection: 'row',
        gap: space.sm,
        alignItems: 'center',
      }}
    >
      <Icon name="warning" size={18} color={overlay.danger} />
      <Text selectable style={[t.callout, { color: overlay.text, flex: 1 }]}>
        {notice.text}
      </Text>
      <Icon name="close" size={16} color={overlay.text2} />
    </Pressable>
  )
}
