
# Release Notes 1.4.63

## [1.4.63] - 2025-11-27

## **FIX** 
- 尝试修复了一个有关Buckets获取的严重错误

## [1.4.62] - 2025-11-27

> 花费数天合并了大量内容，操作繁琐，可能出现问题但是我测试不出来

---

## **合并 / Merge**
- **[Merge]** 各组件的 Card 框架  
- **[Merge][Improvement]** 合并 `lib.rs` 并重构  

---

## **Upstream**
- **[Add]** Rscoop 现添加支持浅色主题，可在设置中手动切换  
- **[Add]** 新增启动页面配置选项，可选择应用启动时打开的默认页面  
- **[Improvement]** 使用 `git2` 库重写 Git 仓库信息读取逻辑，提高准确性  
- **[Improvement]** 优化冷启动事件处理流程及自动清理旧版本逻辑  
- **[Improvement]** 代码简化：大幅精简代码库，消除冗余并提升可维护性  
- **[Improvement]** 可复用组件：引入一系列可复用的 UI 组件，确保应用程序视觉风格更统一  
- **[Improvement]** UI 一致性：全局统一间距、色彩与字体排版，打造更精致专业的用户体验  
- **[Improvement]** 优化弹窗：标准化并改进弹窗（存储桶信息、包信息），提升可读性和交互体验  

---

## **其他改进**
- **[Improvement]** 优化最小化组件与 `FloatingOperationModal` 组件（原 `FloatingOperationPanel`）的联动  
- **[Other]** 更新依赖项：`baseline-browser-mapping`、`caniuse-lite` 和 `electron-to-chromium`  
- **[Other]** 优化正则表达式解析器性能，并增强对多种 Markdown 表格格式的支持  

> **注：**
> - 代码库内部 Package 页面仍使用 `InstalledPage` 命名，便于现有代码管理  
> - 在 Fork 项目中，`FloatingOperationPanel` 已改名为 `FloatingOperationModal`，且有意向合并到上游的 `OperationModal`，代替 `OperationModal` 的实现  

---

<details>
<summary>English Version (Click to expand)</summary>

### Release Notes 1.4.63

## **FIX** 
- Attempted to fix a critical bug related to Bucket retrieval

### Release Notes 1.4.62

> Spent a few days merging a ton of stuff, the process is tricky, could go wrong but I can't figure out what's wrong.

---

## **Merge**
- **[Merge]** Card framework for all components  
- **[Merge][Improvement]** Merged `lib.rs` and refactored  

---

## **Upstream**
- **[Add]** Rscoop now supports light theme; can be switched manually in settings  
- **[Add]** Added startup page configuration option to choose the default page when the app launches  
- **[Improvement]** Rewrote Git repository info reading logic using `git2` library for better accuracy  
- **[Improvement]** Optimized cold start event handling and automatic cleanup of old versions  
- **[Improvement]** Code simplification: significantly reduced codebase size, removed redundancy, and improved maintainability  
- **[Improvement]** Reusable components: introduced a set of reusable UI components for a more consistent visual style across the app  
- **[Improvement]** UI consistency: unified global spacing, colors, and typography for a more polished and professional user experience  
- **[Improvement]** Popup optimization: standardized and improved popups (bucket info, package info) for better readability and interaction  

---

## **Other Improvements**
- **[Improvement]** Enhanced interaction between the minimize component and `FloatingOperationModal` (formerly `FloatingOperationPanel`)  
- **[Other]** Updated dependencies: `baseline-browser-mapping`, `caniuse-lite`, and `electron-to-chromium`  
- **[Other]** Improved regex parser performance and added support for multiple Markdown table formats  

> **Note:**
> - The internal Package page in the codebase still uses the name `InstalledPage` for easier management of existing code.  
> - In the forked project, `FloatingOperationPanel` has been renamed to `FloatingOperationModal`, with plans to merge it into the upstream `OperationModal` to replace the current implementation.  

</details>
