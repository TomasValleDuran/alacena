import { Pressable, ScrollView, Text } from 'react-native'

import { feedback } from '@/lib/feedback'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

export type ChipOption<K extends string> = { key: K; label: string; count?: number }

/** Single-select filter chips (horizontal, scrolls if text is enlarged). */
export function Chips<K extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<K>[]
  value: K
  onChange: (key: K) => void
}) {
  const { c } = useTheme()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm }}
    >
      {options.map((o) => {
        const selected = o.key === value
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) feedback.tick()
              onChange(o.key)
            }}
            style={({ pressed }) => ({
              minHeight: 36,
              paddingHorizontal: space.lg,
              borderRadius: radius.pill,
              justifyContent: 'center',
              backgroundColor: selected ? c.text : pressed ? c.separator : c.fill,
            })}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <Text style={[t.subhead, { color: selected ? c.bg : c.text }]}>
              {o.label}
              {o.count != null ? (
                <Text style={{ fontVariant: ['tabular-nums'], color: selected ? c.bg : c.text2 }}>
                  {'  '}
                  {o.count}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
