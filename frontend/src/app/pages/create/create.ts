import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { GeneratedStep, PlanApiService } from '../../api/plan-api';
import { CommitmentStep, CommitmentTaskInput, DurationUnit } from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './create.html',
  styleUrls: ['./create.css'],
})
export class CreateComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly storage = inject(CommitmentStorageService);
  private readonly planApi = inject(PlanApiService);

  protected submitted = false;
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(80)]],
    description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(800)]],
    durationValue: [30, [Validators.required, Validators.min(1)]],
    durationUnit: ['minutes' as DurationUnit, [Validators.required]],
    commitmentAmount: [30, [Validators.required, Validators.min(1), Validators.max(10000)]],
    difficultyLevel: ['Medium' as CommitmentTaskInput['difficultyLevel'], [Validators.required]],
    preferredStepCount: [4, [Validators.required, Validators.min(3), Validators.max(8)]],
    workStyle: ['Steady' as CommitmentTaskInput['workStyle'], [Validators.required]],
  });

  protected get isAbstractTask(): boolean {
    const text = `${this.form.controls.title.value} ${this.form.controls.description.value}`
      .trim()
      .toLowerCase();

    if (!text) {
      return false;
    }

    const vaguePatterns = [
      '变得更优秀',
      '更优秀',
      'be better',
      'become better',
      'improve myself',
      '提升自己',
      '学习更多',
      '变厉害',
    ];

    const hasSpecificSignal = /\d|今天|今晚|明天|小时|分钟|完成|提交|写完|修改|build|finish|submit/.test(text);

    return vaguePatterns.some((pattern) => text.includes(pattern)) && !hasSpecificSignal;
  }

  protected get durationError(): string {
    const value = this.form.controls.durationValue.value;

    if (!Number.isFinite(value) || value < 1) {
      return '请输入大于 0 的持续时间。';
    }

    return '';
  }

  protected fieldInvalid(fieldName: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[fieldName];
    return field.invalid && (field.touched || this.submitted);
  }

  protected async submit(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();

    if (this.form.invalid || this.durationError || this.isAbstractTask) {
      return;
    }

    if (this.loading()) {
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    const formValue = this.form.getRawValue();

    try {
      const plan = await firstValueFrom(
        this.planApi.generatePlan({
          title: formValue.title,
          description: formValue.description,
          durationValue: formValue.durationValue,
          durationUnit: formValue.durationUnit,
          commitmentAmount: formValue.commitmentAmount,
          difficultyLevel: formValue.difficultyLevel,
          preferredStepCount: formValue.preferredStepCount,
          workStyle: formValue.workStyle,
        }),
      );

      const task = this.storage.createDraft({
        ...formValue,
        finalDeadline: this.calculateDeadline(formValue.durationValue, formValue.durationUnit),
      });

      const steps: CommitmentStep[] = plan.steps.map((step) => this.toCommitmentStep(step, task.id));
      this.storage.update(task.id, { steps });

      await this.router.navigate(['/review'], { queryParams: { taskId: task.id } });
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.loading.set(false);
    }
  }

  private toCommitmentStep(step: GeneratedStep, taskId: string): CommitmentStep {
    return {
      id: this.generateStepId(),
      taskId,
      order: step.order,
      title: step.title,
      description: step.description,
      expectedOutput: step.expectedOutput,
      timeLimitMinutes: step.timeLimitMinutes,
      assignedCredit: step.assignedCredit,
      status: 'Pending',
      extensionsUsed: 0,
      maxExtensions: 3,
    };
  }

  private generateStepId(): string {
    if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const detail = (err.error?.detail ?? err.error) as { code?: string; message?: string } | string | undefined;
      if (detail && typeof detail === 'object' && detail.code === 'llm_unavailable') {
        return 'AI 拆解服务暂不可用，请检查后端 OPENAI_API_KEY 是否配置。';
      }
      if (err.status === 0) {
        return '无法连接到后端 (http://localhost:8000)，请确认 FastAPI 已启动。';
      }
      if (err.status === 422) {
        return '请求字段未通过校验，请检查表单内容。';
      }
      return `请求失败 (HTTP ${err.status})，请稍后重试。`;
    }
    return '生成承诺计划时发生未知错误，请重试。';
  }

  private calculateDeadline(value: number, unit: DurationUnit): string {
    const unitMs: Record<DurationUnit, number> = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * unitMs[unit]).toISOString();
  }
}
