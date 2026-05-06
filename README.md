# Anti-Procrastination

Project initialized with a basic monorepo structure.

## Structure

- `frontend/`: front-end application
- `backend/`: back-end service
- `frontend/env.example`: front-end env template
- `backend/env.example`: back-end env template

## Getting Started

1. Build the front-end inside `frontend/`
2. Build the back-end inside `backend/`
3. Add scripts and dependencies as needed

# Anti-Procrastination Commitment System

## 1. 产品定位

**Anti-Procrastination Commitment System** 不是一个普通的 Todo List。

它的核心目标是帮助用户把一个模糊的大任务，转化为一系列：

- 具体的
- 可执行的
- 有时间限制的
- 有承诺金额的
- 可以被验证完成状态的小步骤

拖延通常不是因为用户完全不想做，而是因为任务太模糊、没有压力、没有即时后果，或者用户不知道从哪里开始。

这个系统通过 **LLM 任务拆解 + 承诺金额 + 限时执行 + 失败扣除机制**，帮助用户更快进入行动状态。

---

## 2. 核心体验流程

用户进入产品后，不是简单创建一个任务，而是经历一个完整的 **Commitment Contract Generation Flow**。

完整体验可以分为六个阶段：

1. 创建具体任务
2. LLM 拆解任务
3. 用户确认或修改任务计划
4. 充值承诺金额
5. 按步骤执行任务
6. 完成、延时、失败与扣除机制

---

# 页面 1：产品介绍页

## 目标

用户打开 WebApp 后，不应直接看到复杂表单，而是先看到一个清晰、简洁、有说服力的产品介绍页面。

## 页面文案示例

> **Turn your vague goals into real commitments.**

> 拖延往往不是因为你不想做，而是因为任务太模糊、没有压力、没有即时后果。  
> 这个工具会把你的大目标拆成可执行步骤，并让你为每一步设置真实承诺。

## 主按钮

页面应该有一个明显的主按钮：

```text
Start a Commitment
```

点击后进入任务创建表单页面。

---

# 页面 2：任务创建表单

## 目标

这个页面的目标不是简单收集任务名称，而是收集足够多的信息，让 LLM 可以更准确地拆解任务。

## 表单字段

| 字段                 | 说明                                |
| -------------------- | ----------------------------------- |
| Task Title           | 简短标题，例如“完成 React 项目首页” |
| Task Description     | 具体任务描述                        |
| Final Deadline       | 整体任务截止时间                    |
| Commitment Amount    | 用户愿意充值的总承诺金额            |
| Difficulty Level     | 用户自己选择 Easy / Medium / Hard   |
| Preferred Step Count | 用户希望拆成几步，例如 3 到 8 步    |
| Work Style           | 快速完成 / 稳定推进 / 高质量完成    |

## 任务具体性校验

系统需要提醒用户：任务必须具体、可判断是否完成。

如果用户输入：

```text
我要变得更优秀
```

系统应该提示：

> 这个任务太抽象了。请改成一个可以在某个时间点判断是否完成的任务，例如“今晚完成简历第一页修改”或“在 2 小时内完成 3 道 LeetCode 题”。

## 任务创建后

用户提交表单后，系统调用 LLM，根据用户输入生成任务拆解计划。

---

# 页面 3：LLM 拆解结果页

## 目标

这个页面用于展示 LLM 生成的步骤计划。用户可以检查、修改、删除或重新生成某一个步骤。

## 展示形式

建议使用任务卡片形式展示每个步骤。

每个步骤卡片包含：

- Step title
- Description
- Expected output
- Time limit
- Assigned credit
- Edit button
- Regenerate button
- Delete button

## 单步重新生成

如果用户不满意某一个步骤，不需要重新生成全部计划。

用户应该可以只点击该步骤卡片上的：

```text
Regenerate
```

然后系统只重新生成这一小步。

## 用户可编辑内容

用户可以手动修改每一步的：

- 名称
- 描述
- 完成标准
- 时间限制
- 分配金额

## 金额一致性规则

系统必须强制保证：

```text
所有步骤的 Assigned Credit 总和 = 用户输入的 Commitment Amount
```

例如，如果用户输入的总承诺金额为 30€，但手动修改后步骤金额总和为 28€，系统应该提示：

> 当前步骤金额总和为 28€，与承诺金额 30€ 不一致。请重新分配，或让 AI 自动平衡。

## 时间一致性规则

如果系统设计了总任务时间，也应该保证所有步骤时间之和符合总时间要求。

当用户手动修改时间导致不一致时，系统应提示用户重新调整，或提供 AI 自动平衡功能。

---

# 页面 4：承诺确认页

## 目标

用户满意任务拆解结果后，不应该立刻跳转到支付或充值页面。

中间应该有一个清晰的 **Commitment Confirmation Page**，让用户再次理解规则和风险。

## 页面文案示例

> **You are about to create a commitment contract.**

> 你即将为这个任务充值 30€。  
> 如果你按时完成所有步骤，你可以收回全部 credit。  
> 如果你未能在时间限制内完成当前步骤，并且没有可用延时次数，后续所有 credit 将被扣除。

## 页面按钮

建议包含两个按钮：

```text
Confirm Commitment
Back to Edit Plan
```

点击确认后，任务进入执行状态。

---

# 页面 5：任务执行页

## 目标

用户在这个页面按步骤执行任务。系统展示当前步骤、剩余时间、金额风险和操作按钮。

---

## 顶部区域

顶部应该展示当前任务的整体状态：

- 当前任务标题
- 总进度，例如 `Step 2 / 4`
- Locked Credit: `30€`
- Earned Credit: `6€`
- At Risk Credit: `24€`

## 中间区域：当前步骤卡片

当前步骤卡片示例：

> 当前步骤：Build the AI-generated step review page  
> 目标：展示 AI 生成的步骤列表，并允许用户编辑。  
> 完成标准：用户可以接受、重新生成或手动修改每个步骤。  
> 奖励金额：8€  
> 剩余时间：32:18  
> 可用延时次数：3 / 3

## 操作按钮

页面应该提供三个主要操作：

```text
Complete Step
Extend Time
Give Up Task
```

---

# 页面 6：步骤完成、任务成功与失败流程

## A. 完成全部步骤

如果用户完成全部步骤，进入成功页面。

## 成功页面文案

> **Commitment completed.**

> You recovered your full credit.

## 成功结果表

| 项目             | 金额    |
| ---------------- | ------- |
| Total commitment | 30€     |
| Earned credit    | 30€     |
| Lost credit      | 0€      |
| Total time used  | 2h34min |
| Extensions used  | 1       |

## Completion Report

成功页面还可以展示一个完成报告，包括：

- 完成了几个步骤
- 每一步用了多久
- 哪一步最容易拖延
- 是否使用延时
- 用户的完成说明记录

---

## B. 放弃任务或未按时完成

如果用户放弃任务，或者当前步骤超时且没有点击延时，系统进入失败流程。

## 失败页面文案

> **Commitment failed.**

> You missed the deadline for Step 3.

## 失败损失明细

| 项目                     | 金额   |
| ------------------------ | ------ |
| Secured credit           | 14€    |
| Lost credit              | 16€    |
| Failed step              | Step 3 |
| Uncompleted future steps | Step 4 |

---

# 失败扣除规则

失败当前步骤后，系统扣除：

- 当前失败步骤的 credit
- 所有未完成未来步骤的 credit

但已经完成的步骤 credit 保留。

## 示例

假设任务总金额为 30€，分为 4 个步骤：

| Step   | Credit | 状态        |
| ------ | -----: | ----------- |
| Step 1 |     6€ | Completed   |
| Step 2 |     8€ | Completed   |
| Step 3 |     8€ | Failed      |
| Step 4 |     8€ | Not started |

那么结果是：

| 类型          | 金额 |
| ------------- | ---: |
| 已保留 credit |  14€ |
| 被扣除 credit |  16€ |

原因：

```text
Step 1 + Step 2 已完成，所以 6€ + 8€ 被保留。
Step 3 失败，Step 4 未完成，所以 8€ + 8€ 被扣除。
```

---

# 延时机制

## 规则

每个步骤在时间到之前可以延长最多 3 次。

每次延长时间为该步骤原始时间的 30%。

## 示例

如果某一步原始时间为 30 分钟：

```text
每次延长时间 = 30 分钟 × 30% = 9 分钟
```

最多可以延长 3 次：

```text
总可延长时间 = 9 分钟 × 3 = 27 分钟
```

所以该步骤最多可以使用：

```text
30 分钟 + 27 分钟 = 57 分钟
```

## 注意

用户必须在倒计时结束前点击：

```text
Extend Time
```

如果时间已经结束，并且用户没有点击延时，则该步骤进入失败状态。

---
