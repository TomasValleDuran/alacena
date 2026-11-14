import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'

import { suggestFromPantry } from '@/lib/suggest'
import { stockLevel, type StockRow } from '@/lib/types'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Icon } from './icon'
import { ProductThumb } from './product-thumb'

/**
 * Under the list's quick-add field: pantry products matching what's typed
 * (tap = add that product, linked), then always a last row to add the text
 * as a loose item (pilas, vasos…), so it's clear which of the two happens.
 */
export function ListSuggestions({
  query,
  disabled,
  onPickProduct,
  onAddText,
}: {
  query: string
  disabled?: boolean
  onPickProduct: (row: StockRow) => void
  onAddText: () => void
}) {
  const { c } = useTheme()
  const stock = useStock((s) => s.items)
  const shopping = useShopping((s) => s.items)
  const matches = useMemo(() => suggestFromPantry(stock, query), [stock, query])
  const pending = useMemo(
    () => new Set(shopping.filter((r) => !r.checked && r.productId).map((r) => r.productId!)),
    [shopping],
  )
  const text = query.trim()
  if (!text) return null

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {matches.length > 0 ? (
        <Text style={[t.caption, { color: c.text2, textTransform: 'uppercase', letterSpacing: 0.6, padding: space.md, paddingBottom: space.xs }]}>
          De la despensa
        </Text>
      ) : null}

      {matches.map((row) => {
        const listed = pending.has(row.productId)
        const level = stockLevel(row.quantity, row.minQty)
        const meta = level === 'out' ? 'Agotado' : `Hay ${row.quantity} en casa${level === 'low' ? ' · quedan pocos' : ''}`
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.product.name}, ${meta}`}
            accessibilityHint={listed ? 'Ya está en la lista' : 'Lo agrega a la lista'}
            accessibilityState={{ disabled: listed || disabled }}
            disabled={listed || disabled}
            onPress={() => onPickProduct(row)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              minHeight: 56,
              paddingHorizontal: space.md,
              paddingVertical: space.xs,
              backgroundColor: pressed ? c.fill : 'transparent',
            })}
          >
            <ProductThumb uri={row.product.imageUrl} blurHash={row.product.blurHash} size={40} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[t.callout, { color: c.text, fontWeight: '600' }]}>
                {row.product.name}
              </Text>
              <Text style={[t.footnote, { color: level === 'out' ? c.danger : level === 'low' ? c.warn : c.text2 }]}>
                {meta}
              </Text>
            </View>
            {listed ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="check" size={16} color={c.text2} />
                <Text style={[t.footnote, { color: c.text2 }]}>En la lista</Text>
              </View>
            ) : (
              <Icon name="modeAdd" size={26} color={c.accent} />
            )}
          </Pressable>
        )
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Agregar ${text} como ítem suelto`}
        disabled={disabled}
        onPress={onAddText}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: 52,
          paddingHorizontal: space.md,
          borderTopWidth: matches.length > 0 ? 1 : 0,
          borderTopColor: c.separator,
          backgroundColor: pressed ? c.fill : 'transparent',
        })}
      >
        <View style={{ width: 40, alignItems: 'center' }}>
          <Icon name="add" size={20} color={c.accent} />
        </View>
        <Text style={[t.callout, { color: c.text, flex: 1 }]} numberOfLines={2}>
          Agregar <Text style={{ fontWeight: '700' }}>“{text}”</Text>
          <Text style={{ color: c.text2 }}> como ítem suelto</Text>
        </Text>
      </Pressable>
    </View>
  )
}
