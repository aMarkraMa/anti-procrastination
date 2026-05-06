import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  CommitmentStep,
  CommitmentTask,
} from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';
import { PlanApiService } from '../../api/plan-api';
import { TopbarComponent } from '../../components/topbar';
import {
  distributeCurrency,
  formatEuro,
  isPositiveAmount,
  nearlyEqual,
  roundCents,
} from '../../utils/currency';

interface StepEditDraft {
  title: string;
  description: string;
  expectedOutput: string;
  timeLimitMinutes: number;
  assignedCredit: number;
}

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [RouterModule, FormsModule, TopbarComponent],
  templateUrl: './review.html',
  styleUrls: ['./review.css'],
})
export class ReviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(CommitmentStorageService);
  private readonly planApi = inject(PlanApiService);

  protected readonly version = signal(0);

  protected readonly task = computed<CommitmentTask | undefined>(() => {
    this.version();
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    return taskId ? this.storage.getById(taskId) : this.storage.getLatestDraft();
  });

  protected readonly assignedTotal = computed(() => {
    const task = this.task();
    return roundCents(task?.steps.reduce((sum, step) => sum + step.assignedCredit, 0) ?? 0);
  });

  protected readonly totalMinutes = computed(() => {
    const task = this.task();
    return task?.steps.reduce((sum, step) => sum + step.timeLimitMinutes, 0) ?? 0;
  });

  protected readonly isBalanced = computed(() => {
    const task = this.task();
    return !!task && nearlyEqual(this.assignedTotal(), task.commitmentAmount);
  });

  protected readonly hasZeroStep = computed(() =>
    this.task()?.steps.some((s) => !isPositiveAmount(s.assignedCredit)) ?? false,
  );

  protected readonly formatEuro = formatEuro;

  protected readonly editingId = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected editDraft: StepEditDraft = {
    title: '',
    description: '',
    expectedOutput: '',
    timeLimitMinutes: 1,
    assignedCredit: 0,
  };

  protected startEdit(stepId: string): void {
    const task = this.task();
    const step = task?.steps.find((s) => s.id === stepId);
    if (!step) return;
    this.editDraft = {
      title: step.title,
      description: step.description,
      expectedOutput: step.expectedOutput,
      timeLimitMinutes: step.timeLimitMinutes,
      assignedCredit: step.assignedCredit,
    };
    this.editingId.set(stepId);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected saveEdit(stepId: string): void {
    const task = this.task();
    if (!task) return;

    const draft = this.editDraft;
    if (!draft.title.trim() || !draft.description.trim() || !draft.expectedOutput.trim()) {
      this.error.set('Title, description and expected output are all required.');
      return;
    }

    const time = Number(draft.timeLimitMinutes);
    const credit = Number(draft.assignedCredit);
    if (!Number.isFinite(time) || time < 1) {
      this.error.set('Time limit must be at least 1 minute.');
      return;
    }
    if (!isPositiveAmount(credit)) {
      this.error.set('Credit must be greater than €0.');
      return;
    }

    const steps = task.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            title: draft.title.trim(),
            description: draft.description.trim(),
            expectedOutput: draft.expectedOutput.trim(),
            timeLimitMinutes: Math.round(time),
            assignedCredit: roundCents(credit),
          }
        : s,
    );

    this.storage.update(task.id, { steps });
    this.editingId.set(null);
    this.error.set(null);
    this.touch();
  }

  protected deleteStep(stepId: string): void {
    const task = this.task();
    if (!task || task.steps.length <= 3) return;
    const steps = task.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    this.storage.update(task.id, { steps });
    this.touch();
  }

  protected async regenerate(stepId: string): Promise<void> {
    const task = this.task();
    if (!task) return;
    const step = task.steps.find((s) => s.id === stepId);
    if (!step) return;

    if (this.busyId() !== null) return;
    this.busyId.set(stepId);
    this.error.set(null);

    try {
      const others = task.steps
        .filter((s) => s.id !== stepId)
        .map((s) => ({
          order: s.order,
          title: s.title,
          description: s.description,
          expectedOutput: s.expectedOutput,
        }));

      const response = await firstValueFrom(
        this.planApi.regenerateStep({
          title: task.title,
          description: task.description,
          difficultyLevel: task.difficultyLevel,
          workStyle: task.workStyle,
          targetOrder: step.order,
          timeLimitMinutes: step.timeLimitMinutes,
          assignedCredit: step.assignedCredit,
          otherSteps: others,
        }),
      );

      const fresh = response.step;
      const steps = task.steps.map((s) =>
        s.id === stepId
          ? {
              ...s,
              title: fresh.title,
              description: fresh.description,
              expectedOutput: fresh.expectedOutput,
            }
          : s,
      );
      this.storage.update(task.id, { steps });
      this.touch();
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.busyId.set(null);
    }
  }

  protected autoBalance(): void {
    const task = this.task();
    if (!task || task.steps.length === 0) return;

    const weights = task.steps.map((s) => Math.max(s.assignedCredit, 0));
    const distributed = distributeCurrency(task.commitmentAmount, weights);

    const steps: CommitmentStep[] = task.steps.map((s, i) => ({
      ...s,
      assignedCredit: distributed[i],
    }));

    this.storage.update(task.id, { steps });
    this.touch();
  }

  protected continueToConfirm(): void {
    const task = this.task();
    if (!task || !this.isBalanced() || this.hasZeroStep()) return;
    this.router.navigate(['/confirm'], { queryParams: { taskId: task.id } });
  }

  private touch(): void {
    this.version.set(this.version() + 1);
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const detail = (err.error?.detail ?? err.error) as { code?: string; message?: string } | string | undefined;
      if (detail && typeof detail === 'object' && detail.code === 'llm_unavailable') {
        return 'AI service is unavailable right now. Try again in a moment.';
      }
      if (err.status === 0) {
        return 'Cannot reach backend at http://localhost:8000.';
      }
      return `Request failed (HTTP ${err.status}). Try again.`;
    }
    return 'Unexpected error. Please retry.';
  }
}
