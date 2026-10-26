import type { CardId } from '@engine';

export const AUDIO_ONLY_CONFIDENCE = 0.6;

export interface HintProvider {
  name: 'matcher';
  pick(
    call: { cardId?: string; audioOnly: boolean },
    myCards: CardId[],
  ): Promise<{ cardId: CardId | null; confidence: number }>;
}

export const matcherProvider: HintProvider = {
  name: 'matcher',
  async pick(call, myCards) {
    if (call.cardId && myCards?.includes(call.cardId)) {
      return { cardId: call.cardId, confidence: call.audioOnly ? AUDIO_ONLY_CONFIDENCE : 1 };
    }
    return { cardId: null, confidence: 0 };
  },
};
