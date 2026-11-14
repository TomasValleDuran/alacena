import { errorMessage } from './api'

/**
 * react-native-web's Alert.alert is a no-op, so on web every confirmation and
 * error would silently vanish. The browser's own dialogs are blocking and
 * keyboard/screen-reader accessible. Their buttons can't be relabelled (the
 * `confirm` label is unused here), which works because confirmation titles are
 * already the question: "¿Quitar Yerba?" → Aceptar / Cancelar.
 */
function text(title: string, message?: string) {
  return message ? `${title}\n\n${message}` : title
}

export function showAlert(title: string, message?: string) {
  window.alert(text(title, message))
}

export function reportError(e: unknown, title = 'No se pudo guardar') {
  showAlert(title, `${errorMessage(e)} El cambio se deshizo.`)
}

export function confirmDestructive(opts: {
  title: string
  message?: string
  confirm: string
  onConfirm: () => void
}) {
  if (window.confirm(text(opts.title, opts.message))) opts.onConfirm()
}
