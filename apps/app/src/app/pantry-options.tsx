import { Pressable, Text, View } from 'react-native'

import { Button } from '@/components/button'
import { Icon } from '@/components/icon'
import { closeSheet, Sheet } from '@/components/sheet'
import { AISLES } from '@/lib/aisles'
import { feedback } from '@/lib/feedback'
import { GROUP_LABEL, SORT_LABEL, usePantryView, type GroupBy, type SortBy } from '@/store/pantry-view'
import { space, type as t } from '@/theme/tokens'
import { useTheme } from '@/theme/use-theme'

const GROUP_HINT: Record<GroupBy, string> = {
  aisle: 'Almacén, Bebidas, Limpieza… como en el súper',
  status: 'Agotado, Por reponer, Con stock',
  none: 'Una sola lista',
}
const SORT_HINT: Record<SortBy, string> = {
  name: 'Alfabético',
  qty: 'Lo que menos hay, primero',
  recent: 'Lo último que cambió, primero',
}

/** Group / sort / collapse-all for the Despensa list. Changes apply live. */
export default function PantryOptionsSheet() {
  const { c } = useTheme()
  const { groupBy, sortBy, setGroupBy, setSortBy, setCollapsed } = usePantryView()

  const allKeys =
    groupBy === 'aisle'
      ? AISLES.map((a) => `aisle:${a.key}`)
      : groupBy === 'status'
        ? ['status:out', 'status:low', 'status:ok']
        : []

  return (
    <Sheet title="Agrupar y ordenar">
      <View style={{ padding: space.xl, paddingTop: space.xxl, gap: space.xl }}>
        <Group title="Agrupar por">
          {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
            <Radio key={g} label={GROUP_LABEL[g]} hint={GROUP_HINT[g]} selected={groupBy === g} onPress={() => setGroupBy(g)} />
          ))}
        </Group>

        <Group title="Ordenar">
          {(Object.keys(SORT_LABEL) as SortBy[]).map((s) => (
            <Radio key={s} label={SORT_LABEL[s]} hint={SORT_HINT[s]} selected={sortBy === s} onPress={() => setSortBy(s)} />
          ))}
        </Group>

        {groupBy !== 'none' ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Abrir todas" variant="secondary" onPress={() => setCollapsed([])} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Cerrar todas" variant="secondary" onPress={() => setCollapsed(allKeys)} />
            </View>
          </View>
        ) : null}

        <Button label="Listo" onPress={closeSheet} stretch />
        <Text style={[t.footnote, { color: c.text2, textAlign: 'center', marginTop: -space.sm }]}>
          Se recuerda en este dispositivo.
        </Text>
      </View>
    </Sheet>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={{ gap: space.xs }} accessibilityRole="radiogroup" accessibilityLabel={title}>
      <Text accessibilityRole="header" style={[t.title, { color: c.text, marginBottom: space.xs }]}>
        {title}
      </Text>
      {children}
    </View>
  )
}

function Radio({ label, hint, selected, onPress }: { label: string; hint: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        if (!selected) feedback.tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 52,
        paddingVertical: space.xs,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={selected ? 'radioOn' : 'unchecked'} size={24} color={selected ? c.accent : c.text2} />
      <View style={{ flex: 1 }}>
        <Text style={[t.body, { color: c.text, fontWeight: selected ? '600' : '400' }]}>{label}</Text>
        <Text style={[t.footnote, { color: c.text2 }]}>{hint}</Text>
      </View>
    </Pressable>
  )
}
