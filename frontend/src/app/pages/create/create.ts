import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CommitmentTaskInput } from '../../models/commitment';
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

  protected submitted = false;

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(80)]],
    description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(800)]],
    finalDeadline: ['', [Validators.required]],
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

  protected get deadlineError(): string {
    const value = this.form.controls.finalDeadline.value;

    if (!value) {
      return '请选择最终截止时间。';
    }

    return new Date(value).getTime() <= Date.now() ? '最终截止时间必须晚于当前时间。' : '';
  }

  protected fieldInvalid(fieldName: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[fieldName];
    return field.invalid && (field.touched || this.submitted);
  }

  protected async submit(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();

    if (this.form.invalid || this.deadlineError || this.isAbstractTask) {
      return;
    }

    const task = this.storage.createDraft({
      ...this.form.getRawValue(),
      finalDeadline: new Date(this.form.controls.finalDeadline.value).toISOString(),
    });

    await this.router.navigate(['/review'], { queryParams: { taskId: task.id } });
  }
}
