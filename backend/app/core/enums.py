from enum import Enum


class TaskStatus(str, Enum):
    DRAFT = "draft"
    PLANNING = "planning"
    AWAITING_PAYMENT = "awaiting_payment"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    FORFEITED = "forfeited"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class TransactionType(str, Enum):
    PAYOUT = "payout"
    FORFEIT = "forfeit"
    REFUND = "refund"
