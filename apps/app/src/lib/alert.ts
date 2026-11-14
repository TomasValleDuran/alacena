import { Alert } from 'react-native'

import { errorMessage } from './api'

/** Plain message with an OK button. Web: `alert.web.ts`. */
export function showAlert(title: string, message?: string) {
  Alert.alert(title, message)
}

/** For background (optimistic) actions that failed and were rolled back. */
export function reportError(e: unknown, title = 'No se pudo guardar') {
  Alert.alert(title, `${errorMessage(e)} El cambio se deshizo.`)
}

export function confirmDestructive(opts: {
  title: string
  message?: string
  confirm: string
  onConfirm: () => void
}) {
  Alert.alert(opts.title, opts.message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: opts.confirm, style: 'destructive', onPress: opts.onConfirm },
  ])
}
