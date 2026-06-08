import { JPEG_QUALITY, MAX_IMAGE_EDGE } from "../config/constants";
import type { PreparedPhoto } from "../types";

type LoadedImage = {
	image: HTMLImageElement;
	release: () => void;
};

const waitForImageLoad = (img: HTMLImageElement): Promise<void> => {
	return new Promise((resolve, reject) => {
		if (img.complete && img.naturalWidth > 0) {
			resolve();
			return;
		}

		const onLoad = () => {
			cleanup();
			resolve();
		};
		const onError = () => {
			cleanup();
			reject(new Error("画像の読み込みに失敗しました。"));
		};
		const cleanup = () => {
			img.removeEventListener("load", onLoad);
			img.removeEventListener("error", onError);
		};

		img.addEventListener("load", onLoad);
		img.addEventListener("error", onError);
	});
};

const loadFromImageElement = async (file: Blob): Promise<LoadedImage> => {
	const imageUrl = URL.createObjectURL(file);
	const img = new Image();
	img.src = imageUrl;

	try {
		await img.decode();
	} catch {
		await waitForImageLoad(img);
	}

	if (img.naturalWidth < 1 || img.naturalHeight < 1) {
		URL.revokeObjectURL(imageUrl);
		throw new Error("画像サイズの取得に失敗しました。");
	}

	return {
		image: img,
		release: () => {
			URL.revokeObjectURL(imageUrl);
		},
	};
};

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("画像の変換に失敗しました。"));
					return;
				}
				resolve(blob);
			},
			"image/jpeg",
			quality
		);
	});
};

export const resizeImageToJpeg = async (
	file: Blob,
	maxEdge = MAX_IMAGE_EDGE,
	quality = JPEG_QUALITY
): Promise<PreparedPhoto> => {
	const loaded = await loadFromImageElement(file);
	const image = loaded.image;
	const width = image.naturalWidth;
	const height = image.naturalHeight;
	const drawSource: CanvasImageSource = image;
	const releaseSource = loaded.release;

	const longest = Math.max(width, height);
	const scale = longest > maxEdge ? maxEdge / longest : 1;
	const targetWidth = Math.max(1, Math.round(width * scale));
	const targetHeight = Math.max(1, Math.round(height * scale));

	const canvas = document.createElement("canvas");
	canvas.width = targetWidth;
	canvas.height = targetHeight;

	const context = canvas.getContext("2d");
	if (!context) {
		releaseSource?.();
		throw new Error("Canvasの初期化に失敗しました。");
	}

	try {
		context.drawImage(drawSource, 0, 0, targetWidth, targetHeight);
	} finally {
		releaseSource?.();
	}

	const blob = await toBlob(canvas, quality);

	return {
		width: targetWidth,
		height: targetHeight,
		sizeBytes: blob.size,
		mimeType: blob.type,
		blob,
	};
};
