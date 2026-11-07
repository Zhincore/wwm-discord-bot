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
import { Callback } from './views/Callback';
import { Link } from './views/Link';
import { RoleChooser } from './views/RoleChooser';
import { Success } from './views/Success';

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
    return Callback();
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
    const nickname = await this.service.loginRole(
      userId,
      platform,
      token,
      roleId,
    );

    return Success({ nickname });
  }
}
