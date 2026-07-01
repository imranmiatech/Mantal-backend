import {
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  districtSlug: string;

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
}
