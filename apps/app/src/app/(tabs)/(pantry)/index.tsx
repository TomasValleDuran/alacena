import { router, Stack, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native'

import { Button, IconButton } from '@/components/button'
import { Chips } from '@/components/chips'
import { Icon } from '@/components/icon'
import { ConnectionError, LoadingView, StateView } from '@/components/state-view'
import { StockRow } from '@/components/stock-row'
import { reportError } from '@/lib/alert'
import { api } from '@/lib/api'
import { feedback } from '@/lib/feedback'
import { useHasSidebar } from '@/lib/layout'
import { buildSections, matchesFilter, type PantrySection } from '@/lib/pantry-sections'
import type { StockRow as Row } from '@/lib/types'
import { GROUP_LABEL, SORT_LABEL, usePantryView, type PantryFilter } from '@/store/pantry-view'
import { useShopping } from '@/store/shopping'
import { useStock } from '@/store/stock'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

// once per app run: ask the server to categorize products saved before
// categories existed, then refresh so they land in the right aisle
let backfillRequested = false
function backfillCategoriesOnce(items: Row[]) {
  if (backfillRequested) return
  const missing = items.some((r) => !r.product.categories?.length && /^\d{6,14}$/.test(r.product.barcode))
  if (!missing) return
  backfillRequested = true
  api
    .backfillCategories()
    .then((r) => (r.updated > 0 ? useStock.getState().fetch({ silent: true }) : undefined))
    .catch(() => {
      backfillRequested = false // try again next time
    })
}

export default function PantryScreen() {
  const { c } = useTheme()
  const { items, status, error, refreshing, fetch, adjust } = useStock()
  const hasSidebar = useHasSidebar()
  const fetchShopping = useShopping((s) => s.fetch)
  const shopping = useShopping((s) => s.items)
  const { filter, setFilter, groupBy, sortBy, collapsed, toggleSection } = usePantryView()
  const [query, setQuery] = useState('')

  // first visit: a real load with spinner; later visits: silent refresh
  // (the web app or another phone may have changed things)
  useFocusEffect(
    useCallback(() => {
      void fetch({ silent: useStock.getState().status === 'ready' })
      void fetchShopping({ silent: useShopping.getState().status === 'ready' })
    }, [fetch, fetchShopping]),
  )

  const listed = useMemo(
    () => new Set(shopping.filter((r) => !r.checked && r.productId).map((r) => r.productId!)),
    [shopping],
  )

  const counts = useMemo(() => {
    const n = (f: PantryFilter) => items.filter((r) => matchesFilter(r, f, listed)).length
    return { all: items.length, restock: n('restock'), out: n('out'), inStock: n('inStock'), onList: n('onList') }
  }, [items, listed])

  const sections = useMemo(
    () => buildSections(items, { filter, query, groupBy, sortBy, listed }),
    [items, filter, query, groupBy, sortBy, listed],
  )

  // a search shows everything it finds, even inside collapsed sections
  const searching = query.trim().length > 0
  const listSections = useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        data: groupBy !== 'none' && !searching && collapsed.includes(s.key) ? [] : s.rows,
      })),
    [sections, collapsed, groupBy, searching],
  )

  useEffect(() => {
    if (status === 'ready') backfillCategoriesOnce(items)
  }, [status, items])

  const onAdjust = useCallback(
    (row: Row, delta: number) => {
      adjust(row, delta).catch((e) => reportError(e))
    },
    [adjust],
  )

  const header = (
    <Stack.Screen
      options={{
        headerSearchBarOptions: {
          placeholder: 'Buscar en la despensa',
          hideWhenScrolling: true,
          onChangeText: (e) => setQuery(e.nativeEvent.text),
          onCancelButtonPress: () => setQuery(''),
          // web's JS search field never fires onCancelButtonPress; closing it calls onClose
          onClose: () => setQuery(''),
        },
        // the wide web sidebar already has "Ajustes"
        headerRight: hasSidebar
          ? undefined
          : () => <IconButton icon="settings" label="Ajustes" onPress={() => router.push('/settings')} />,
      }}
    />
  )

  if (status !== 'ready') {
    return (
      <>
        {header}
        <SectionList
          sections={[]}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            status === 'error' ? <ConnectionError message={error} onRetry={() => fetch()} /> : <LoadingView />
          }
        />
      </>
    )
  }

  return (
    <>
      {header}
      <SectionList
        sections={listSections}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <StockRow row={item} onAdjust={onAdjust} />}
        renderSectionHeader={({ section }) =>
          groupBy === 'none' ? null : (
            <SectionHeader
              section={section}
              open={searching || !collapsed.includes(section.key)}
              onToggle={searching ? undefined : () => toggleSection(section.key)}
            />
          )
        }
        stickySectionHeadersEnabled
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetch()} />}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, marginLeft: space.lg + 52 + space.md, backgroundColor: c.separator }} />
        )}
        ListHeaderComponent={
          items.length > 0 ? (
            <View style={{ paddingBottom: space.xs }}>
              <Chips<PantryFilter>
                value={filter}
                onChange={setFilter}
                options={[
                  { key: 'all', label: 'Todo', count: counts.all },
                  { key: 'restock', label: 'Por reponer', count: counts.restock },
                  { key: 'out', label: 'Agotado', count: counts.out },
                  { key: 'inStock', label: 'Con stock', count: counts.inStock },
                  { key: 'onList', label: 'En la lista', count: counts.onList },
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Agrupar por ${GROUP_LABEL[groupBy]}, ordenar por ${SORT_LABEL[sortBy]}`}
                accessibilityHint="Cambia cómo se agrupa y ordena la despensa"
                onPress={() => router.push('/pantry-options')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.xs,
                  alignSelf: 'flex-start',
                  minHeight: 40,
                  marginLeft: space.lg - space.sm,
                  paddingHorizontal: space.sm,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? c.fill : 'transparent',
                })}
              >
                <Icon name="sort" size={16} color={c.accent} />
                <Text style={[t.subhead, { color: c.accent }]}>
                  {GROUP_LABEL[groupBy]} · {SORT_LABEL[sortBy]}
                </Text>
              </Pressable>
              {error ? (
                <Text style={[t.footnote, { color: c.danger, paddingHorizontal: space.lg }]}>
                  No se pudo actualizar: {error}
                </Text>
              ) : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          items.length === 0 ? (
            <StateView
              icon="pantry"
              title="La despensa está vacía"
              body="Escaneá lo que tenés en la alacena y vas a ver acá cuánto queda de cada cosa."
            >
              <Button label="Escanear productos" icon="scan" onPress={() => router.navigate('/scan')} />
            </StateView>
          ) : searching ? (
            <StateView icon="search" title="Sin resultados" body={`Nada coincide con “${query.trim()}”.`} />
          ) : (
            <StateView icon="pantry" title={EMPTY_FILTER[filter].title} body={EMPTY_FILTER[filter].body}>
              <Button label="Ver todo" variant="secondary" onPress={() => setFilter('all')} />
            </StateView>
          )
        }
      />
    </>
  )
}

const EMPTY_FILTER: Record<PantryFilter, { title: string; body: string }> = {
  all: { title: 'Nada para mostrar', body: '' },
  restock: {
    title: 'Nada por reponer',
    body: 'Acá aparece lo que llegó a su mínimo. Configurá el mínimo de cada producto desde su detalle.',
  },
  out: { title: 'No se acabó nada', body: 'Todo lo que tenés tiene al menos una unidad.' },
  inStock: { title: 'No queda nada con stock', body: 'Todos los productos están en cero.' },
  onList: { title: 'Nada de la despensa en la lista', body: 'Desde el detalle de un producto podés agregarlo a la lista.' },
}

function SectionHeader({
  section,
  open,
  onToggle,
}: {
  section: PantrySection
  open: boolean
  onToggle?: () => void
}) {
  const { c } = useTheme()
  const n = section.rows.length
  return (
    <Pressable
      accessibilityRole="button"
      aria-expanded={open}
      accessibilityLabel={`${section.title}, ${n} ${n === 1 ? 'producto' : 'productos'}${section.restock ? `, ${section.restock} por reponer` : ''}`}
      accessibilityHint={onToggle ? (open ? 'Cierra la sección' : 'Abre la sección') : undefined}
      disabled={!onToggle}
      onPress={() => {
        feedback.tick()
        onToggle?.()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 48,
        paddingHorizontal: space.lg,
        backgroundColor: pressed ? c.fill : c.bg,
        borderBottomWidth: open ? 0 : 1,
        borderBottomColor: c.separator,
      })}
    >
      <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
        <Icon name="chevron" size={14} color={c.text2} />
      </View>
      <Text style={[t.headline, { color: c.text, flexShrink: 1 }]} numberOfLines={1}>
        {section.title}
      </Text>
      <Text style={[t.callout, { color: c.text2, fontVariant: ['tabular-nums'] }]}>{n}</Text>
      <View style={{ flex: 1 }} />
      {section.restock > 0 ? (
        <View style={{ backgroundColor: c.warnSoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
          <Text style={[t.caption, { color: c.warn }]}>
            {section.restock} por reponer
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

