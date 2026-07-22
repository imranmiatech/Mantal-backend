import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import type { JwtUser } from './common/types/jwt-user.type';
import { PublicService } from './modules/public/public.service';

@Controller()
export class AppController {
  constructor(private readonly publicService: PublicService) {}

  @Get()
  getApiInfo() {
    return {
      name: 'CAMH Risk Index Backend',
      status: 'ok',
      docs: '/api/docs',
      publicDashboard: '/api/public/dashboard',
    };
  }

  @Get('api/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get the shared authenticated dashboard for admins and researchers',
  })
  getSharedDashboard(
    @CurrentUser() _user: JwtUser,
    @Query('division') division?: string,
    @Query('district') district?: string,
    @Query('upazila') upazila?: string,
  ) {
    return this.publicService.getDashboard(division, district, upazila);
  }
}
