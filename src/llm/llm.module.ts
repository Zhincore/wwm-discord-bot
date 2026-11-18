import { Module } from '@nestjs/common';

import { WwmModule } from '#wwm/wwm.module.ts';

import { LLMCommands } from './llm.commands';
import { LLMListener } from './llm.listener';
import { LLMService } from './llm.service';

@Module({
  imports: [WwmModule],
  providers: [LLMService, LLMListener, LLMCommands],
  exports: [LLMService],
})
export class LLMModule {}
