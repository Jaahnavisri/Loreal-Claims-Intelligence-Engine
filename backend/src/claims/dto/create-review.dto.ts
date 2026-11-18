import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ReviewDecision } from '../claims.types';

export class CreateReviewDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  reviewerName!: string;

  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}
