import { IMediaService } from "../interfaces/IMediaService";
import { SarvamTranscriptionService } from "../../data/ai/SarvamTranscriptionService";
import { ProcessIncomingMessageUseCase } from "./ProcessIncomingMessage";

export interface ProcessVoiceMessageInput {
  platformUserId: string;
  audioFileId: string;
  replyToMessageId?: string | undefined;
}

export interface ProcessVoiceMessageOutput {
  transcribedText: string;
  response: string;
}

export class ProcessVoiceMessageUseCase {
  constructor(
    private readonly mediaService: IMediaService,
    private readonly transcriptionService: SarvamTranscriptionService,
    private readonly processMessageUseCase: ProcessIncomingMessageUseCase,
  ) {}

  async execute(
    input: ProcessVoiceMessageInput,
  ): Promise<ProcessVoiceMessageOutput> {
    console.log(
      `Processing voice message from ${input.platformUserId}, file ID: ${input.audioFileId}`,
    );

    const { buffer, mimeType } = await this.mediaService.downloadByFileId(
      input.audioFileId,
    );
    console.log(`Downloaded audio: ${mimeType}, ${buffer.length} bytes`);

    const fileName = `audio_${input.audioFileId}.${this.getFileExtension(mimeType)}`;
    const transcription = await this.transcriptionService.transcribe(
      buffer,
      fileName,
    );
    console.log(
      `Transcription: "${transcription.text}" (${transcription.language})`,
    );

    const result = await this.processMessageUseCase.execute({
      platformUserId: input.platformUserId,
      textMessage: transcription.text,
      replyToMessageId: input.replyToMessageId,
    });

    return {
      transcribedText: transcription.text,
      response: result.response,
    };
  }

  private getFileExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/opus": "opus",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/wav": "wav",
      "audio/webm": "webm",
    };
    return extensions[mimeType] ?? "ogg";
  }
}
