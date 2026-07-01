import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import {
  bangladeshDivisions,
  getDistrictBySlug,
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

  getUpazilaDirectory(districtSlug: string) {
    const district = getDistrictBySlug(districtSlug);

    if (!district) {
      throw new NotFoundException('District hierarchy data not found.');
    }

    return getUpazilasByDistrictCode(district.code);
  }

  async getLandingPageData(division?: string, districtSlug?: string) {
    const records = await this.fetchPublishedRecords(division);
    const districts = records.map((record) => this.mapPublishedRecord(record));
    const selectedDistrict =
      districts.find((district) => district.slug === districtSlug) ?? districts[0];

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

  async getDashboard(division?: string) {
    const records = await this.fetchPublishedRecords(division);
    const districts = records.map((record) => this.mapPublishedRecord(record));
    const divisions = [...new Set(districts.map((district) => district.division))];

    return {
      generatedAt: new Date().toISOString(),
      divisions,
      districts,
      summary: {
        totalDistricts: districts.length,
        totalDimensions: 4,
        formula:
          'CAMH-RI = (CE × 0.25) + (AI × 0.25) + (PS × 0.25) + (AC × 0.25)',
      },
    };
  }

  async listDistricts(division?: string) {
    const records = await this.fetchPublishedRecords(division);
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

  private async fetchPublishedRecords(division?: string) {
    const filter = division
      ? ({ division } satisfies Prisma.DistrictWhereInput)
      : undefined;

    const districts = await this.prisma.withReconnect(() =>
      this.prisma.district.findMany({
        where: filter,
        include: {
          submissions: {
            where: { status: SubmissionStatus.PUBLISHED },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            include: {
              researcher: {
                select: {
                  fullName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    );

    return districts
      .map((district) => {
        const latest = district.submissions[0];
        if (!latest) {
          return null;
        }

        return {
          ...latest,
          district,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
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
