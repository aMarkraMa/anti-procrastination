export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';
export type WorkStyle = 'Fast' | 'Steady' | 'HighQuality';
export type CommitmentStatus =
  | 'Draft'
  | 'Confirmed'
  | 'Active'
  | 'Completed'
  | 'Failed'
  | 'Abandoned';
export type StepStatus = 'Pending' | 'Active' | 'Completed' | 'Failed';
export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface CommitmentTaskInput {
  title: string;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  finalDeadline: string;
  commitmentAmount: number;
  difficultyLevel: DifficultyLevel;
  preferredStepCount: number;
  workStyle: WorkStyle;
}

export interface PaymentInfo {
  chargeId: string;
  amount: number;
  cardLast4: string;
  cardHolder: string;
  chargedAt: string;
  discountCode?: string | null;
  discountPercent?: number;
  originalAmount?: number;
}

export interface CommitmentTask extends CommitmentTaskInput {
  id: string;
  status: CommitmentStatus;
  steps: CommitmentStep[];
  createdAt: string;
  confirmedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  payment?: PaymentInfo;
}

export interface CommitmentStep {
  id: string;
  taskId: string;
  order: number;
  title: string;
  description: string;
  expectedOutput: string;
  timeLimitMinutes: number;
  assignedCredit: number;
  status: StepStatus;
  extensionsUsed: number;
  maxExtensions: number;
  startedAt?: string;
  deadline?: string;
  completedAt?: string;
  failedAt?: string;
}

export const DEFAULT_MAX_EXTENSIONS = 3;
export const EXTENSION_RATIO = 0.3;
