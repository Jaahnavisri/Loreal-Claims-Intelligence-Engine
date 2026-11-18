import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { StudyMetadataDto } from './dto/study-metadata.dto';
import { TargetAudienceDto } from './dto/target-audience.dto';

export class AssessClaimDto {
  @IsOptional()
  @IsUUID()
  claimId?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  claimText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TargetAudienceDto)
  targetAudience?: TargetAudienceDto;

  @IsString()
  @MinLength(30)
  @MaxLength(12000)
  evidence!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  studyVersion?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StudyMetadataDto)
  studyMetadata?: StudyMetadataDto;
}

