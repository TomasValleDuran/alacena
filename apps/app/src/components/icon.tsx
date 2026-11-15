import { useFonts } from 'expo-font'
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols'
import material from 'expo-symbols/androidWeights/regular'
import { Text, View, type ColorValue } from 'react-native'

/**
 * One vocabulary, two native families: SF Symbols on iOS, Material Symbols on
 * Android. Screens use the semantic key, never a platform glyph name.
 *
 * `cp` is the Material Symbols codepoint. Off iOS (Android and web) we draw
 * the glyph ourselves instead of using SymbolView: its Text isn't centered
 * (and keeps Android's default font padding), so icons sat low and off-center
 * in round buttons. The fixed-size box means no layout shift while the font loads.
 */
const ICONS = {
  add: { ios: 'plus', android: 'add', cp: 57669 },
  remove: { ios: 'minus', android: 'remove', cp: 57691 },
  trash: { ios: 'trash', android: 'delete', cp: 59506 },
  scan: { ios: 'barcode.viewfinder', android: 'barcode_scanner', cp: 59148 },
  pantry: { ios: 'cabinet', android: 'kitchen', cp: 60231 },
  list: { ios: 'checklist', android: 'checklist', cp: 59057 },
  settings: { ios: 'gearshape', android: 'settings', cp: 59576 },
  torchOn: { ios: 'flashlight.on.fill', android: 'flashlight_on', cp: 61451 },
  torchOff: { ios: 'flashlight.off.fill', android: 'flashlight_off', cp: 61450 },
  keyboard: { ios: 'keyboard', android: 'keyboard', cp: 58130 },
  check: { ios: 'checkmark', android: 'check', cp: 58826 },
  checked: { ios: 'checkmark.circle.fill', android: 'check_circle', cp: 59500 },
  unchecked: { ios: 'circle', android: 'radio_button_unchecked', cp: 59446 },
  close: { ios: 'xmark', android: 'close', cp: 58829 },
  back: { ios: 'chevron.left', android: 'arrow_back', cp: 58820 },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', cp: 57702 },
  cartAdd: { ios: 'cart.badge.plus', android: 'add_shopping_cart', cp: 59476 },
  cart: { ios: 'cart', android: 'shopping_cart', cp: 59596 },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', cp: 57346 },
  offline: { ios: 'wifi.slash', android: 'wifi_off', cp: 58952 },
  camera: { ios: 'camera', android: 'photo_camera', cp: 58386 },
  box: { ios: 'shippingbox', android: 'inventory_2', cp: 57761 },
  chevron: { ios: 'chevron.right', android: 'chevron_right', cp: 58828 },
  putAway: { ios: 'tray.and.arrow.down', android: 'move_to_inbox', cp: 57704 },
  search: { ios: 'magnifyingglass', android: 'search', cp: 59574 },
  sort: { ios: 'arrow.up.arrow.down', android: 'swap_vert', cp: 59605 },
  radioOn: { ios: 'checkmark.circle.fill', android: 'radio_button_checked', cp: 59447 },
  modeAdd: { ios: 'plus.circle.fill', android: 'add_circle', cp: 57671 },
  modeUse: { ios: 'minus.circle.fill', android: 'do_not_disturb_on', cp: 58948 },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol; cp: number }>

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  if (process.env.EXPO_OS !== 'ios') return <MaterialGlyph cp={ICONS[name].cp} size={size} color={color} />
  const glyph = ICONS[name]
  return (
    <SymbolView
      name={{ ios: glyph.ios, android: glyph.android, web: glyph.android }}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  )
}

function MaterialGlyph({ cp, size, color }: { cp: number; size: number; color: ColorValue }) {
  const [loaded] = useFonts({ [material.name]: material.font })
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      {loaded ? (
        <Text
          aria-hidden
          selectable={false}
          allowFontScaling={false}
          style={{
            fontFamily: material.name,
            fontSize: size,
            lineHeight: size,
            width: size,
            height: size,
            color,
            textAlign: 'center',
            textAlignVertical: 'center',
            includeFontPadding: false,
          }}
        >
          {String.fromCharCode(cp)}
        </Text>
      ) : null}
    </View>
  )
}
