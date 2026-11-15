import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { Button } from '@/components/button'
import { Card } from '@/components/card'
import { PriceList } from '@/components/price-list'
import { ProductThumb } from '@/components/product-thumb'
import { ConnectionError, LoadingView, StateView } from '@/components/state-view'
import { Stepper } from '@/components/stepper'
import { confirmDestructive, reportError } from '@/lib/alert'
import { suggestedQty } from '@/lib/suggest'
import { stockLevel } from '@/lib/types'
import { isOnList, useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

export default function ItemScreen() {
  const { c } = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const row = useStock((s) => s.items.find((r) => r.id === id))
  const { adjust, setMinQty, remove, status, error, fetch } = useStock()
  const onList = useShopping((s) => isOnList(s.items, row?.productId))
  const addToList = useShopping((s) => s.addProduct)
  const [adding, setAdding] = useState(false)

  // opened directly (a reload or a shared link on web): nothing has loaded the pantry yet
  useEffect(() => {
    if (useStock.getState().status === 'idle') {
      void fetch()
      void useShopping.getState().fetch()
    }
  }, [fetch])

  if (!row && status !== 'ready') {
    return status === 'error' ? <ConnectionError message={error} onRetry={() => fetch()} /> : <LoadingView />
  }

  if (!row) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1 }}>
        <StateView icon="box" title="Ya no está en la despensa" body="Puede que se haya quitado desde otro dispositivo.">
          <Button label="Volver" variant="secondary" onPress={() => router.back()} />
        </StateView>
      </ScrollView>
    )
  }

  const p = row.product
  const level = stockLevel(row.quantity, row.minQty)
  const min = row.minQty ?? 0

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 48 }}
    >
      {/* identity */}
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        <ProductThumb uri={p.imageUrl} blurHash={p.blurHash} size={104} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text selectable style={[t.title, { color: c.text }]}>
            {p.name}
          </Text>
          {p.brand ? <Text style={[t.callout, { color: c.text2 }]}>{p.brand}</Text> : null}
          <Text
            selectable
            style={[t.footnote, { color: c.text2, fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace' }]}
          >
            {p.barcode.startsWith('MANUAL-') ? 'Sin código de barras' : p.barcode}
          </Text>
        </View>
      </View>

      {/* quantity */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={[t.headline, { color: c.text }]}>En casa</Text>
            <Text style={[t.footnote, { color: level === 'out' ? c.danger : level === 'low' ? c.warn : c.text2 }]}>
              {level === 'out' ? 'Agotado' : level === 'low' ? 'Quedan pocos' : p.unit ? `Unidad: ${p.unit}` : 'Unidades'}
            </Text>
          </View>
          <Stepper
            size="large"
            value={row.quantity}
            label={`Cantidad de ${p.name}`}
            tone={level === 'out' ? 'danger' : level === 'low' ? 'warn' : 'default'}
            onChange={(next) => adjust(row, next - row.quantity).catch((e) => reportError(e))}
          />
        </View>
      </Card>

      {/* threshold */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={[t.headline, { color: c.text }]}>Mínimo</Text>
            <Text style={[t.footnote, { color: c.text2 }]}>
              {min > 0 ? `Con ${min} o menos pasa a “Por reponer”` : 'Avisa recién cuando se acaba'}
            </Text>
          </View>
          <Stepper
            value={min}
            label={`Mínimo de ${p.name}`}
            onChange={(next) => setMinQty(row, next).catch((e) => reportError(e))}
          />
        </View>
      </Card>

      {/* live prices (pricely) */}
      <Card>
        <Text style={[t.headline, { color: c.text, marginBottom: space.xs }]}>Precios</Text>
        <PriceList productId={p.id} />
      </Card>

      <About categories={p.categories ?? []} description={p.description ?? null} />

      <View style={{ gap: space.sm }}>
        <Button
          label={onList ? 'Ya está en la lista' : 'Agregar a la lista'}
          icon={onList ? 'check' : 'cartAdd'}
          variant="secondary"
          disabled={onList}
          loading={adding}
          stretch
          onPress={() => {
            setAdding(true)
            // promise chain rather than try/finally: the React Compiler can't compile the latter
            addToList(row.productId, suggestedQty(row))
              .catch((e) => reportError(e, 'No se pudo agregar'))
              .finally(() => setAdding(false))
          }}
        />
        <Button
          label="Quitar de la despensa"
          icon="trash"
          variant="quiet"
          stretch
          onPress={() =>
            confirmDestructive({
              title: `¿Quitar ${p.name}?`,
              message: 'Deja de aparecer en la despensa. El producto queda en el catálogo para la próxima vez que lo escanees.',
              confirm: 'Quitar',
              onConfirm: () => {
                router.back()
                remove(row).catch((e) => reportError(e, 'No se pudo quitar'))
              },
            })
          }
        />
      </View>
    </ScrollView>
  )
}

/** Categories + description from pricely (filled in after the first price lookup). */
function About({ categories, description }: { categories: string[]; description: string | null }) {
  const { c } = useTheme()
  const [more, setMore] = useState(false)
  if (categories.length === 0 && !description) return null
  return (
    <View style={{ gap: space.md }}>
      {categories.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }} accessibilityLabel={`Categorías: ${categories.join(', ')}`}>
          {categories.map((name) => (
            <View
              key={name}
              style={{ backgroundColor: c.fill, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs }}
            >
              <Text style={[t.footnote, { color: c.text2 }]}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {description ? (
        <Pressable onPress={() => setMore((v) => !v)} accessibilityRole="button" accessibilityHint={more ? 'Muestra menos' : 'Muestra la descripción completa'}>
          <Text selectable numberOfLines={more ? undefined : 3} style={[t.callout, { color: c.text2, lineHeight: 21 }]}>
            {description}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
