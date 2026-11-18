import { Module } from '@nestjs/common';

import { WwmModule } from '#wwm/wwm.module.ts';

import { LLMListener } from './llm.listener';
import { LLMService } from './llm.service';

@Module({
  imports: [WwmModule],
  providers: [LLMService, LLMListener],
  exports: [LLMService],
})
export class LLMModule {}
