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
import { AdminService } from './admin.service';
import type { JwtUser } from '../../common/types/jwt-user.type';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
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

  @Delete('researchers/:id')
  @ApiOperation({ summary: 'Delete a researcher account and their submissions' })
  deleteResearcher(@Param('id') id: string) {
    return this.adminService.deleteResearcher(id);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Delete a published or pending post/submission' })
  deletePost(@Param('id') id: string) {
    return this.adminService.deleteSubmission(id);
  }

  @Delete('submissions/:id')
  @ApiOperation({ summary: 'Delete a submission' })
  deleteSubmission(@Param('id') id: string) {
    return this.adminService.deleteSubmission(id);
  }
}
