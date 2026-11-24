import { StringOption } from 'necord';

import { arrayToChoices } from '#common/utils.ts';
import { NotificationKind } from '#notifications/notifications.service.ts';

export class DisableNotificationsDto {
  @StringOption({
    name: 'kind',
    description: 'What kind of event to disable',
    choices: arrayToChoices(NotificationKind),
    required: true,
  })
  kind: NotificationKind;
}
