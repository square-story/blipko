import { WhatsAppMediaService } from "../../data/messaging/WhatsAppMediaService";
import { SarvamTranscriptionService } from "../../data/ai/SarvamTranscriptionService";
import { ProcessIncomingMessageUseCase } from "./ProcessIncomingMessage";

export interface ProcessVoiceMessageInput {
  senderPhone: string;
  mediaId: string;
  replyToMessageId?: string | undefined;
}

export interface ProcessVoiceMessageOutput {
  transcribedText: string;
  response: string;
}

export class ProcessVoiceMessageUseCase {
  constructor(
    private readonly mediaService: WhatsAppMediaService,
    private readonly transcriptionService: SarvamTranscriptionService,
    private readonly processMessageUseCase: ProcessIncomingMessageUseCase,
  ) {}

  async execute(
    input: ProcessVoiceMessageInput,
  ): Promise<ProcessVoiceMessageOutput> {
    console.log(
      `Processing voice message from ${input.senderPhone}, media ID: ${input.mediaId}`,
    );

    // Step 1: Download the audio file from WhatsApp
    const { buffer, metadata } = await this.mediaService.downloadMediaById(
      input.mediaId,
    );
    console.log(
      `Downloaded audio: ${metadata.mime_type}, ${metadata.file_size} bytes`,
    );

    // Step 2: Transcribe using Sarvam AI
    const fileName = `audio_${input.mediaId}.${this.getFileExtension(metadata.mime_type)}`;
    const transcription = await this.transcriptionService.transcribe(
      buffer,
      fileName,
    );

    console.log(
      `Transcription complete: "${transcription.text}" (${transcription.language})`,
    );

    // Step 3: Process the transcribed text through existing message pipeline
    const result = await this.processMessageUseCase.execute({
      senderPhone: input.senderPhone,
      textMessage: transcription.text,
      replyToMessageId: input.replyToMessageId,
    });

    console.log(
      `Voice message processed successfully. Response: ${result.response}`,
    );

    return {
      transcribedText: transcription.text,
      response: result.response,
    };
  }

  /**
   * Helper to extract file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/opus": "opus",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/wav": "wav",
      "audio/webm": "webm",
    };

    return extensions[mimeType] || "ogg";
  }
}
