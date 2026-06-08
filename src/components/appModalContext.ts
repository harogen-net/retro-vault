import { createContext, useContext } from "react";

export type BaseOptions = {
	title: string;
	message?: string;
	confirmText?: string;
	cancelText?: string;
};

export type AlertOptions = BaseOptions;

export type ConfirmOptions = BaseOptions;

export type PromptOptions = BaseOptions & {
	defaultValue?: string;
	placeholder?: string;
};

export type ModalApi = {
	alert: (options: AlertOptions) => Promise<void>;
	confirm: (options: ConfirmOptions) => Promise<boolean>;
	prompt: (options: PromptOptions) => Promise<string | null>;
};

export const AppModalContext = createContext<ModalApi | null>(null);

export const useAppModal = (): ModalApi => {
	const value = useContext(AppModalContext);
	if (!value) {
		throw new Error("useAppModal must be used within AppModalProvider");
	}

	return value;
};
