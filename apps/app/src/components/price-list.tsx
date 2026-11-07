import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { money, priceAge } from '@/lib/format'
import { myMarkets, myMarketsLabel, type MyPrice } from '@/lib/markets'
import { useInsights } from '@/store/insights'
import { radius, space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

import { Icon } from './icon'

/**
 * Live prices for a product at *our* supermarkets (see lib/markets.ts),
 * cheapest first, with the cheapest called out. Other markets are ignored.
 */
export function PriceList({ productId }: { productId: string }) {
  const { c } = useTheme()
  const entry = useInsights((s) => s.byProduct[productId])
  const load = useInsights((s) => s.load)

  useEffect(() => {
    void load(productId)
  }, [productId, load])

  if (!entry || entry.status === 'loading') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm }}>
        <ActivityIndicator size="small" color={c.text2} />
        <Text style={[t.footnote, { color: c.text2 }]}>Buscando precios…</Text>
      </View>
    )
  }

  if (entry.status === 'error') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => load(productId, { force: true })}
        style={{ paddingVertical: space.sm }}
        hitSlop={8}
      >
        <Text style={[t.footnote, { color: c.text2 }]}>
          No se pudieron cargar los precios. <Text style={{ color: c.accent, fontWeight: '600' }}>Reintentar</Text>
        </Text>
      </Pressable>
    )
  }

  const markets = myMarkets(entry.data.prices?.markets ?? [])
  if (markets.length === 0) {
    return (
      <Text style={[t.footnote, { color: c.text2, paddingVertical: space.sm }]}>
        No hay precios en {myMarketsLabel()}.
      </Text>
    )
  }

  const cheapest = markets[0]
  const priciest = markets[markets.length - 1]
  // spread between our cheapest and our most expensive: "is it worth choosing?"
  const spread = markets.length > 1 ? Math.round((1 - cheapest.unitPrice / priciest.unitPrice) * 100) : 0

  return (
    <View style={{ gap: space.xs }}>
      {markets.length > 1 ? (
        <Text style={[t.footnote, { color: c.text2 }]}>
          {spread >= 3
            ? `En ${cheapest.market} pagás ${spread}% menos que en ${priciest.market}`
            : 'Cuesta casi lo mismo en todos'}
        </Text>
      ) : null}

      <View style={{ gap: 2 }}>
        {markets.map((m, i) => (
          <MarketRow key={m.market} m={m} best={i === 0 && markets.length > 1 && spread >= 1} />
        ))}
      </View>
    </View>
  )
}

function MarketRow({ m, best }: { m: MyPrice; best: boolean }) {
  const { c } = useTheme()
  const age = priceAge(m.updatedAt)
  const label = `${m.market}, ${money(m.unitPrice)}${m.bundlePrice ? `, llevando ${m.bundleSize} ${money(m.bundlePrice)} cada uno` : m.promo ? `, promo ${m.promo}` : ''}${best ? ', el más barato' : ''}`

  return (
    <Pressable
      accessibilityRole={m.url ? 'link' : 'text'}
      accessibilityLabel={label}
      accessibilityHint={m.url ? 'Abre el producto en la web del súper' : undefined}
      disabled={!m.url}
      onPress={() => m.url && WebBrowser.openBrowserAsync(m.url)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        minHeight: 44,
        paddingHorizontal: space.sm,
        marginHorizontal: -space.sm,
        borderRadius: radius.sm,
        backgroundColor: best ? c.accentSoft : pressed ? c.fill : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={[t.callout, { color: c.text, fontWeight: best ? '700' : '500' }]}>{m.market}</Text>
          {m.promo ? (
            <View style={{ backgroundColor: c.warnSoft, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={[t.caption, { color: c.warn }]}>{m.promo}</Text>
            </View>
          ) : null}
        </View>
        {best || age || m.bundlePrice ? (
          <Text style={[t.caption, { color: best ? c.accent : c.text2, fontWeight: best ? '600' : '400' }]}>
            {[
              best ? 'El más barato' : null,
              m.bundlePrice ? `Llevando ${m.bundleSize}: ${money(m.bundlePrice)} c/u` : null,
              age,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[t.headline, { color: c.text, fontVariant: ['tabular-nums'] }]}>{money(m.unitPrice)}</Text>
        {m.listPrice && !m.bundlePrice ? (
          <Text
            style={[t.caption, { color: c.text2, textDecorationLine: 'line-through', fontWeight: '400', fontVariant: ['tabular-nums'] }]}
          >
            {money(m.listPrice)}
          </Text>
        ) : null}
      </View>
      {m.url ? <Icon name="chevron" size={14} color={c.text2} /> : null}
    </Pressable>
  )
}
