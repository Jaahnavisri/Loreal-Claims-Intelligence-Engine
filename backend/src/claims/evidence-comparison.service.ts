import { Injectable } from '@nestjs/common';
import { AssessmentRecord, ClaimRecord, EvidenceFinding, FindingStatus, StudyMetadata } from './claims.types';

const STUDY_FIELDS: Array<{ key: keyof StudyMetadata; label: string }> = [
  { key: 'minParticipantAge', label: 'Study minimum participant age' },
  { key: 'maxParticipantAge', label: 'Study maximum participant age' },
  { key: 'sampleSize', label: 'Sample size' },
  { key: 'location', label: 'Study location' },
  { key: 'duration', label: 'Study duration' },
  { key: 'studyType', label: 'Study type' },
  { key: 'studyConditions', label: 'Study conditions' },
  { key: 'outcomeMeasure', label: 'Outcome measure' },
  { key: 'genderDistribution', label: 'Participant gender distribution' },
  { key: 'skinType', label: 'Participant skin type' },
  { key: 'season', label: 'Season' },
  { key: 'measurementMethod', label: 'Measurement method' },
];

@Injectable()
export class EvidenceComparisonService {
  compareAudience(claim: ClaimRecord, assessment: AssessmentRecord): EvidenceFinding[] {
    const { minAge, maxAge, description } = claim.targetAudience;
    const { minParticipantAge, maxParticipantAge } = assessment.studyMetadata;
    const findings: EvidenceFinding[] = [];
    if (minAge !== null || maxAge !== null) {
      const missingAudienceBound = minAge === null || maxAge === null;
      const missingStudyBound = minParticipantAge === null || maxParticipantAge === null;
      let status = FindingStatus.MATCHED;
      let explanation = 'The reported study age range covers the specified target age range.';
      if (missingAudienceBound || missingStudyBound) {
        status = FindingStatus.MISSING_INFORMATION;
        explanation = 'Both audience and study age bounds are needed to determine age coverage.';
      } else if (minParticipantAge! > minAge! || maxParticipantAge! < maxAge!) {
        status = FindingStatus.DIFFERENCE_FOUND;
        explanation = 'The study population does not cover the full target age range.';
      }
      findings.push({
        field: 'ageRange', label: 'Target audience age range', status,
        targetValue: `${minAge ?? '?'}–${maxAge ?? '?'}${description ? ` (${description})` : ''}`,
        previousValue: null,
        currentValue: `${minParticipantAge ?? '?'}–${maxParticipantAge ?? '?'}`,
        explanation,
      });
    } else if (description) {
      findings.push({
        field: 'audienceDescription', label: 'Target audience description',
        status: FindingStatus.MISSING_INFORMATION, targetValue: description,
        previousValue: null, currentValue: null,
        explanation: 'The audience description is not structured enough to compare deterministically with the study population.',
      });
    }
    return findings;
  }

  compareStudies(previous: AssessmentRecord, current: AssessmentRecord): EvidenceFinding[] {
    return STUDY_FIELDS.map(({ key, label }) => {
      const previousValue = previous.studyMetadata[key];
      const currentValue = current.studyMetadata[key];
      let status = FindingStatus.MATCHED;
      let explanation = 'This study field is unchanged.';
      if (previousValue === null || currentValue === null || previousValue === '' || currentValue === '') {
        status = FindingStatus.MISSING_INFORMATION;
        explanation = previousValue == null || previousValue === ''
          ? 'The earlier study did not report this field.'
          : 'The current study does not report this field.';
      } else if (String(previousValue).trim().toLocaleLowerCase() !== String(currentValue).trim().toLocaleLowerCase()) {
        status = FindingStatus.DIFFERENCE_FOUND;
        explanation = 'The reported value changed between study versions; review whether this affects applicability.';
      }
      return {
        field: String(key), label, status, targetValue: null,
        previousValue: previousValue as string | number | null,
        currentValue: currentValue as string | number | null,
        explanation,
      };
    });
  }
}
