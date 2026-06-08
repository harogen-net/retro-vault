import { useIonAlert } from "@ionic/react";
import { useCallback, useMemo, useRef, type PropsWithChildren } from "react";
import {
    AppModalContext,
    type AlertOptions,
    type ConfirmOptions,
    type ModalApi,
    type PromptOptions,
} from "./appModalContext";

export const AppModalProvider = ({ children }: PropsWithChildren) => {
	const [present] = useIonAlert();
	const modalQueueRef = useRef<Promise<void>>(Promise.resolve());

	const enqueueModal = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
		const run = modalQueueRef.current.then(task);
		modalQueueRef.current = run.then(
			() => undefined,
			() => undefined
		);
		return run;
	}, []);

	const alert = useCallback(
		(options: AlertOptions): Promise<void> =>
			enqueueModal(
				() =>
					new Promise((resolve) => {
						void present({
							cssClass: "app-alert",
							header: options.title,
							message: options.message,
							buttons: [{ text: options.confirmText ?? "閉じる" }],
							onDidDismiss: () => {
								resolve();
							},
						});
					})
			),
		[enqueueModal, present]
	);

	const confirm = useCallback(
		(options: ConfirmOptions): Promise<boolean> =>
			enqueueModal(
				() =>
					new Promise((resolve) => {
						let confirmed = false;

						void present({
							cssClass: "app-alert",
							header: options.title,
							message: options.message,
							buttons: [
								{
									text: options.cancelText ?? "キャンセル",
									role: "cancel",
									handler: () => {
										confirmed = false;
										options.onCancel?.();
									},
								},
								{
									text: options.confirmText ?? "OK",
									handler: () => {
										confirmed = true;
										options.onConfirm?.();
									},
								},
							],
							onDidDismiss: () => {
								resolve(confirmed);
							},
						});
					})
			),
		[enqueueModal, present]
	);

	const prompt = useCallback(
		(options: PromptOptions): Promise<string | null> =>
			enqueueModal(
				() =>
					new Promise((resolve) => {
						let value: string | null = null;

						void present({
							cssClass: "app-alert",
							header: options.title,
							message: options.message,
							inputs: [
								{
									name: "value",
									type: "text",
									value: options.defaultValue ?? "",
									placeholder: options.placeholder ?? "",
								},
							],
							buttons: [
								{
									text: options.cancelText ?? "キャンセル",
									role: "cancel",
									handler: () => {
										value = null;
									},
								},
								{
									text: options.confirmText ?? "OK",
									handler: (data: { value?: string }) => {
										value = data.value?.trim() ?? null;
									},
								},
							],
							onDidDismiss: () => {
								resolve(value);
							},
						});
					})
			),
		[enqueueModal, present]
	);

	const api = useMemo<ModalApi>(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);

	return <AppModalContext.Provider value={api}>{children}</AppModalContext.Provider>;
};
