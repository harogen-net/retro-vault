import {
	IonButton,
	IonButtons,
	IonFooter,
	IonIcon,
	IonItem,
	IonList,
	IonPopover,
	IonToolbar,
	useIonRouter,
} from "@ionic/react";
import { ellipsisHorizontal, imagesOutline } from "ionicons/icons";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { APP_DEPLOY_ID, APP_REVISION, APP_VERSION } from "../lib/appVersion";
import { importAlbumFromZip } from "../lib/db";
import { useAppModal } from "./appModalContext";

const VERSION_INFO_PENDING_KEY = "retro-vault:pending-version-info";
const VERSION_INFO_PENDING_TTL_MS = 5 * 60 * 1000;

type PendingVersionInfo = {
	reason: "manual-reload";
	requestedAt: number;
	nonce: string;
};

export const AppFooterNav = () => {
	const router = useIonRouter();
	const location = useLocation();
	const modal = useAppModal();
	const hasConsumedPendingRef = useRef(false);
	const importInputRef = useRef<HTMLInputElement | null>(null);
	const isAlbums = location.pathname === "/" || location.pathname === "/albums";
	const settingsTriggerId = "footer-settings-trigger";

	const onShowVersionInfo = async () => {
		await modal.alert({
			title: "バージョン情報",
			message: `version: ${APP_VERSION}\ndeploy: ${APP_DEPLOY_ID}\nhash: ${APP_REVISION}`,
			confirmText: "閉じる",
		});
	};

	useEffect(() => {
		if (hasConsumedPendingRef.current) {
			return;
		}

		hasConsumedPendingRef.current = true;

		let parsed: PendingVersionInfo | null = null;
		try {
			const raw = localStorage.getItem(VERSION_INFO_PENDING_KEY);
			if (!raw) {
				return;
			}

			const candidate = JSON.parse(raw) as Partial<PendingVersionInfo>;
			if (
				candidate.reason !== "manual-reload" ||
				typeof candidate.requestedAt !== "number" ||
				typeof candidate.nonce !== "string"
			) {
				localStorage.removeItem(VERSION_INFO_PENDING_KEY);
				return;
			}

			if (Date.now() - candidate.requestedAt > VERSION_INFO_PENDING_TTL_MS) {
				localStorage.removeItem(VERSION_INFO_PENDING_KEY);
				return;
			}

			parsed = {
				reason: "manual-reload",
				requestedAt: candidate.requestedAt,
				nonce: candidate.nonce,
			};
		} catch {
			localStorage.removeItem(VERSION_INFO_PENDING_KEY);
			return;
		}

		if (!parsed) {
			return;
		}

		localStorage.removeItem(VERSION_INFO_PENDING_KEY);
		void onShowVersionInfo();
	}, []);

	const onReloadApp = async () => {
		const shouldReload = await modal.confirm({
			title: "アプリのリロード",
			message: "最新状態を取得するためにアプリを再読み込みします。実行しますか？",
			confirmText: "リロード",
			cancelText: "キャンセル",
		});

		if (!shouldReload) {
			return;
		}

		const pendingVersionInfo: PendingVersionInfo = {
			reason: "manual-reload",
			requestedAt: Date.now(),
			nonce: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		};
		try {
			localStorage.setItem(VERSION_INFO_PENDING_KEY, JSON.stringify(pendingVersionInfo));
		} catch {
			// If storage is unavailable, continue reloading without post-reload modal.
		}

		try {
			if ("serviceWorker" in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(
					registrations.map(async (registration) => {
						try {
							await registration.update();
							registration.waiting?.postMessage({ type: "SKIP_WAITING" });
							await registration.unregister();
						} catch {
							// Ignore update failures and continue with reload.
						}
					})
				);
			}

			if ("caches" in window) {
				const cacheKeys = await caches.keys();
				await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
			}

			const reloadUrl = new URL(window.location.href);
			reloadUrl.searchParams.set("app_reload", String(Date.now()));
			window.location.assign(reloadUrl.toString());
		} catch {
			window.location.reload();
		}
	};

	const onImportAlbum = () => {
		importInputRef.current?.click();
	};

	const onImportZip = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const [file] = event.target.files ?? [];
		event.target.value = "";

		if (!file) {
			return;
		}

		try {
			const imported = await importAlbumFromZip(file);
			router.push(`/albums/${encodeURIComponent(imported.id)}`, "forward", "push");
		} catch (e) {
			await modal.alert({
				title: "インポートエラー",
				message: e instanceof Error ? e.message : "インポートに失敗しました。",
				confirmText: "閉じる",
			});
		}
	};

	return (
		<IonFooter translucent className="app-footer-nav">
			<IonToolbar className="app-footer-nav-toolbar">
				<IonButtons slot="start">
					<IonButton
						className="footer-nav-button"
						fill="clear"
						disabled={isAlbums}
						onClick={() => {
							router.push("/", "root", "replace");
						}}
						aria-label="アルバム一覧">
						<span className="footer-nav-button-inner">
							<IonIcon icon={imagesOutline} aria-hidden="true" />
							<span className="footer-nav-button-label">アルバム一覧</span>
						</span>
					</IonButton>
				</IonButtons>
				<IonButtons slot="end">
					<IonButton className="footer-nav-button" fill="clear" id={settingsTriggerId} aria-label="設定">
						<span className="footer-nav-button-inner">
							<IonIcon icon={ellipsisHorizontal} aria-hidden="true" />
							<span className="footer-nav-button-label">設定</span>
						</span>
					</IonButton>
				</IonButtons>
			</IonToolbar>

			<IonPopover trigger={settingsTriggerId} dismissOnSelect className="settings-menu-popover">
				<IonList className="settings-menu-list" lines="none">
					<IonItem
						button
						detail={false}
						onClick={onImportAlbum}>
						アルバムをインポート
					</IonItem>
					<IonItem
						button
						detail={false}
						onClick={() => {
							void onShowVersionInfo();
						}}>
						バージョン情報
					</IonItem>
					<IonItem
						button
						detail={false}
						onClick={() => {
							void onReloadApp();
						}}>
						アプリのリロード
					</IonItem>
				</IonList>
			</IonPopover>

			<input
				ref={importInputRef}
				hidden
				className="visually-hidden"
				type="file"
				accept=".zip,application/zip"
				onChange={onImportZip}
			/>
		</IonFooter>
	);
};