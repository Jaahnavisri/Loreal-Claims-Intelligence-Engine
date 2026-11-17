import { Body, Controller, Post } from '@nestjs/common';
import { AssessClaimDto } from './assess-claim.dto';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post('assess')
  assess(@Body() body: AssessClaimDto) {
    return this.claimsService.assess(body);
  }
}

