import {
  Body,
  Controller,
  Delete,
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
import { CreateAdminSubmissionDto } from './dto/create-admin-submission.dto';
import { ReviewUserDto } from './dto/review-user.dto';
import { AdminService } from './admin.service';
import type { JwtUser } from '../../common/types/jwt-user.type';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RESEARCHER)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('profile')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get current admin profile' })
  getProfile(@CurrentUser() user: JwtUser) {
    return this.adminService.getProfile(user.sub);
  }

  @Get('dashboard')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get admin dashboard overview' })
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.adminService.getDashboard(user.sub);
  }

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
  @ApiOperation({
    summary: 'List districts, optionally filtered by division code',
  })
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
    return this.adminService.listPublishedSubmissions(
      Number(page),
      Number(limit),
    );
  }

  @Post('submissions')
  @ApiOperation({ summary: 'Create and optionally publish district data' })
  createSubmission(
    @Body() dto: CreateAdminSubmissionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.adminService.createSubmission(dto, user.sub, user.role);
  }

  @Get('users/researchers')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all researchers' })
  listAllResearchers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.adminService.listAllResearchers(
      Number(page),
      Number(limit),
      search,
    );
  }

  @Get('users/pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List pending researcher approvals' })
  listPendingResearchers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.listPendingResearchers(
      Number(page),
      Number(limit),
    );
  }

  @Get('users/:id/submissions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all submissions for a specific researcher' })
  listResearcherSubmissions(@Param('id') id: string) {
    return this.adminService.listResearcherSubmissions(id);
  }

  @Patch('users/:id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a researcher account' })
  approveResearcher(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewUserDto,
  ) {
    return this.adminService.approveResearcher(id, user.sub, dto.note);
  }

  @Patch('users/:id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a researcher account' })
  rejectResearcher(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReviewUserDto,
  ) {
    return this.adminService.rejectResearcher(id, user.sub, dto.note);
  }

  @Get('submissions/pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List pending researcher submissions' })
  listPendingSubmissions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.adminService.listPendingSubmissions(
      Number(page),
      Number(limit),
    );
  }

  @Patch('submissions/:id/publish')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Publish a pending submission to the landing page' })
  publishSubmission(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.adminService.publishSubmission(id, user.sub);
  }

  @Patch('submissions/:id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a pending submission' })
  rejectSubmission(@Param('id') id: string) {
    return this.adminService.rejectSubmission(id);
  }

  @Delete('researchers/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Delete a researcher account and their submissions',
  })
  deleteResearcher(@Param('id') id: string) {
    return this.adminService.deleteResearcher(id);
  }

  @Delete('posts/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a published or pending post/submission' })
  deletePost(@Param('id') id: string) {
    return this.adminService.deleteSubmission(id);
  }

  @Delete('submissions/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a submission' })
  deleteSubmission(@Param('id') id: string) {
    return this.adminService.deleteSubmission(id);
  }
}
