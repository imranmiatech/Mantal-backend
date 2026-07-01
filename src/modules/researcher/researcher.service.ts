import { Injectable, NotFoundException } from '@nestjs/common';
import { SubmissionStatus } from '@prisma/client';
import {
  calculateRiskIndex,
  clampRiskValue,
  getRiskLevel,
} from '../../common/utils/risk.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class ResearcherService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubmission(userId: string, dto: CreateSubmissionDto) {
    const district = await this.prisma.district.findUnique({
      where: { slug: dto.districtSlug },
    });

    if (!district) {
      throw new NotFoundException('District not found.');
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
        ...data,
        narrative: dto.narrative,
        status: SubmissionStatus.PENDING,
      },
      include: {
        district: true,
      },
    });

    const riskIndex = calculateRiskIndex(data);

    return {
      id: submission.id,
      district: submission.district.name,
      status: submission.status,
      riskIndex,
      riskLevel: getRiskLevel(riskIndex),
      createdAt: submission.createdAt,
      message: 'Submission saved. Admin needs to publish it before public view.',
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
        division: submission.district.division,
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
