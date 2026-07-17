import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateBulkSubmissionsDto } from './dto/create-bulk-submissions.dto';
import { ResearcherService } from './researcher.service';
import type { JwtUser } from '../../common/types/jwt-user.type';

@ApiTags('Researcher')
@ApiBearerAuth()
@Controller('api/researcher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESEARCHER)
export class ResearcherController {
  constructor(private readonly researcherService: ResearcherService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get researcher dashboard overview' })
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.researcherService.getDashboard(user.sub);
  }

  @Post('submissions')
  @ApiOperation({ summary: 'Create a researcher submission' })
  createSubmission(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.researcherService.createSubmission(user.sub, dto);
  }

  @Post('submissions/bulk')
  @ApiOperation({ summary: 'Create bulk researcher submissions' })
  createBulkSubmissions(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBulkSubmissionsDto,
  ) {
    return this.researcherService.createBulkSubmissions(user.sub, dto);
  }

  @Get('submissions/mine')
  @ApiOperation({ summary: 'List my researcher submissions' })
  listMySubmissions(@CurrentUser() user: JwtUser) {
    return this.researcherService.listMySubmissions(user.sub);
  }
}
