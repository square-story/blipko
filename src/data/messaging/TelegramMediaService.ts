import {
  IMediaService,
  DownloadedMedia,
} from "../../application/interfaces/IMediaService";
import { env } from "../../config/env";

export class TelegramMediaService implements IMediaService {
  private readonly base: string;
  private readonly fileBase: string;

  constructor(token: string = env.TELEGRAM_BOT_TOKEN) {
    this.base = `https://api.telegram.org/bot${token}`;
    this.fileBase = `https://api.telegram.org/file/bot${token}`;
  }

  async downloadByFileId(fileId: string): Promise<DownloadedMedia> {
    // Step 1: resolve file_id → file_path
    const metaRes = await fetch(`${this.base}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    if (!metaRes.ok) {
      throw new Error(`Telegram getFile failed ${metaRes.status}`);
    }
    const meta = (await metaRes.json()) as {
      result?: { file_path?: string; mime_type?: string };
    };
    const filePath = meta.result?.file_path;
    if (!filePath) throw new Error(`No file_path for file_id ${fileId}`);

    // Step 2: download the file
    const fileRes = await fetch(`${this.fileBase}/${filePath}`);
    if (!fileRes.ok) {
      throw new Error(`Telegram file download failed ${fileRes.status}`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Infer MIME type from extension when not provided by Telegram
    const mimeType = this.inferMimeType(filePath);
    return { buffer, mimeType };
  }

  private inferMimeType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
      ogg: "audio/ogg",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      webm: "audio/webm",
      opus: "audio/ogg",
    };
    return map[ext] ?? "audio/ogg";
  }
}
