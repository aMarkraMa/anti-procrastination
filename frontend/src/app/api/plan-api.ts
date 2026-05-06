import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  DifficultyLevel,
  DurationUnit,
  WorkStyle,
} from '../models/commitment';
import { environment } from './environment';

export interface PlanGenerateRequest {
  title: string;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  commitmentAmount: number;
  difficultyLevel: DifficultyLevel;
  preferredStepCount: number;
  workStyle: WorkStyle;
}

export interface GeneratedStep {
  order: number;
  title: string;
  description: string;
  expectedOutput: string;
  timeLimitMinutes: number;
  assignedCredit: number;
}

export interface PlanGenerateResponse {
  steps: GeneratedStep[];
  totalDurationMinutes: number;
  totalCredit: number;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class PlanApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiBaseUrl}/api/v1/plan/generate`;

  generatePlan(payload: PlanGenerateRequest): Observable<PlanGenerateResponse> {
    return this.http.post<PlanGenerateResponse>(this.endpoint, payload);
  }
}
