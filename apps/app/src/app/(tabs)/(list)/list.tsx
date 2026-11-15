import { useFocusEffect } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from 'react-native'

import { Button } from '@/components/button'
import { Icon } from '@/components/icon'
import { ListSuggestions } from '@/components/list-suggestions'
import { ProductThumb } from '@/components/product-thumb'
import { ConnectionError, LoadingView, StateView } from '@/components/state-view'
import { Stepper } from '@/components/stepper'
import { reportError, showAlert } from '@/lib/alert'
import { errorMessage } from '@/lib/api'
import { feedback } from '@/lib/feedback'
import { suggestedQty } from '@/lib/suggest'
import { shoppingName, stockLevel, type ShoppingRow, type StockRow } from '@/lib/types'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { radius, space, type as t } from '@/theme/tokens'
import { useTabBottomInset } from '@/theme/use-tab-bottom-inset'
import { useTheme } from '@/theme/use-theme'

export default function ListScreen() {
  const { c } = useTheme()
  const bottomInset = useTabBottomInset()
  const { items, status, error, refreshing, fetch, addText, addProduct, addMissing, putAway, clearChecked } = useShopping()
  const stock = useStock((s) => s.items)
  const fetchStock = useStock((s) => s.fetch)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<null | 'add' | 'missing' | 'putAway'>(null)

  useFocusEffect(
    useCallback(() => {
      void fetch({ silent: useShopping.getState().status === 'ready' })
      void fetchStock({ silent: useStock.getState().status === 'ready' })
    }, [fetch, fetchStock]),
  )

  const toBuy = useMemo(() => items.filter((r) => !r.checked), [items])
  const inCart = useMemo(() => items.filter((r) => r.checked), [items])

  // same rule as the backend's /shopping/generate: low or out, and not on the list at all
  const missing = useMemo(() => {
    const listed = new Set(items.map((r) => r.productId).filter(Boolean))
    return stock.filter((r) => stockLevel(r.quantity, r.minQty) !== 'ok' && !listed.has(r.productId)).length
  }, [items, stock])

  const storable = inCart.filter((r) => r.productId).reduce((acc, r) => acc + r.quantity, 0)

  async function submitDraft() {
    const name = draft.trim()
    if (!name) return
    setBusy('add')
    try {
      await addText(name)
      setDraft('')
    } catch (e) {
      reportError(e, 'No se pudo agregar')
    } finally {
      setBusy(null)
    }
  }

  async function pickProduct(row: StockRow) {
    setBusy('add')
    try {
      await addProduct(row.productId, suggestedQty(row))
      setDraft('')
      feedback.success()
    } catch (e) {
      reportError(e, 'No se pudo agregar')
    } finally {
      setBusy(null)
    }
  }

  async function onAddMissing() {
    setBusy('missing')
    try {
      await addMissing()
      feedback.success()
    } catch (e) {
      reportError(e, 'No se pudo agregar')
    } finally {
      setBusy(null)
    }
  }

  async function onPutAway() {
    setBusy('putAway')
    try {
      await putAway()
      feedback.success()
    } catch (e) {
      // putAway removes each row right after storing it, so retrying is safe
      showAlert('No se terminó de guardar', `${errorMessage(e)} Lo que quedó tildado todavía no se guardó; podés reintentar.`)
    } finally {
      setBusy(null)
    }
  }

  if (status === 'idle' || status === 'loading' || status === 'error') {
    return (
      <SectionList
        sections={[]}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          status === 'error' ? <ConnectionError message={error} onRetry={() => fetch()} /> : <LoadingView />
        }
      />
    )
  }

  const sections = [
    ...(toBuy.length ? [{ key: 'toBuy', title: 'Para comprar', data: toBuy }] : []),
    ...(inCart.length ? [{ key: 'inCart', title: `En el carrito · ${inCart.length}`, data: inCart }] : []),
  ]

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <ListRow row={item} />}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: space.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetch()} />}
        renderSectionHeader={({ section }) => (
          <Text
            accessibilityRole="header"
            style={[
              t.caption,
              {
                color: c.text2,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                paddingHorizontal: space.lg,
                paddingTop: space.xl,
                paddingBottom: space.sm,
              },
            ]}
          >
            {section.title}
          </Text>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, marginLeft: 56, backgroundColor: c.separator }} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm }}>
            {/* quick add */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                backgroundColor: c.fill,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                paddingLeft: space.md,
              }}
            >
              <Icon name="add" size={20} color={c.text2} />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Buscá en la despensa o escribí algo"
                placeholderTextColor={c.text2}
                selectionColor={c.accent}
                accessibilityLabel="Agregar a la lista"
                accessibilityHint="Sugiere productos de la despensa; Enter lo agrega como ítem suelto"
                autoCorrect={false}
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={submitDraft}
                style={[t.body, { flex: 1, minHeight: 48, color: c.text }]}
              />
              {draft ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Borrar texto"
                  onPress={() => setDraft('')}
                  hitSlop={4}
                  style={{ paddingHorizontal: space.md, minHeight: 48, justifyContent: 'center' }}
                >
                  <Icon name="close" size={18} color={c.text2} />
                </Pressable>
              ) : null}
            </View>

            <ListSuggestions
              query={draft}
              disabled={busy === 'add'}
              onPickProduct={pickProduct}
              onAddText={submitDraft}
            />

            {/* low-stock nudge (hidden while typing, to keep suggestions clear) */}
            {missing > 0 && !draft.trim() ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  backgroundColor: c.warnSoft,
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                  padding: space.md,
                }}
              >
                <Icon name="warning" size={20} color={c.warn} />
                <Text style={[t.callout, { color: c.text, flex: 1 }]}>
                  {missing === 1 ? '1 producto está' : `${missing} productos están`} por acabarse y no {missing === 1 ? 'está' : 'están'} en la lista.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onAddMissing}
                  disabled={busy === 'missing'}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed || busy === 'missing' ? 0.6 : 1 })}
                >
                  <Text style={[t.headline, { color: c.warn }]}>Agregar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <StateView
            icon="list"
            title="Nada para comprar"
            body={
              missing > 0
                ? 'Usá el aviso de arriba para sumar lo que se está acabando, o escribí lo que necesites.'
                : 'Escribí lo que necesites arriba. Cuando algo de la despensa llegue a su mínimo, te lo sugerimos acá.'
            }
          />
        }
      />

      {/* after shopping: one tap puts it all away */}
      {inCart.length > 0 ? (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: bottomInset + space.md,
            gap: space.xs,
            backgroundColor: c.bg,
            borderTopWidth: 1,
            borderTopColor: c.separator,
          }}
        >
          {storable > 0 ? (
            <Button
              label={`Guardar ${storable} en la despensa`}
              icon="putAway"
              onPress={onPutAway}
              loading={busy === 'putAway'}
              stretch
            />
          ) : null}
          <Button
            label={storable > 0 ? 'Solo quitar de la lista' : `Quitar ${inCart.length} comprados`}
            variant={storable > 0 ? 'quiet' : 'primary'}
            disabled={busy === 'putAway'}
            onPress={() => clearChecked().catch((e) => reportError(e, 'No se pudo quitar'))}
            stretch
          />
        </View>
      ) : null}
    </View>
  )
}

const ListRow = memo(function ListRow({ row }: { row: ShoppingRow }) {
  const { c } = useTheme()
  const toggle = useShopping((s) => s.toggle)
  const setQuantity = useShopping((s) => s.setQuantity)
  const remove = useShopping((s) => s.remove)
  const name = shoppingName(row)

  function onToggle() {
    feedback.tick()
    toggle(row).catch((e) => reportError(e))
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        paddingRight: space.sm,
        minHeight: 60,
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        aria-checked={row.checked}
        accessibilityLabel={name}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingLeft: space.lg,
          paddingVertical: space.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon name={row.checked ? 'checked' : 'unchecked'} size={24} color={row.checked ? c.accent : c.text2} />
        {row.product ? <ProductThumb uri={row.product.imageUrl} blurHash={row.product.blurHash} size={40} /> : null}
        <Text
          numberOfLines={2}
          style={[
            t.body,
            {
              flex: 1,
              color: row.checked ? c.text2 : c.text,
              textDecorationLine: row.checked ? 'line-through' : 'none',
            },
          ]}
        >
          {name}
        </Text>
      </Pressable>
      {!row.checked ? (
        <Stepper
          value={row.quantity}
          min={1}
          label={`Cantidad de ${name}`}
          onChange={(q) => setQuantity(row, q).catch((e) => reportError(e))}
          onRemove={() => remove(row).catch((e) => reportError(e, 'No se pudo quitar'))}
        />
      ) : (
        <Text style={[t.callout, { color: c.text2, paddingHorizontal: space.md, fontVariant: ['tabular-nums'] }]}>
          ×{row.quantity}
        </Text>
      )}
    </View>
  )
})

