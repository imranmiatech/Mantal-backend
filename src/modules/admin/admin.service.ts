import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma, Role, SubmissionStatus } from '@prisma/client';
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

  async getProfile(adminId: string) {
    return this.prisma.user.findFirstOrThrow({
      where: {
        id: adminId,
        role: Role.ADMIN,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        approvalStatus: true,
        createdAt: true,
      },
    });
  }

  async getDashboard(adminId: string) {
    const [
      profile,
      totalResearchers,
      pendingResearchers,
      approvedResearchers,
      rejectedResearchers,
      totalSubmissions,
      pendingSubmissions,
      publishedSubmissions,
      rejectedSubmissions,
    ] = await Promise.all([
      this.getProfile(adminId),
      this.prisma.user.count({ where: { role: Role.RESEARCHER } }),
      this.prisma.user.count({
        where: {
          role: Role.RESEARCHER,
          approvalStatus: ApprovalStatus.PENDING,
        },
      }),
      this.prisma.user.count({
        where: {
          role: Role.RESEARCHER,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      }),
      this.prisma.user.count({
        where: {
          role: Role.RESEARCHER,
          approvalStatus: ApprovalStatus.REJECTED,
        },
      }),
      this.prisma.districtSubmission.count(),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.PENDING },
      }),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.PUBLISHED },
      }),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.REJECTED },
      }),
    ]);

    return {
      profile,
      researchers: {
        total: totalResearchers,
        pending: pendingResearchers,
        approved: approvedResearchers,
        rejected: rejectedResearchers,
      },
      submissions: {
        total: totalSubmissions,
        pending: pendingSubmissions,
        published: publishedSubmissions,
        rejected: rejectedSubmissions,
      },
    };
  }

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
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = this.getPagination(page, limit);

    const [submissions, total] = await Promise.all([
      this.prisma.districtSubmission.findMany({
        where: { status: SubmissionStatus.PUBLISHED },
        include: {
          district: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: safeLimit,
      }),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.PUBLISHED },
      }),
    ]);

    return {
      data: submissions.map((submission) =>
        this.mapSubmissionForAdmin(submission),
      ),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async createSubmission(
    dto: CreateAdminSubmissionDto,
    submitterId: string,
    submitterRole: Role,
  ) {
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
    const shouldPublish =
      submitterRole === Role.RESEARCHER ? true : (dto.publishNow ?? true);

    const submission = await this.prisma.districtSubmission.create({
      data: {
        districtId: district.id,
        researcherId: submitterId,
        upazilaCode,
        upazilaName,
        ...values,
        narrative: dto.narrative,
        status: shouldPublish
          ? SubmissionStatus.PUBLISHED
          : SubmissionStatus.PENDING,
        publishedAt: shouldPublish ? new Date() : null,
        publishedById: shouldPublish ? submitterId : null,
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

  async deleteSubmission(submissionId: string) {
    const submission = await this.prisma.districtSubmission.findUnique({
      where: { id: submissionId },
      include: { district: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found.');
    }

    await this.prisma.districtSubmission.delete({
      where: { id: submissionId },
    });

    return {
      message: `${submission.district.name} submission deleted successfully.`,
      id: submission.id,
    };
  }

  async deleteResearcher(researcherId: string) {
    const researcher = await this.prisma.user.findFirst({
      where: {
        id: researcherId,
        role: Role.RESEARCHER,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    if (!researcher) {
      throw new NotFoundException('Researcher not found.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const deletedSubmissions = await tx.districtSubmission.deleteMany({
        where: { researcherId },
      });

      await tx.userApprovalAudit.deleteMany({
        where: {
          OR: [{ userId: researcherId }, { reviewerId: researcherId }],
        },
      });

      await tx.user.delete({
        where: { id: researcherId },
      });

      return deletedSubmissions;
    });

    return {
      message: `${researcher.fullName} researcher deleted successfully.`,
      id: researcher.id,
      email: researcher.email,
      deletedSubmissions: result.count,
    };
  }

  async listAllResearchers(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ) {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = this.getPagination(page, limit);
    const where: Prisma.UserWhereInput = {
      role: Role.RESEARCHER,
      ...(search?.trim()
        ? {
            OR: [
              {
                fullName: {
                  contains: search.trim(),
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: search.trim(),
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
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
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async listPendingResearchers(page: number = 1, limit: number = 10) {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = this.getPagination(page, limit);
    const where: Prisma.UserWhereInput = {
      role: Role.RESEARCHER,
      approvalStatus: ApprovalStatus.PENDING,
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          approvalStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async approveResearcher(userId: string, reviewerId: string, note?: string) {
    return this.reviewResearcher(
      userId,
      reviewerId,
      ApprovalStatus.APPROVED,
      note,
      'Researcher approved successfully.',
    );
  }

  async rejectResearcher(userId: string, reviewerId: string, note?: string) {
    return this.reviewResearcher(
      userId,
      reviewerId,
      ApprovalStatus.REJECTED,
      note,
      'Researcher rejected successfully.',
    );
  }

  async listResearcherSubmissions(researcherId: string) {
    const researcher = await this.prisma.user.findFirst({
      where: { id: researcherId, role: Role.RESEARCHER },
      select: { id: true },
    });

    if (!researcher) {
      throw new NotFoundException('Researcher not found.');
    }

    const submissions = await this.prisma.districtSubmission.findMany({
      where: { researcherId },
      include: {
        district: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((submission) =>
      this.mapSubmissionForAdmin(submission),
    );
  }

  async listPendingSubmissions(page: number = 1, limit: number = 10) {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = this.getPagination(page, limit);

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
        take: safeLimit,
      }),
      this.prisma.districtSubmission.count({
        where: { status: SubmissionStatus.PENDING },
      }),
    ]);

    return {
      data: submissions.map((submission) => ({
        ...this.mapSubmissionForAdmin(submission),
        researcher: submission.researcher,
      })),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
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

  private getPagination(page: number = 1, limit: number = 10) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 100)
        : 10;

    return {
      page: safePage,
      limit: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }

  private async reviewResearcher(
    userId: string,
    reviewerId: string,
    status: ApprovalStatus,
    note: string | undefined,
    message: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role: Role.RESEARCHER,
      },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Researcher not found.');
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { approvalStatus: status },
        select: {
          id: true,
          fullName: true,
          email: true,
          approvalStatus: true,
        },
      });

      await tx.userApprovalAudit.create({
        data: {
          userId,
          reviewerId,
          status,
          note,
        },
      });

      return updated;
    });

    return {
      message,
      user: updatedUser,
    };
  }

  private mapSubmissionForAdmin(submission: {
    id: string;
    district: {
      name: string;
      slug?: string;
      division: string;
    };
    upazilaCode: number | null;
    upazilaName: string | null;
    climateExposure: Prisma.Decimal;
    ageingIndex: Prisma.Decimal;
    psychologicalStress: Prisma.Decimal;
    adaptabilityCapacity: Prisma.Decimal;
    narrative: string;
    status: SubmissionStatus;
    createdAt: Date;
    publishedAt?: Date | null;
  }) {
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
      values,
      riskIndex,
      riskLevel: getRiskLevel(riskIndex),
      narrative: submission.narrative,
      status: submission.status,
      createdAt: submission.createdAt,
      publishedAt: submission.publishedAt ?? null,
    };
  }
}
