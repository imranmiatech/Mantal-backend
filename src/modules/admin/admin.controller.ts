import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewUserDto } from './dto/review-user.dto';
import { CreateAdminSubmissionDto } from './dto/create-admin-submission.dto';
import { AdminService } from './admin.service';
import type { JwtUser } from '../../common/types/jwt-user.type';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RESEARCHER)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('divisions')
  @ApiOperation({ summary: 'List all Bangladesh divisions' })
  listDivisions() {
    return this.adminService.listDivisions();
  }

  @Get('locations/hierarchy')
  @ApiOperation({
    summary: 'Get Bangladesh division-district-upazila hierarchy',
  })
  getLocationHierarchy() {
    return this.adminService.getLocationHierarchy();
  }

  @Get('locations/districts')
  @ApiOperation({ summary: 'List districts, optionally filtered by division code' })
  listHierarchyDistricts(@Query('divisionCode') divisionCode?: string) {
    return this.adminService.listDistrictsByDivision(
      divisionCode ? Number(divisionCode) : undefined,
    );
  }

  @Get('locations/districts/:districtCode/upazilas')
  @ApiOperation({ summary: 'List all upazilas under a district code' })
  listUpazilas(@Param('districtCode') districtCode: string) {
    return this.adminService.listUpazilasByDistrict(Number(districtCode));
  }

  @Get('districts')
  @ApiOperation({ summary: 'List districts for admin input panels' })
  listDistricts() {
    return this.adminService.listDistricts();
  }

  @Get('submissions/published')
  @ApiOperation({ summary: 'List all published submissions' })
  listPublishedSubmissions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.listPublishedSubmissions(Number(page), Number(limit));
  }

  @Post('submissions')
  @ApiOperation({ summary: 'Create and optionally publish district data' })
  createSubmission(
    @Body() dto: CreateAdminSubmissionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.createSubmission(dto, user.sub);
  }

  @Get('users/researchers')
  @ApiOperation({ summary: 'List all researchers' })
  listAllResearchers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.adminService.listAllResearchers(Number(page), Number(limit), search);
  }

  @Get('users/pending')
  @ApiOperation({ summary: 'List pending researcher approvals' })
  listPendingResearchers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.listPendingResearchers(Number(page), Number(limit));
  }

  @Patch('users/:id/approve')
  @ApiOperation({ summary: 'Approve a researcher account' })
  @Roles(Role.ADMIN)
  approveResearcher(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewUserDto,
  ) {
    return this.adminService.approveResearcher(id, user.sub, dto.note);
  }

  @Get('users/:id/submissions')
  @ApiOperation({ summary: 'List all submissions for a specific researcher' })
  listResearcherSubmissions(@Param('id') id: string) {
    return this.adminService.listResearcherSubmissions(id);
  }

  @Get('submissions/pending')
  @ApiOperation({ summary: 'List pending researcher submissions' })
  listPendingSubmissions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.listPendingSubmissions(Number(page), Number(limit));
  }

  @Patch('submissions/:id/publish')
  @ApiOperation({ summary: 'Publish a pending submission to the landing page' })
  publishSubmission(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.adminService.publishSubmission(id, user.sub);
  }

  @Patch('submissions/:id/reject')
  @ApiOperation({ summary: 'Reject a pending submission' })
  rejectSubmission(@Param('id') id: string) {
    return this.adminService.rejectSubmission(id);
  }
}
