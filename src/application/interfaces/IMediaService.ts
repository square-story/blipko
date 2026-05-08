export interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
}

export interface IMediaService {
  // Resolve a platform-specific file ID to a downloadable buffer
  downloadByFileId(fileId: string): Promise<DownloadedMedia>;
}
