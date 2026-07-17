import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Role, SubmissionStatus } from '@prisma/client';
import {
  bangladeshDivisions,
  getDistrictByCode,
  getDistrictByIdentifier,
  getDistrictsByDivisionCode,
  getLocationHierarchy,
  getUpazilaByCode,
  getUpazilaByName,
  getUpazilasByDistrictCode,
} from '../../common/data/bangladesh-locations';
import {
  calculateRiskIndex,
  clampRiskValue,
  getRiskLevel,
} from '../../common/utils/risk.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminSubmissionDto } from './dto/create-admin-submission.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listDivisions() {
    return bangladeshDivisions;
  }

  listDistrictsByDivision(divisionCode?: number) {
    if (divisionCode) {
      return getDistrictsByDivisionCode(divisionCode);
    }

    return bangladeshDivisions.flatMap((division) =>
      getDistrictsByDivisionCode(division.code),
    );
  }

  listUpazilasByDistrict(districtCode: number) {
    const district = getDistrictByCode(districtCode);

    if (!district) {
      throw new NotFoundException('District code not found.');
    }

    return getUpazilasByDistrictCode(districtCode);
  }

  getLocationHierarchy() {
    return getLocationHierarchy();
  }

  async listDistricts() {
    return this.prisma.district.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        division: true,
        summaryNote: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async listPublishedSubmissions(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.prisma.districtSubmission.findMany({
        where: { status: SubmissionStatus.PUBLISHED },
        include: {
          district: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.PUBLISHED },
      }),
    ]);

    const data = submissions.map((submission) => {
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
        ce: values.climateExposure,
        ag: values.ageingIndex,
        ps: values.psychologicalStress,
        ac: values.adaptabilityCapacity,
        riskIndex,
        riskLevel: getRiskLevel(riskIndex),
        narrative: submission.narrative,
        publishedAt: submission.publishedAt,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createSubmission(dto: CreateAdminSubmissionDto, adminId: string) {
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

    const values = {
      climateExposure: clampRiskValue(dto.climateExposure),
      ageingIndex: clampRiskValue(dto.ageingIndex),
      psychologicalStress: clampRiskValue(dto.psychologicalStress),
      adaptabilityCapacity: clampRiskValue(dto.adaptabilityCapacity),
    };
    const shouldPublish = dto.publishNow ?? true;

    const submission = await this.prisma.districtSubmission.create({
      data: {
        districtId: district.id,
        researcherId: adminId,
        upazilaCode,
        upazilaName,
        ...values,
        narrative: dto.narrative,
        status: shouldPublish
          ? SubmissionStatus.PUBLISHED
          : SubmissionStatus.PENDING,
        publishedAt: shouldPublish ? new Date() : null,
        publishedById: shouldPublish ? adminId : null,
      },
    });
    const riskIndex = calculateRiskIndex(values);

    return {
      id: submission.id,
      district: district.name,
      slug: district.slug,
      division: district.division,
      upazilaCode,
      upazilaName,
      ce: values.climateExposure,
      ag: values.ageingIndex,
      ps: values.psychologicalStress,
      ac: values.adaptabilityCapacity,
      formula:
        'CAMH-RI = (CE × 0.25) + (AI × 0.25) + (PS × 0.25) + (AC × 0.25)',
      status: submission.status,
      riskIndex,
      riskLevel: getRiskLevel(riskIndex),
      publishedAt: submission.publishedAt,
      message: shouldPublish
        ? 'Data posted and published for landing page.'
        : 'Data saved as pending submission.',
    };
  }

  async listAllResearchers(page: number = 1, limit: number = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition = {
      role: Role.RESEARCHER,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereCondition,
        select: {
          id: true,
          fullName: true,
          email: true,
          approvalStatus: true,
          createdAt: true,
          _count: {
            select: { submissions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where: whereCondition,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listPendingResearchers(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: Role.RESEARCHER,
          approvalStatus: ApprovalStatus.PENDING,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          approvalStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where: {
          role: Role.RESEARCHER,
          approvalStatus: ApprovalStatus.PENDING,
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveResearcher(userId: string, reviewerId: string, note?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== Role.RESEARCHER) {
      throw new NotFoundException('Researcher not found.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { approvalStatus: ApprovalStatus.APPROVED },
      select: {
        id: true,
        fullName: true,
        email: true,
        approvalStatus: true,
      },
    });

    await this.prisma.userApprovalAudit.create({
      data: {
        userId,
        reviewerId,
        status: ApprovalStatus.APPROVED,
        note,
      },
    });

    return {
      message: 'Researcher approved successfully.',
      user: updatedUser,
    };
  }

  async listResearcherSubmissions(researcherId: string) {
    const submissions = await this.prisma.districtSubmission.findMany({
      where: { researcherId },
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
        upazilaCode: submission.upazilaCode,
        upazilaName: submission.upazilaName,
        ce: values.climateExposure,
        ag: values.ageingIndex,
        ps: values.psychologicalStress,
        ac: values.adaptabilityCapacity,
        riskIndex,
        riskLevel: getRiskLevel(riskIndex),
        narrative: submission.narrative,
        status: submission.status,
        createdAt: submission.createdAt,
      };
    });
  }

  async listPendingSubmissions(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      this.prisma.districtSubmission.findMany({
        where: { status: SubmissionStatus.PENDING },
        include: {
          district: true,
          researcher: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.PENDING },
      }),
    ]);

    const data = submissions.map((submission) => {
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
        upazilaCode: submission.upazilaCode,
        upazilaName: submission.upazilaName,
        researcher: submission.researcher,
        values,
        riskIndex,
        riskLevel: getRiskLevel(riskIndex),
        narrative: submission.narrative,
        createdAt: submission.createdAt,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async publishSubmission(submissionId: string, publisherId: string) {
    const submission = await this.prisma.districtSubmission.findUnique({
      where: { id: submissionId },
      include: { district: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    const updated = await this.prisma.districtSubmission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: publisherId,
      },
      include: { district: true },
    });

    return {
      message: `${updated.district.name} data is now live on the landing page.`,
      submissionId: updated.id,
      status: updated.status,
      publishedAt: updated.publishedAt,
    };
  }

  async rejectSubmission(submissionId: string) {
    const submission = await this.prisma.districtSubmission.findUnique({
      where: { id: submissionId },
      include: { district: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    return this.prisma.districtSubmission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.REJECTED },
      select: {
        id: true,
        status: true,
      },
    });
  }
}
