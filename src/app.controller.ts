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
      landingPageDataEndpoint: '/api/public/dashboard',
      authenticatedDashboardEndpoint: '/api/dashboard',
      routes: {
        auth: {
          signup: 'POST /api/auth/signup',
          login: 'POST /api/auth/login',
          me: 'GET /api/auth/me',
        },
        public: {
          divisions: 'GET /api/public/divisions',
          locationHierarchy: 'GET /api/public/locations/hierarchy',
          districtsByDivision:
            'GET /api/public/locations/districts?divisionCode=30',
          upazilasByDistrict:
            'GET /api/public/locations/districts/:slug/upazilas',
          landingPage: 'GET /api/public/landing-page',
          dashboard: 'GET /api/public/dashboard',
          districts: 'GET /api/public/districts',
          districtBySlug: 'GET /api/public/districts/:slug',
        },
        researcher: {
          dashboard: 'GET /api/researcher/dashboard',
          createSubmission: 'POST /api/researcher/submissions',
          mySubmissions: 'GET /api/researcher/submissions/mine',
        },
        admin: {
          divisions: 'GET /api/admin/divisions',
          locationHierarchy: 'GET /api/admin/locations/hierarchy',
          districtsByDivision:
            'GET /api/admin/locations/districts?divisionCode=30',
          upazilasByDistrict:
            'GET /api/admin/locations/districts/:districtCode/upazilas',
          districts: 'GET /api/admin/districts',
          publishedSubmissions: 'GET /api/admin/submissions/published',
          createPublishedSubmission: 'POST /api/admin/submissions',
          pendingResearchers: 'GET /api/admin/users/pending',
          approveResearcher: 'PATCH /api/admin/users/:id/approve',
          pendingSubmissions: 'GET /api/admin/submissions/pending',
          publishSubmission: 'PATCH /api/admin/submissions/:id/publish',
          rejectSubmission: 'PATCH /api/admin/submissions/:id/reject',
        },
      },
    };
  }

  @Get('api/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the shared authenticated dashboard for admins and researchers',
  })
  getSharedDashboard(
    @CurrentUser() _user: JwtUser,
    @Query('division') division?: string,
  ) {
    return this.publicService.getDashboard(division);
  }
}
