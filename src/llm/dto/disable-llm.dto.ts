import { StringOption } from 'necord';

import { arrayToChoices } from '#common/utils.ts';
import { ToolLevel } from '#llm/utils/tool-agent.ts';

export class DisableLLMDto {
  @StringOption({
    name: 'level',
    description: 'The level of features to disable. Leave empty for all',
    choices: arrayToChoices(ToolLevel),
    required: false,
  })
  public level?: ToolLevel;
}
