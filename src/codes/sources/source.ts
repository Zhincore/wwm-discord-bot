export interface NewCodesResult {
  latestCursor: string;
  codes: string[];
}

export type CodesSource = (lastCursor?: string) => Promise<NewCodesResult>;
