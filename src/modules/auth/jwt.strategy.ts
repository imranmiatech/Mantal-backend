import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ApprovalStatus, Role } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'development-secret',
    });
  }

  async validate(payload: { sub?: string }) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        approvalStatus: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      approvalStatus: user.approvalStatus as ApprovalStatus,
    };
  }
}
