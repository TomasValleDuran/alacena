import { router } from 'expo-router'
import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'

import { stockLevel, type StockRow as Row } from '@/lib/types'
import { space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { ProductThumb } from './product-thumb'
import { Stepper } from './stepper'

type Props = { row: Row; onAdjust: (row: Row, delta: number) => void }

export const StockRow = memo(function StockRow({ row, onAdjust }: Props) {
  const { c } = useTheme()
  const level = stockLevel(row.quantity, row.minQty)
  const status =
    level === 'out' ? 'Agotado' : level === 'low' ? `Quedan pocos · mín. ${row.minQty}` : null
  const meta = [row.product.brand, status].filter(Boolean).join(' · ')

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: space.sm, backgroundColor: c.surface }}>
      {/* the stepper is a sibling, not a child: buttons inside a button are invalid on web */}
      <Pressable
        onPress={() => router.push({ pathname: '/item/[id]', params: { id: row.id } })}
        accessibilityRole={process.env.EXPO_OS === 'web' ? 'link' : 'button'}
        accessibilityLabel={`${row.product.name}, ${row.quantity}${status ? `, ${status}` : ''}`}
        accessibilityHint="Abre el detalle"
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingLeft: space.lg,
          paddingRight: space.md,
          paddingVertical: space.md,
          backgroundColor: pressed ? c.fill : c.surface,
        })}
      >
        <ProductThumb uri={row.product.imageUrl} blurHash={row.product.blurHash} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[t.headline, { color: c.text }]} numberOfLines={2}>
            {row.product.name}
          </Text>
          {meta ? (
            <Text
              style={[
                t.footnote,
                { color: level === 'out' ? c.danger : level === 'low' ? c.warn : c.text2 },
              ]}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Stepper
        value={row.quantity}
        label={`Cantidad de ${row.product.name}`}
        tone={level === 'out' ? 'danger' : level === 'low' ? 'warn' : 'default'}
        onChange={(next) => onAdjust(row, next - row.quantity)}
      />
    </View>
  )
})
