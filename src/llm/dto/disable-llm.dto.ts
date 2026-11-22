import { StringOption } from 'necord';

import { ToolLevel } from '#llm/tool-agent.ts';

export class DisableLLMDto {
  @StringOption({
    name: 'level',
    description: 'The level of features to disable. Leave empty for all',
    choices: [
      { name: 'basic', value: ToolLevel.BASIC },
      { name: 'advanced', value: ToolLevel.ADVANCED },
    ],
    required: false,
  })
  public level?: ToolLevel;
}
