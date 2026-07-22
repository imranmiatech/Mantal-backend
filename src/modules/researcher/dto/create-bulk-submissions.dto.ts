import { IsArray, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSubmissionDto } from './create-submission.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBulkSubmissionsDto {
  @ApiProperty({
    type: [CreateSubmissionDto],
    description: 'Array of district submissions',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateSubmissionDto)
  submissions: CreateSubmissionDto[];
}
