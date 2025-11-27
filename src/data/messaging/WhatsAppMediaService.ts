import { env } from '../../config/env';

const DEFAULT_GRAPH_API_BASE = 'https://graph.facebook.com';

export interface MediaMetadata {
    messaging_product: string;
    url: string;
    mime_type: string;
    sha256: string;
    file_size: number;
    id: string;
}

export class WhatsAppMediaService {
    private readonly graphVersion: string;
    private readonly accessToken: string;
    private readonly graphBase: string;

    constructor(
        accessToken: string = env.META_WHATSAPP_TOKEN,
        graphVersion: string = env.WHATSAPP_GRAPH_VERSION,
        graphBase: string = DEFAULT_GRAPH_API_BASE,
    ) {
        this.accessToken = accessToken;
        this.graphVersion = graphVersion;
        this.graphBase = graphBase;
    }

    /**
     * Step 1: Get media metadata (including download URL) from WhatsApp
     */
    async getMediaMetadata(mediaId: string): Promise<MediaMetadata> {
        const endpoint = `${this.graphBase}/${this.graphVersion}/${mediaId}`;

        console.log(`Fetching media metadata for ID: ${mediaId}`);

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        });

        if (!response.ok) {
            const errorDetails = await response.text().catch(() => '');
            throw new Error(
                `Failed to fetch media metadata. Status: ${response.status}. Details: ${errorDetails}`,
            );
        }

        return response.json() as Promise<MediaMetadata>;
    }

    /**
     * Step 2: Download the actual media file from the URL
     */
    async downloadMedia(mediaUrl: string): Promise<Buffer> {
        console.log(`Downloading media from URL: ${mediaUrl}`);

        const response = await fetch(mediaUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        });

        if (!response.ok) {
            const errorDetails = await response.text().catch(() => '');
            throw new Error(
                `Failed to download media. Status: ${response.status}. Details: ${errorDetails}`,
            );
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Convenience method: Get metadata and download in one call
     */
    async downloadMediaById(mediaId: string): Promise<{ buffer: Buffer; metadata: MediaMetadata }> {
        const metadata = await this.getMediaMetadata(mediaId);
        const buffer = await this.downloadMedia(metadata.url);

        console.log(`Downloaded ${buffer.length} bytes of media type: ${metadata.mime_type}`);

        return { buffer, metadata };
    }
}
