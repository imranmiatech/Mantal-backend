import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller('api/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('divisions')
  @ApiOperation({ summary: 'List all Bangladesh divisions' })
  getDivisions() {
    return this.publicService.getDivisions();
  }

  @Get('locations/hierarchy')
  @ApiOperation({
    summary: 'Get Bangladesh division-district-upazila hierarchy',
  })
  getLocationHierarchy() {
    return this.publicService.getLocationHierarchy();
  }

  @Get('locations/districts')
  @ApiOperation({
    summary: 'List districts, optionally filtered by division code',
  })
  getDistrictDirectory(@Query('divisionCode') divisionCode?: string) {
    return this.publicService.getDistrictDirectory(
      divisionCode ? Number(divisionCode) : undefined,
    );
  }

  @Get('locations/districts/:slug/upazilas')
  @ApiOperation({ summary: 'List all upazilas under a district slug' })
  getUpazilas(@Param('slug') slug: string) {
    return this.publicService.getUpazilaDirectory(slug);
  }

  @Get('landing-page')
  @ApiOperation({ summary: 'Get landing-page-ready published data' })
  getLandingPageData(
    @Query('division') division?: string,
    @Query('district') district?: string,
    @Query('upazila') upazila?: string,
  ) {
    return this.publicService.getLandingPageData(division, district, upazila);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get published dashboard data' })
  getDashboard(
    @Query('division') division?: string,
    @Query('district') district?: string,
    @Query('upazila') upazila?: string,
  ) {
    return this.publicService.getDashboard(division, district, upazila);
  }

  @Get('districts')
  @ApiOperation({ summary: 'List published districts' })
  getDistricts(
    @Query('division') division?: string,
    @Query('district') district?: string,
    @Query('upazila') upazila?: string,
  ) {
    return this.publicService.listDistricts(division, district, upazila);
  }

  @Get('districts/:slug')
  @ApiOperation({ summary: 'Get one published district by slug' })
  getDistrict(@Param('slug') slug: string) {
    return this.publicService.getDistrict(slug);
  }
}
