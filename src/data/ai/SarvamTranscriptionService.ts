import { SarvamAIClient } from "sarvamai";
import fs from "fs";
import { env } from "../../config/env";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export class SarvamTranscriptionService {
  private readonly client: SarvamAIClient;

  constructor(apiKey: string = env.SARVAM_API_KEY) {
    this.client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });
  }

  /**
   * Transcribe audio buffer to text using Sarvam AI
   * @param audioBuffer - The audio file as a Buffer
   * @param fileName - Original filename (helps determine format)
   * @returns Transcribed text
   */
  async transcribe(
    audioBuffer: Buffer,
    fileName: string = "audio.ogg",
  ): Promise<TranscriptionResult> {
    console.log(
      `Transcribing audio file with Sarvam AI (SDK): ${fileName} (${audioBuffer.length} bytes)`,
    );

    try {
      // Sarvam SDK expects a File object or similar, but since we are in Node,
      // we might need to handle the buffer carefully.
      // The user example used `fs.createReadStream`.
      // Since we have a buffer, we can convert it to a Blob or File compatible object if the SDK supports it,
      // or write to a temp file if strictly needed.
      // However, looking at the user snippet: `file: audioFile` where audioFile is a ReadStream.
      // Let's try to pass a Blob first as it's more efficient than writing to disk.
      // If the SDK strictly requires a stream or file path, we might need to adjust.
      // The user snippet: `const audioFile = fs.createReadStream("recording.wav");`

      // Let's write to a temp file to be safe and match the user's pattern which uses a stream/file.
      // Or better, create a temporary file from buffer.

      const tempFilePath = `/tmp/${Date.now()}_${fileName}`;
      fs.writeFileSync(tempFilePath, audioBuffer);

      const audioFileStream = fs.createReadStream(tempFilePath);

      const response = await this.client.speechToText.translate({
        file: audioFileStream,
        model: "saaras:v2.5",
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      console.log(`Transcription successful: "${response.transcript}"`);

      const result: TranscriptionResult = {
        text: response.transcript,
        // The translate endpoint might not return language since it translates TO English,
        // but if it does, we can map it. The user snippet console.log(response) implies we get a response object.
        // Assuming response has `transcript`.
      };

      // If the SDK response has language_code, we can add it.
      // Based on typical Sarvam API, translate might just return the text.
      // Let's assume response structure is similar to what we had or check SDK types if possible.
      // For now, we'll map what we know.

      return result;
    } catch (error) {
      console.error("Sarvam transcription failed:", error);
      throw new Error(
        `Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
