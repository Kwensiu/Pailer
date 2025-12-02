# Release Notes 1.4.7

## [1.4.7] - 2025-12-03

## **功能 / Features**
- **[Add]** 全面的i18n(@solid-primitives/i18n)支持实现
  - 实现了完整的多语言支持框架，目前包括 `en` `zh` 语言
  - 为所有UI组件添加了i18n文本标签

- **[Add]** 为 Scoop 配置 添加编辑按钮，直接在Rscoop内更改Scoop config

## **改进 / Improvements**
- **[Improvement]** 组件架构优化
  - 重构了多个页面组件，使用更一致的国际化调用方式
  - 重新使用ChangeBucketModal(原FloatingConfirmationPanel)，移除Change Bucket模态框在InstalledPage的单独实现

- **[Improvement]** 用户体验提升
  - 改进了按钮和图标的一致性，使用更直观的图标表示
  - 优化了列表视图的视觉层次结构，提高可读性
  - 统一了下拉菜单和弹出对话框的样式风格
  - 调整了部分输入框的位置与长度

## **修复 / Fixes**
- **[Fix]** 修复了确认面板组件关闭动画问题
  - 优化了关闭动画逻辑，确保在确认前正确显示淡出效果
- **[Fix]** 部分组件使用 Portal 解决覆盖层问题
- **[Rename]** 重命名了`FloatingConfirmationPanel`为`ChangeBucketModal`，使其功能更加明确

---

<details>
<summary>English Version (Click to expand)</summary>

# Release Notes 1.4.7

## Features
- **[Add]** Comprehensive i18n support implementation (@solid-primitives/i18n)
  - Complete multilingual framework with `en` and `zh` language support
  - Added i18n text labels for all UI components

- **[Add]** Edit button for Scoop configuration
  - Direct Scoop config editing capability within Rscoop

## Improvements
- **[Improvement]** Component architecture optimization
  - Refactored page components with consistent i18n integration patterns
  - Reused ChangeBucketModal (formerly FloatingConfirmationPanel), removing duplicate implementation in InstalledPage

- **[Improvement]** User experience enhancements
  - Improved button and icon consistency with more intuitive visual representations
  - Optimized list view visual hierarchy for better readability
  - Unified styling for dropdown menus and dialog popups
  - Adjusted input field positioning and sizing

## Fixes
- **[Fix]** Fixed confirmation panel close animation issues
  - Optimized close animation logic to ensure proper fade-out before confirmation
- **[Fix]** Resolved overlay issues using Portal in specific components
- **[Rename]** Renamed `FloatingConfirmationPanel` to `ChangeBucketModal` for clearer functionality

</details>