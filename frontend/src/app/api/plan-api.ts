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

export interface StepBrief {
  order: number;
  title: string;
  description: string;
  expectedOutput: string;
}

export interface RegenerateStepRequest {
  title: string;
  description: string;
  difficultyLevel: DifficultyLevel;
  workStyle: WorkStyle;
  targetOrder: number;
  timeLimitMinutes: number;
  assignedCredit: number;
  otherSteps: StepBrief[];
  userHint?: string | null;
}

export interface RegenerateStepResponse {
  step: GeneratedStep;
  model: string;
}

export interface ChargeRequest {
  amount: number;
  cardHolder: string;
  cardNumberLast4: string;
  discountCode?: string | null;
}

export interface ChargeResponse {
  chargeId: string;
  amount: number;
  status: string;
  chargedAt: string;
  discountCode?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PlanApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/v1`;

  generatePlan(payload: PlanGenerateRequest): Observable<PlanGenerateResponse> {
    return this.http.post<PlanGenerateResponse>(`${this.base}/plan/generate`, payload);
  }

  regenerateStep(payload: RegenerateStepRequest): Observable<RegenerateStepResponse> {
    return this.http.post<RegenerateStepResponse>(
      `${this.base}/plan/regenerate-step`,
      payload,
    );
  }

  charge(payload: ChargeRequest): Observable<ChargeResponse> {
    return this.http.post<ChargeResponse>(`${this.base}/payments/charge`, payload);
  }
}
