import { Pressable, ScrollView, Text, View } from 'react-native'

import { reportError } from '@/lib/alert'
import { feedback } from '@/lib/feedback'
import { stockLevel } from '@/lib/types'
import { useScan, type LogEntry } from '@/store/scan'
import { isOnList, useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Button } from './button'
import { Card } from './card'
import { PriceList } from './price-list'
import { ProductThumb } from './product-thumb'
import { Stepper } from './stepper'

/*
 * What a scan did, shown under the scanner as elevated cards. They read and
 * drive `useScan` / `useStock` / `useShopping` themselves and carry no
 * positioning: the screen stacks them where it wants.
 */

/** Guardar / Usar: units per scan + what this session did, with undo. */
export function SessionPanel() {
  const { c } = useTheme()
  const { mode, perScan, setPerScan, log, clearSession } = useScan()
  const live = log.filter((e) => !e.undone)
  const units = live.reduce((acc, e) => acc + Math.abs(e.delta), 0)
  const heading = `${mode === 'add' ? 'Sumar' : 'Restar'} por escaneo`

  return (
    <Card elevated>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[t.subhead, { color: c.text }]}>{heading}</Text>
          <Text style={[t.footnote, { color: c.text2 }]}>
            {perScan === 1 ? 'De a uno' : `Packs de ${perScan}`}
          </Text>
        </View>
        <Stepper
          value={perScan}
          onChange={setPerScan}
          min={1}
          max={99}
          label={heading}
          format={(n) => `×${n}`}
          valueWidth={40}
        />
      </View>

      {log.length > 0 ? (
        <>
          <View style={{ height: 1, backgroundColor: c.separator }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[t.footnote, { color: c.text2, flex: 1 }]}>
              Esta sesión: {live.length} {live.length === 1 ? 'escaneo' : 'escaneos'} · {units}{' '}
              {units === 1 ? 'unidad' : 'unidades'}
            </Text>
            <Pressable onPress={clearSession} hitSlop={12} accessibilityRole="button">
              <Text style={[t.footnote, { color: c.accent, fontWeight: '600' }]}>Limpiar</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 196 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: space.xs }}>
              {log.slice(0, 8).map((e) => (
                <LogRow key={e.key} entry={e} />
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}
    </Card>
  )
}

/** One session log line: product, ±N · stock left, and "A la lista" (when it ran out) / "Deshacer". */
export function LogRow({ entry }: { entry: LogEntry }) {
  const { c } = useTheme()
  const undo = useScan((s) => s.undo)
  const onList = useShopping((s) => isOnList(s.items, entry.product.id))
  const addToList = useShopping((s) => s.addProduct)
  const sign = entry.delta > 0 ? '+' : '−'
  const ranOut = entry.total === 0 && entry.delta < 0

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: entry.undone ? 0.45 : 1 }}
    >
      <ProductThumb uri={entry.product.imageUrl} blurHash={entry.product.blurHash} size={40} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[t.callout, { color: c.text, fontWeight: '600' }]}>
          {entry.product.name}
        </Text>
        <Text style={[t.footnote, { color: ranOut ? c.danger : c.text2, fontVariant: ['tabular-nums'] }]}>
          {entry.undone
            ? 'Deshecho'
            : `${sign}${Math.abs(entry.delta)} · ${ranOut ? 'se acabó' : `hay ${entry.total}`}`}
        </Text>
      </View>
      {!entry.undone && ranOut && !onList ? (
        <SmallAction
          label="A la lista"
          onPress={() => addToList(entry.product.id).catch((e) => reportError(e, 'No se pudo agregar'))}
        />
      ) : null}
      {!entry.undone ? <SmallAction label="Deshacer" onPress={() => undo(entry.key)} /> : null}
    </View>
  )
}

/** Compact capsule text button for log rows (32 tall, padded to a 48pt hit area). */
export function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => ({
        minHeight: 32,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        justifyContent: 'center',
        backgroundColor: pressed ? c.separator : c.fill,
      })}
    >
      <Text style={[t.footnote, { color: c.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  )
}

/** Consultar: "¿tengo esto en casa?" — answer first, quick fixes second. */
export function CheckResult() {
  const { c } = useTheme()
  const product = useScan((s) => s.checked)
  const row = useStock((s) => (product ? s.items.find((r) => r.productId === product.id) : undefined))
  const adjust = useStock((s) => s.adjust)
  const adjustProduct = useStock((s) => s.adjustProduct)
  const onList = useShopping((s) => isOnList(s.items, product?.id))
  const addToList = useShopping((s) => s.addProduct)

  if (!product) {
    return (
      <Card elevated>
        <Text style={[t.callout, { color: c.text2, textAlign: 'center', paddingVertical: space.sm }]}>
          Escaneá algo para ver cuánto hay en casa y cuánto sale en cada súper. Nada cambia en este modo.
        </Text>
      </Card>
    )
  }

  const qty = row?.quantity ?? 0
  const level = row ? stockLevel(row.quantity, row.minQty) : 'out'
  const answer = !row ? 'No está en la despensa' : qty === 0 ? 'Se acabó' : `Hay ${qty} en casa`

  return (
    <Card elevated>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <ProductThumb uri={product.imageUrl} blurHash={product.blurHash} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[t.headline, { color: c.text }]}>
            {product.name}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[t.title, { color: level === 'out' ? c.danger : level === 'low' ? c.warn : c.accent }]}
          >
            {answer}
          </Text>
          {level === 'low' ? (
            <Text style={[t.footnote, { color: c.warn }]}>Por debajo del mínimo ({row?.minQty})</Text>
          ) : null}
        </View>
      </View>
      {/* prices can be long (10+ markets expanded): scroll inside the card */}
      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 1, backgroundColor: c.separator, marginBottom: space.sm }} />
        <PriceList productId={product.id} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={onList ? 'En la lista' : 'A la lista'}
            icon={onList ? 'check' : 'cartAdd'}
            variant="secondary"
            disabled={onList}
            onPress={() => addToList(product.id).catch((e) => reportError(e, 'No se pudo agregar'))}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Sumar 1"
            icon="add"
            variant="secondary"
            onPress={() => {
              feedback.success()
              ;(row ? adjust(row, 1) : adjustProduct(product, 1).then(() => {})).catch((e) => reportError(e))
            }}
          />
        </View>
      </View>
    </Card>
  )
}
