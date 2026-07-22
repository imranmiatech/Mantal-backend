import { Injectable, NotFoundException } from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import {
  calculateRiskIndex,
  clampRiskValue,
  getRiskLevel,
} from '../../common/utils/risk.util';
import {
  getDistrictByIdentifier,
  getUpazilaByCode,
  getUpazilaByName,
} from '../../common/data/bangladesh-locations';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateBulkSubmissionsDto } from './dto/create-bulk-submissions.dto';

@Injectable()
export class ResearcherService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const [user, submissions] = await this.prisma.withReconnect(() =>
      Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            approvalStatus: true,
            createdAt: true,
          },
        }),
        this.prisma.districtSubmission.findMany({
          where: { researcherId: userId },
          include: {
            district: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]),
    );

    const items = submissions.map((submission) => {
      const values = {
        climateExposure: Number(submission.climateExposure),
        ageingIndex: Number(submission.ageingIndex),
        psychologicalStress: Number(submission.psychologicalStress),
        adaptabilityCapacity: Number(submission.adaptabilityCapacity),
      };
      const riskIndex = calculateRiskIndex(values);

      return {
        id: submission.id,
        district: submission.district.name,
        slug: submission.district.slug,
        division: submission.district.division,
        upazilaCode: submission.upazilaCode,
        upazilaName: submission.upazilaName,
        status: submission.status,
        values,
        riskIndex,
        riskLevel: getRiskLevel(riskIndex),
        narrative: submission.narrative,
        createdAt: submission.createdAt,
        publishedAt: submission.publishedAt,
      };
    });

    return {
      profile: user,
      summary: {
        totalSubmissions: items.length,
        pendingSubmissions: items.filter(
          (item) => item.status === SubmissionStatus.PENDING,
        ).length,
        publishedSubmissions: items.filter(
          (item) => item.status === SubmissionStatus.PUBLISHED,
        ).length,
        rejectedSubmissions: items.filter(
          (item) => item.status === SubmissionStatus.REJECTED,
        ).length,
      },
      recentSubmissions: items.slice(0, 5),
      submissions: items,
    };
  }

  async createSubmission(userId: string, dto: CreateSubmissionDto) {
    const district = await this.prisma.district.findUnique({
      where: { slug: dto.districtSlug },
    });

    if (!district) {
      throw new NotFoundException('District not found.');
    }

    const districtMeta = getDistrictByIdentifier(dto.districtSlug);
    let upazilaCode: number | null = null;
    let upazilaName: string | null = null;

    if (dto.upazilaCode || dto.upazilaName) {
      if (!districtMeta) {
        throw new NotFoundException('District metadata not found.');
      }

      const matchedUpazila = dto.upazilaCode
        ? getUpazilaByCode(districtMeta.code, dto.upazilaCode)
        : dto.upazilaName
          ? getUpazilaByName(districtMeta.code, dto.upazilaName)
          : null;

      if (!matchedUpazila) {
        throw new NotFoundException(
          'Upazila not found for the selected district.',
        );
      }

      upazilaCode = matchedUpazila.code;
      upazilaName = matchedUpazila.name;
    }

    const data = {
      climateExposure: clampRiskValue(dto.climateExposure),
      ageingIndex: clampRiskValue(dto.ageingIndex),
      psychologicalStress: clampRiskValue(dto.psychologicalStress),
      adaptabilityCapacity: clampRiskValue(dto.adaptabilityCapacity),
    };

    const submission = await this.prisma.districtSubmission.create({
      data: {
        districtId: district.id,
        researcherId: userId,
        upazilaCode,
        upazilaName,
        ...data,
        narrative: dto.narrative,
        status: SubmissionStatus.PENDING,
        publishedAt: null,
        publishedById: null,
      },
      include: {
        district: true,
      },
    });

    const riskIndex = calculateRiskIndex(data);

    return {
      id: submission.id,
      district: submission.district.name,
      slug: submission.district.slug,
      division: submission.district.division,
      upazilaCode,
      upazilaName,
      status: submission.status,
      riskIndex,
      riskLevel: getRiskLevel(riskIndex),
      createdAt: submission.createdAt,
      publishedAt: submission.publishedAt,
      message: 'Submission saved and is pending admin review.',
    };
  }

  async createBulkSubmissions(userId: string, dto: CreateBulkSubmissionsDto) {
    const results: any[] = [];
    for (const submission of dto.submissions) {
      const result = await this.createSubmission(userId, submission);
      results.push(result);
    }
    return {
      message: `Successfully processed ${results.length} submissions.`,
      submissions: results,
    };
  }

  async listMySubmissions(userId: string) {
    const submissions = await this.prisma.districtSubmission.findMany({
      where: { researcherId: userId },
      include: {
        district: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((submission) => {
      const values = {
        climateExposure: Number(submission.climateExposure),
        ageingIndex: Number(submission.ageingIndex),
        psychologicalStress: Number(submission.psychologicalStress),
        adaptabilityCapacity: Number(submission.adaptabilityCapacity),
      };
      const riskIndex = calculateRiskIndex(values);

      return {
        id: submission.id,
        district: submission.district.name,
        slug: submission.district.slug,
        division: submission.district.division,
        upazilaCode: submission.upazilaCode,
        upazilaName: submission.upazilaName,
        status: submission.status,
        values,
        riskIndex,
        riskLevel: getRiskLevel(riskIndex),
        narrative: submission.narrative,
        createdAt: submission.createdAt,
        publishedAt: submission.publishedAt,
      };
    });
  }
}
