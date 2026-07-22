jest.mock('../../common/data/bangladesh-locations', () => ({
  bangladeshDivisions: [],
  getDistrictByCode: jest.fn(),
  getDistrictByIdentifier: jest.fn(),
  getDistrictsByDivisionCode: jest.fn(),
  getLocationHierarchy: jest.fn(),
  getUpazilaByCode: jest.fn(),
  getUpazilaByName: jest.fn(),
  getUpazilasByDistrictCode: jest.fn(),
}));

jest.mock('../../common/utils/risk.util', () => ({
  calculateRiskIndex: jest.fn(() => 0.5),
  clampRiskValue: jest.fn((value: number) => value),
  getRiskLevel: jest.fn(() => 'moderate'),
}));

import { AdminService } from './admin.service';

describe('AdminService', () => {
  const createPrismaMock = () =>
    ({
      $transaction: jest.fn((callback) =>
        callback({
          districtSubmission: {
            deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
          },
          userApprovalAudit: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          user: {
            delete: jest.fn().mockResolvedValue({ id: 'researcher-1' }),
          },
        }),
      ),
      districtSubmission: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    }) as any;

  it('deletes a submission and returns a confirmation message', async () => {
    const prisma = createPrismaMock();

    const service = new AdminService(prisma);

    prisma.districtSubmission.findUnique.mockResolvedValue({
      id: 'submission-1',
      district: { name: 'Dhaka' },
    });
    prisma.districtSubmission.delete.mockResolvedValue({ id: 'submission-1' });

    const result = await service.deleteSubmission('submission-1');

    expect(prisma.districtSubmission.findUnique).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      include: { district: true },
    });
    expect(prisma.districtSubmission.delete).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
    });
    expect(result).toEqual({
      message: 'Dhaka submission deleted successfully.',
      id: 'submission-1',
    });
  });

  it('deletes a researcher and their related records', async () => {
    const tx = {
      districtSubmission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      userApprovalAudit: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        delete: jest.fn().mockResolvedValue({ id: 'researcher-1' }),
      },
    };
    const prisma = createPrismaMock();
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    prisma.user.findFirst.mockResolvedValue({
      id: 'researcher-1',
      fullName: 'Research User',
      email: 'researcher@example.com',
    });

    const service = new AdminService(prisma);

    const result = await service.deleteResearcher('researcher-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'researcher-1',
        role: 'RESEARCHER',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });
    expect(tx.districtSubmission.deleteMany).toHaveBeenCalledWith({
      where: { researcherId: 'researcher-1' },
    });
    expect(tx.userApprovalAudit.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: 'researcher-1' }, { reviewerId: 'researcher-1' }],
      },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({
      where: { id: 'researcher-1' },
    });
    expect(result).toEqual({
      message: 'Research User researcher deleted successfully.',
      id: 'researcher-1',
      email: 'researcher@example.com',
      deletedSubmissions: 3,
    });
  });
});
