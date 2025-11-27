import OpenAI from 'openai';
import { env } from '../../config/env';

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
}

export class WhisperTranscriptionService {
    private readonly openai: OpenAI;

    constructor(apiKey: string = env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ apiKey });
    }

    /**
     * Transcribe audio buffer to text using OpenAI Whisper
     * @param audioBuffer - The audio file as a Buffer
     * @param fileName - Original filename (helps OpenAI determine format)
     * @returns Transcribed text
     */
    async transcribe(audioBuffer: Buffer, fileName: string = 'audio.ogg'): Promise<TranscriptionResult> {
        console.log(`Transcribing audio file: ${fileName} (${audioBuffer.length} bytes)`);

        try {
            // Create a File object from the buffer
            const file = new File([audioBuffer], fileName, {
                type: this.getMimeType(fileName)
            });

            const transcription = await this.openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                response_format: 'verbose_json', // Get additional metadata
            });

            console.log(`Transcription successful: "${transcription.text}"`);

            return {
                text: transcription.text,
                language: transcription.language,
                duration: transcription.duration,
            };
        } catch (error) {
            console.error('Whisper transcription failed:', error);
            throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Helper to determine MIME type from filename
     */
    private getMimeType(fileName: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase();

        const mimeTypes: Record<string, string> = {
            'ogg': 'audio/ogg',
            'opus': 'audio/opus',
            'mp3': 'audio/mpeg',
            'mp4': 'audio/mp4',
            'mpeg': 'audio/mpeg',
            'mpga': 'audio/mpeg',
            'm4a': 'audio/mp4',
            'wav': 'audio/wav',
            'webm': 'audio/webm',
        };

        return mimeTypes[ext || ''] || 'audio/ogg'; // Default to ogg (WhatsApp's common format)
    }
}
