import { useEffect, useState } from "react";

type UseBlobDataUrlListOptions<TItem, TResult> = {
	items: TItem[];
	getBlob: (item: TItem) => Blob | null | undefined;
	getMimeType?: (item: TItem) => string | undefined;
	mapResult: (item: TItem, src: string) => TResult;
};

const toSafeBlob = (blob: Blob, mimeType?: string) => {
	if (blob.type) {
		return blob;
	}

	return new Blob([blob], { type: mimeType || "image/jpeg" });
};

const readBlobAsDataUrl = async (blob: Blob, mimeType?: string) => {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		const safeBlob = toSafeBlob(blob, mimeType);

		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
				return;
			}

			reject(new Error("画像変換に失敗しました。"));
		};

		reader.onerror = () => {
			reject(reader.error ?? new Error("画像変換に失敗しました。"));
		};

		reader.readAsDataURL(safeBlob);
	});
};

export const useBlobDataUrlList = <TItem, TResult>({
	items,
	getBlob,
	getMimeType,
	mapResult,
}: UseBlobDataUrlListOptions<TItem, TResult>) => {
	const [results, setResults] = useState<TResult[]>([]);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			const next: TResult[] = [];

			for (const item of items) {
				const blob = getBlob(item);
				if (!blob) {
					continue;
				}

				try {
					const src = await readBlobAsDataUrl(blob, getMimeType?.(item));
					next.push(mapResult(item, src));
				} catch {
					// Skip unreadable images while keeping the rest renderable.
				}
			}

			if (!cancelled) {
				setResults(next);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [getBlob, getMimeType, items, mapResult]);

	return results;
};
