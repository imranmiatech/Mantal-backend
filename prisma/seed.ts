import { PrismaClient, ApprovalStatus, Role, SubmissionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  bangladeshDivisions,
  getDistrictBySlug,
  getDistrictsByDivisionCode,
  getUpazilaByName,
} from '../src/common/data/bangladesh-locations';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@camh.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'System Admin',
      passwordHash,
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
    },
    create: {
      fullName: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
    },
  });

  const districts = bangladeshDivisions.flatMap((division) =>
    getDistrictsByDivisionCode(division.code).map((district) => ({
      name: district.name,
      slug: district.slug,
      division: `${division.name} Division`,
      summaryNote: `${district.name} district in ${division.name} Division, Bangladesh.`,
    })),
  );

  for (const district of districts) {
    await prisma.district.upsert({
      where: { slug: district.slug },
      update: district,
      create: district,
    });
  }

  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  const district = await prisma.district.findUnique({
    where: { slug: 'kishoreganj' },
  });
  const districtMeta = getDistrictBySlug('kishoreganj');
  const upazila = districtMeta
    ? getUpazilaByName(districtMeta.code, 'Hossainpur')
    : null;

  if (admin && district) {
    const existingSubmission = await prisma.districtSubmission.findFirst({
      where: {
        districtId: district.id,
        upazilaName: upazila?.name ?? 'Hossainpur',
        status: SubmissionStatus.PUBLISHED,
      },
    });

    if (!existingSubmission) {
      await prisma.districtSubmission.create({
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
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
