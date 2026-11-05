import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { GameProfileService } from './game-profile.service';
import callbackRedirect from './views/callback-redirect.html' with { type: 'text' };
import { Link } from './views/Link';
import { RoleChooser } from './views/RoleChooser';

@Controller('game-profile')
export class GameProfileController {
  constructor(private readonly service: GameProfileService) {}

  @Get('link')
  @Header('Content-Type', 'text/html')
  public async linkProfile() {
    const methods = await this.service.getLoginMethodsWeb();
    return Link({ methods });
  }

  @Get(':userId/callback')
  @Header('Content-Type', 'text/html')
  public async callback(@Param('userId') _userId: string) {
    return callbackRedirect;
  }

  @Get(':userId/role')
  @Header('Content-Type', 'text/html')
  public async roleSelect(
    @Param('userId') _userId: string,
    @Query('platform') platform: string,
    @Query('token') token: string,
  ) {
    const roles = await this.service.getRoleList(platform, token);

    return RoleChooser({ roles });
  }

  @Post(':userId/role')
  @Header('Content-Type', 'text/html')
  public async roleChosen(
    @Param('userId') userId: string,
    @Query('platform') platform: string,
    @Query('token') token: string,
    @Body('roleId') roleId: string,
  ) {
    const roles = await this.service.loginRole(userId, platform, token, roleId);

    return 'success';
  }
}
