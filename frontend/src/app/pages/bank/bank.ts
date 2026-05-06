import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { CommitmentTask } from '../../models/commitment';
import { CommitmentStorageService } from '../../services/commitment-storage';
import { PlanApiService } from '../../api/plan-api';
import { TopbarComponent } from '../../components/topbar';
import { formatEuro, roundCents } from '../../utils/currency';

interface AppliedDiscount {
  code: string;
  percent: number;
}

const DISCOUNT_CODES: Record<string, number> = {
  FREE100: 100,
};

@Component({
  selector: 'app-bank',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, TopbarComponent],
  templateUrl: './bank.html',
  styleUrls: ['./bank.css'],
})
export class BankComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(CommitmentStorageService);
  private readonly planApi = inject(PlanApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly appliedDiscount = signal<AppliedDiscount | null>(null);
  protected readonly discountError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    cardHolder: ['Jane Demo', [Validators.required, Validators.minLength(2)]],
    cardNumber: ['4242 4242 4242 4242', [Validators.required]],
    expiry: ['12/29', [Validators.required]],
    cvv: ['123', [Validators.required, Validators.minLength(3)]],
    discountCode: [''],
  });

  protected readonly task = computed<CommitmentTask | undefined>(() => {
    const taskId = this.route.snapshot.queryParamMap.get('taskId');
    return taskId ? this.storage.getById(taskId) : this.storage.getLatestDraft();
  });

  protected readonly totalMinutes = computed(() => {
    const task = this.task();
    return task?.steps.reduce((sum, step) => sum + step.timeLimitMinutes, 0) ?? 0;
  });

  protected readonly discountAmount = computed(() => {
    const t = this.task();
    const d = this.appliedDiscount();
    if (!t || !d) return 0;
    return roundCents((t.commitmentAmount * d.percent) / 100);
  });

  protected readonly chargeAmount = computed(() => {
    const t = this.task();
    if (!t) return 0;
    return roundCents(Math.max(0, t.commitmentAmount - this.discountAmount()));
  });

  protected readonly formatEuro = formatEuro;

  protected last4Display(): string {
    const digits = this.form.controls.cardNumber.value.replace(/\D/g, '');
    return digits.slice(-4).padEnd(4, '•');
  }

  protected accountSuffix(): string {
    const id = this.task()?.id ?? 'demo';
    return id.replace(/-/g, '').slice(0, 6).toUpperCase();
  }

  protected onCardInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const digits = target.value.replace(/\D/g, '').slice(0, 19);
    const grouped = digits.match(/.{1,4}/g)?.join(' ') ?? '';
    this.form.controls.cardNumber.setValue(grouped, { emitEvent: false });
    target.value = grouped;
  }

  protected onExpiryInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const digits = target.value.replace(/\D/g, '').slice(0, 4);
    const formatted =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    this.form.controls.expiry.setValue(formatted, { emitEvent: false });
    target.value = formatted;
  }

  protected formError(name: 'cardNumber'): boolean {
    if (name === 'cardNumber') {
      const digits = this.form.controls.cardNumber.value.replace(/\D/g, '');
      return digits.length > 0 && (digits.length < 13 || digits.length > 19);
    }
    return false;
  }

  protected applyDiscount(): void {
    const raw = this.form.controls.discountCode.value.trim().toUpperCase();
    if (!raw) {
      this.discountError.set('Enter a code first.');
      return;
    }
    const percent = DISCOUNT_CODES[raw];
    if (percent === undefined) {
      this.discountError.set(`Code "${raw}" is not valid.`);
      this.appliedDiscount.set(null);
      return;
    }
    this.discountError.set(null);
    this.appliedDiscount.set({ code: raw, percent });
    this.form.controls.discountCode.setValue(raw, { emitEvent: false });
  }

  protected clearDiscount(): void {
    this.appliedDiscount.set(null);
    this.discountError.set(null);
    this.form.controls.discountCode.setValue('');
  }

  protected async charge(): Promise<void> {
    const task = this.task();
    if (!task) return;
    const digits = this.form.controls.cardNumber.value.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      this.error.set('Card number must be 13–19 digits.');
      return;
    }
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const discount = this.appliedDiscount();
    const finalAmount = this.chargeAmount();

    try {
      const response = await firstValueFrom(
        this.planApi.charge({
          amount: finalAmount,
          cardHolder: this.form.controls.cardHolder.value,
          cardNumberLast4: digits.slice(-4),
          discountCode: discount?.code ?? null,
        }),
      );

      const startedAt = new Date().toISOString();
      const steps = task.steps.map((s, i) =>
        i === 0
          ? {
              ...s,
              status: 'Active' as const,
              startedAt,
              deadline: new Date(
                Date.now() + s.timeLimitMinutes * 60 * 1000,
              ).toISOString(),
            }
          : { ...s, status: 'Pending' as const },
      );

      this.storage.update(task.id, {
        status: 'Active',
        startedAt,
        steps,
        payment: {
          chargeId: response.chargeId,
          amount: response.amount,
          chargedAt: response.chargedAt,
          cardHolder: this.form.controls.cardHolder.value,
          cardLast4: digits.slice(-4),
          discountCode: discount?.code ?? null,
          discountPercent: discount?.percent ?? 0,
          originalAmount: task.commitmentAmount,
        },
      });

      this.router.navigate(['/execute'], { queryParams: { taskId: task.id } });
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.loading.set(false);
    }
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Cannot reach backend at http://localhost:8000.';
      }
      const detail = (err.error?.detail ?? err.error) as { message?: string } | string | undefined;
      if (detail && typeof detail === 'object' && detail.message) {
        return detail.message;
      }
      return `Charge failed (HTTP ${err.status}).`;
    }
    return 'Unexpected error charging the card.';
  }
}
