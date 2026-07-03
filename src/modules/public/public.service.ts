import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import {
  bangladeshDivisions,
  getDivisionByIdentifier,
  getDistrictByIdentifier,
  getDistrictsByDivisionCode,
  getLocationHierarchy,
  getUpazilasByDistrictCode,
} from '../../common/data/bangladesh-locations';
import {
  calculateRiskIndex,
  getRiskInterpretation,
  getRiskLevel,
} from '../../common/utils/risk.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  getDivisions() {
    return bangladeshDivisions;
  }

  getLocationHierarchy() {
    return getLocationHierarchy();
  }

  getDistrictDirectory(divisionCode?: number) {
    if (divisionCode) {
      return getDistrictsByDivisionCode(divisionCode);
    }

    return bangladeshDivisions.flatMap((division) =>
      getDistrictsByDivisionCode(division.code),
    );
  }

  getUpazilaDirectory(districtIdentifier: string) {
    const district = getDistrictByIdentifier(districtIdentifier);

    if (!district) {
      throw new NotFoundException(
        `District hierarchy data not found for "${districtIdentifier}".`,
      );
    }

    return getUpazilasByDistrictCode(district.code);
  }

  async getLandingPageData(
    division?: string,
    district?: string,
    upazila?: string,
  ) {
    const records = await this.fetchPublishedRecords(division, district, upazila);
    const districts = records.map((record) => this.mapPublishedRecord(record));
    const selectedDistrict =
      districts.find((item) => item.slug === district) ?? districts[0];

    return {
      header: {
        title: 'Climate-Ageing-Mental Health Risk Index Dashboard',
        subtitle:
          'An integrated composite index tracked by district across vulnerable regions of Bangladesh.',
        lastUpdated: selectedDistrict?.publishedAt ?? null,
      },
      formulaBar: {
        label: 'INDEX FORMULA',
        formula:
          'CAMH-RI = (CE × 0.25) + (AI × 0.25) + (PS × 0.25) + (AC × 0.25)',
      },
      filters: {
        divisions: [...new Set(districts.map((district) => district.division))],
        activeDivision: division ?? null,
        activeDistrictSlug: selectedDistrict?.slug ?? null,
        activeDistrict: district ?? null,
        activeUpazila: upazila ?? null,
      },
      stats: {
        totalDistricts: districts.length,
        totalDimensions: 4,
      },
      activeDistrict: selectedDistrict ?? null,
      districts,
      comparisonTable: districts.map((district) => ({
        district: district.district,
        slug: district.slug,
        division: district.division,
        upazilaName: district.upazilaName,
        note: district.note,
        ce: district.ce,
        ag: district.ag,
        ps: district.ps,
        ac: district.ac,
        riskIndex: district.riskIndex,
        riskLevel: district.riskLevel,
        publishedAt: district.publishedAt,
      })),
    };
  }

  async getDashboard(division?: string, district?: string, upazila?: string) {
    const records = await this.fetchPublishedRecords(division, district, upazila);
    const districts = records.map((record) => this.mapPublishedRecord(record));
    const divisions = [...new Set(districts.map((district) => district.division))];

    return {
      generatedAt: new Date().toISOString(),
      divisions,
      filters: {
        activeDivision: division ?? null,
        activeDistrict: district ?? null,
        activeUpazila: upazila ?? null,
      },
      districts,
      summary: {
        totalDistricts: districts.length,
        totalDimensions: 4,
        formula:
          'CAMH-RI = (CE × 0.25) + (AI × 0.25) + (PS × 0.25) + (AC × 0.25)',
      },
    };
  }

  async listDistricts(division?: string, district?: string, upazila?: string) {
    const records = await this.fetchPublishedRecords(division, district, upazila);
    return records.map((record) => this.mapPublishedRecord(record));
  }

  async getDistrict(slug: string) {
    const record = await this.prisma.withReconnect(() =>
      this.prisma.districtSubmission.findFirst({
        where: {
          status: SubmissionStatus.PUBLISHED,
          district: {
            slug,
          },
        },
        include: {
          district: true,
          researcher: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    );

    if (!record) {
      throw new NotFoundException('No published data found for this district.');
    }

    return this.mapPublishedRecord(record);
  }

  private async fetchPublishedRecords(
    division?: string,
    district?: string,
    upazila?: string,
  ) {
    const districtWhere = this.buildDistrictWhere(division, district);
    const submissionWhere = this.buildSubmissionWhere(upazila);

    const submissions = await this.prisma.withReconnect(() =>
      this.prisma.districtSubmission.findMany({
        where: {
          status: SubmissionStatus.PUBLISHED,
          district: districtWhere,
          ...submissionWhere,
        },
        include: {
          district: true,
          researcher: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: [
          { districtId: 'asc' },
          { upazilaName: 'asc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    );

    const latestByScope = new Map<string, (typeof submissions)[number]>();

    for (const submission of submissions) {
      const scopeKey = upazila
        ? `${submission.districtId}:${submission.upazilaCode ?? submission.upazilaName ?? 'district'}`
        : submission.districtId;

      if (!latestByScope.has(scopeKey)) {
        latestByScope.set(scopeKey, submission);
      }
    }

    return Array.from(latestByScope.values());
  }

  private buildDistrictWhere(
    division?: string,
    district?: string,
  ): Prisma.DistrictWhereInput | undefined {
    const where: Prisma.DistrictWhereInput = {};

    if (division) {
      const matchedDivision = getDivisionByIdentifier(division);
      where.division = matchedDivision
        ? `${matchedDivision.name} Division`
        : division;
    }

    if (district) {
      const matchedDistrict = getDistrictByIdentifier(district);

      if (matchedDistrict) {
        where.slug = matchedDistrict.slug;
      } else {
        where.OR = [
          { slug: district.trim().toLowerCase() },
          { name: { equals: district.trim(), mode: 'insensitive' } },
        ];
      }
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private buildSubmissionWhere(
    upazila?: string,
  ): Pick<Prisma.DistrictSubmissionWhereInput, 'upazilaCode' | 'upazilaName'> {
    if (!upazila) {
      return {};
    }

    const numericCode = Number(upazila.trim());

    if (!Number.isNaN(numericCode)) {
      return { upazilaCode: numericCode };
    }

    return {
      upazilaName: {
        equals: upazila.trim(),
        mode: 'insensitive',
      },
    };
  }

  private mapPublishedRecord(
    record: {
      district: {
        id: string;
        name: string;
        slug: string;
        division: string;
        summaryNote: string;
      };
      climateExposure: Prisma.Decimal;
      ageingIndex: Prisma.Decimal;
      psychologicalStress: Prisma.Decimal;
      adaptabilityCapacity: Prisma.Decimal;
      narrative: string;
      publishedAt: Date | null;
      createdAt: Date;
      upazilaCode?: number | null;
      upazilaName?: string | null;
      researcher?: {
        fullName: string;
        email: string;
      };
    },
  ) {
    const values = {
      climateExposure: Number(record.climateExposure),
      ageingIndex: Number(record.ageingIndex),
      psychologicalStress: Number(record.psychologicalStress),
      adaptabilityCapacity: Number(record.adaptabilityCapacity),
    };
    const riskIndex = calculateRiskIndex(values);
    const riskLevel = getRiskLevel(riskIndex);

    return {
      districtId: record.district.id,
      district: record.district.name,
      slug: record.district.slug,
      division: record.district.division,
      note: record.district.summaryNote,
      narrative: record.narrative,
      upazilaCode: record.upazilaCode ?? null,
      upazilaName: record.upazilaName ?? null,
      ce: values.climateExposure,
      ag: values.ageingIndex,
      ps: values.psychologicalStress,
      ac: values.adaptabilityCapacity,
      values,
      riskIndex,
      riskLevel,
      interpretation: getRiskInterpretation(
        record.district.name,
        riskIndex,
        record.district.summaryNote,
      ),
      publishedAt: (record.publishedAt ?? record.createdAt).toISOString(),
      contributor: record.researcher ?? null,
    };
  }
}
