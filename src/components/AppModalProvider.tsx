import { useIonAlert } from '@ionic/react'
import { useCallback, useMemo, type PropsWithChildren } from 'react'
import {
	AppModalContext,
	type AlertOptions,
	type ConfirmOptions,
	type ModalApi,
	type PromptOptions,
} from './appModalContext'

export const AppModalProvider = ({ children }: PropsWithChildren) => {
  const [present] = useIonAlert()

  const alert = useCallback(
    (options: AlertOptions): Promise<void> =>
      new Promise((resolve) => {
        void present({
          header: options.title,
          message: options.message,
          buttons: [{ text: options.confirmText ?? '閉じる', handler: () => { resolve() } }],
        })
      }),
    [present],
  )

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> =>
      new Promise((resolve) => {
        void present({
          header: options.title,
          message: options.message,
          buttons: [
            { text: options.cancelText ?? 'キャンセル', role: 'cancel', handler: () => { resolve(false) } },
            { text: options.confirmText ?? 'OK', handler: () => { resolve(true) } },
          ],
        })
      }),
    [present],
  )

  const prompt = useCallback(
    (options: PromptOptions): Promise<string | null> =>
      new Promise((resolve) => {
        void present({
          header: options.title,
          message: options.message,
          inputs: [{ name: 'value', type: 'text', value: options.defaultValue ?? '', placeholder: options.placeholder ?? '' }],
          buttons: [
            { text: options.cancelText ?? 'キャンセル', role: 'cancel', handler: () => { resolve(null) } },
            { text: options.confirmText ?? 'OK', handler: (data: { value?: string }) => { resolve(data.value?.trim() ?? null) } },
          ],
        })
      }),
    [present],
  )

  const api = useMemo<ModalApi>(
    () => ({ alert, confirm, prompt }),
    [alert, confirm, prompt],
  )

  return (
    <AppModalContext.Provider value={api}>
      {children}
    </AppModalContext.Provider>
  )
}
