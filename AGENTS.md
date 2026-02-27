# AGENTS.md (token-lean)

目标：每轮交付 1 个最小可验证增量(MVI)，并维护 ROADMAP.md：更新进度 + 续写补齐 + 清理去冗余。

R1 任务：若有 (NEXT) 必做；否则从 TODO 选依赖最少/最易验证者并设为 NEXT。每轮仅 1 任务。
R2 验证：无证据不得 DONE。优先 测试 > 运行 > 接口/日志。无法运行需说明原因+替代验证。
R3 更新：任务 -> DONE，写日期+证据；新发现 -> (NEW) 写原因+验收；保证 NEXT 仅 1 个。
R4 续写：每个 Milestone 保持 3~8 条可执行任务；模糊/大任务拆到 ≤1天；不得凭空发明模块。
R5 清理：去重复/过时；无验收旧任务(补齐或删)；TODO 总数≤20；DONE 仅保留最近15条，其余汇总。

输出限制：总输出≤220行；每段≤7条；不讲原理不闲聊。
输出格式固定：
[Task] id/acceptance
[Do] bullets
[Verify] cmd+result
[RoadmapPatch] 仅输出修改片段或diff
[Next] next_id
