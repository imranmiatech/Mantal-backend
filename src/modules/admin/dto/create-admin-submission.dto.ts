import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAdminSubmissionDto {
  @IsString()
  districtSlug: string;

  @IsOptional()
  @IsNumber()
  upazilaCode?: number;

  @IsOptional()
  @IsString()
  upazilaName?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  climateExposure: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  ageingIndex: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  psychologicalStress: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  adaptabilityCapacity: number;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  narrative: string;

  @IsOptional()
  @IsBoolean()
  publishNow?: boolean;
}
