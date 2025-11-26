export interface SendMessagePayload {
  to: string;
  body: string;
}

export interface IMessageService {
  sendMessage(payload: SendMessagePayload): Promise<void>;
}


