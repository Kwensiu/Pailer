---
name: "staged-commit-planner"
description: "分析代码变更并规划分批提交。当用户需要按照逻辑功能拆分大量更改并生成符合约定式提交规范的命令时调用。"
---

# Staged Commit Planner (分批提交规划器)

此 Skill 旨在帮助开发者将大量的、混杂的更改按照逻辑功能块进行拆分，并生成一组符合 Conventional Commits (约定式提交) 规范的 `git add` 和 `git commit` 命令。

## 使用场景
- 当用户完成了一系列复杂的修改（如重构、新功能、Bug 修复混在一起）。
- 当用户需要将更改分批推送到仓库以保持提交历史清晰。
- 当用户需要确保每个 commit 都符合项目的 Conventional Commits 标准。

## 操作指南
1. **查看状态**: 首先运行 `git status` 了解当前有哪些文件发生了变更。
2. **分析变更**: 
   - 深入查看每个文件的 `git diff`。
   - 识别相互关联的逻辑块（例如：所有关于 Modal 重构的更改归为一类，图标提取的更改归为另一类）。
3. **制定计划**:
   - 将变更划分为 3-5 个合理的批次。
   - 为每个批次编写符合规范的 commit message (例如: `feat:`, `fix:`, `refactor:`, `style:`)。
4. **生成命令**:
   - 提供 `git add` 和 `git commit` 的组合命令。
   - 默认不自动执行，除非用户明确要求。

## 示例输出
```bash
# 批次 1: UI 重构
git add src/components/Modal.tsx && git commit -m "refactor(ui): split large modal components"

# 批次 2: 逻辑修复
git add src/utils/helper.ts && git commit -m "fix(logic): resolve calculation error in helper"
```

## 注意事项
- 确保命令中的路径是正确的。
- 如果存在新创建的文件 (Untracked files)，记得也包含在内。
- 建议一次性提供完整的规划，让用户可以一次性复制执行。
