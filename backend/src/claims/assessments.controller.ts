import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get(':assessmentId')
  getAssessment(@Param('assessmentId') assessmentId: string) {
    return this.claimsService.getAssessment(assessmentId);
  }

  @Get(':assessmentId/reviews')
  listReviews(@Param('assessmentId') assessmentId: string) {
    return this.claimsService.listReviews(assessmentId);
  }

  @Post(':assessmentId/reviews')
  createReview(@Param('assessmentId') assessmentId: string, @Body() body: CreateReviewDto) {
    return this.claimsService.createReview(assessmentId, body);
  }
}
