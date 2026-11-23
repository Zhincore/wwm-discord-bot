import { StringOption } from 'necord';

import { ToolLevel } from '#llm/utils/tool-agent.ts';

export class DisableLLMDto {
  @StringOption({
    name: 'level',
    description: 'The level of features to disable. Leave empty for all',
    choices: [
      { name: 'basic', value: 'BASIC' },
      { name: 'advanced', value: 'ADVANCED' },
    ],
    required: false,
  })
  public level?: ToolLevel;
}
