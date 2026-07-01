import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApprovalStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already registered.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: Role.RESEARCHER,
        approvalStatus: ApprovalStatus.PENDING,
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

    return {
      message: 'Signup complete. Wait for admin approval before login.',
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (
      user.role === Role.RESEARCHER &&
      user.approvalStatus !== ApprovalStatus.APPROVED
    ) {
      throw new UnauthorizedException(
        'Researcher login requires admin approval first.',
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
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
}
