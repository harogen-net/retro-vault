export interface Album {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	photoCount: number;
}

export interface Photo {
	id: string;
	albumId: string;
	createdAt: number;
	updatedAt: number;
	imageCount: number;
	width: number;
	height: number;
	sizeBytes: number;
	mimeType: string;
	blob: Blob;
	thumbnailBlob?: Blob;
	memo?: string;
}

export interface PhotoImage {
	id: string;
	photoId: string;
	createdAt: number;
	width: number;
	height: number;
	sizeBytes: number;
	mimeType: string;
	blob: Blob;
	thumbnailBlob?: Blob;
}

export interface PreparedPhoto {
	width: number;
	height: number;
	sizeBytes: number;
	mimeType: string;
	blob: Blob;
}
