import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApprovalStatus, Role, SubmissionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  bangladeshDivisions,
  getDistrictBySlug,
  getDistrictsByDivisionCode,
  getUpazilaByName,
} from './common/data/bangladesh-locations';
import { PrismaService } from './modules/prisma/prisma.service';

@Injectable()
export class AppBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AppBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
    await this.ensureDistricts();
    await this.ensureDummyPublishedData();
  }

  private async ensureDefaultAdmin() {
    const email = process.env.ADMIN_EMAIL ?? 'admin@e.com';
    const password = process.env.ADMIN_PASSWORD ?? 'superadmin';
    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.upsert({
      where: { email },
      update: {
        fullName: 'System Admin',
        passwordHash,
        role: Role.ADMIN,
        approvalStatus: ApprovalStatus.APPROVED,
      },
      create: {
        fullName: 'System Admin',
        email,
        passwordHash,
        role: Role.ADMIN,
        approvalStatus: ApprovalStatus.APPROVED,
      },
    });

    this.logger.log(`Default admin ready for ${email}`);
  }

  private async ensureDistricts() {
    const districts = bangladeshDivisions.flatMap((division) =>
      getDistrictsByDivisionCode(division.code).map((district) => ({
        name: district.name,
        slug: district.slug,
        division: `${division.name} Division`,
        summaryNote: `${district.name} district in ${division.name} Division, Bangladesh.`,
      })),
    );

    await Promise.all(
      districts.map((district) =>
        this.prisma.district.upsert({
          where: { slug: district.slug },
          update: district,
          create: district,
        }),
      ),
    );
  }

  private async ensureDummyPublishedData() {
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@e.com';
    const admin = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!admin) {
      return;
    }

    const district = await this.prisma.district.findUnique({
      where: { slug: 'kishoreganj' },
    });

    if (!district) {
      return;
    }

    const districtMeta = getDistrictBySlug('kishoreganj');
    const upazila = districtMeta
      ? getUpazilaByName(districtMeta.code, 'Hossainpur')
      : null;

    const existingSubmission = await this.prisma.districtSubmission.findFirst({
      where: {
        districtId: district.id,
        upazilaName: upazila?.name ?? 'Hossainpur',
        status: SubmissionStatus.PUBLISHED,
      },
    });

    if (existingSubmission) {
      return;
    }

    await this.prisma.districtSubmission.create({
      data: {
        districtId: district.id,
        researcherId: admin.id,
        upazilaCode: upazila?.code ?? null,
        upazilaName: upazila?.name ?? 'Hossainpur',
        climateExposure: 0.66,
        ageingIndex: 0.72,
        psychologicalStress: 0.61,
        adaptabilityCapacity: 0.55,
        narrative:
          'Dummy published CAMH record for Hossainpur Upazila under Kishoreganj District in Dhaka Division.',
        status: SubmissionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: admin.id,
      },
    });

    this.logger.log('Dummy published data ready for Kishoreganj / Hossainpur');
  }
}
