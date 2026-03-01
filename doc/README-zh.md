<div align="center">

<img src="https://raw.githubusercontent.com/Kwensiu/Pailer/main/src-tauri/icons/icon.png" alt="Pailer Logo" width="120">

# Pailer

**Tauri + Rust**

中文版本 | [English](../README.md)

Pailer 是一个为 [Scoop](https://scoop.sh/) 打造的现代化桌面客户端
</br>
Pailer 项目 fork 自 [Rscoop](https://github.com/AmarBego/Rscoop)，并在其基础上进行了深度重构和功能增强

[![GitHub Release](https://img.shields.io/github/v/release/Kwensiu/Pailer?style=coverage-square)](https://github.com/Kwensiu/Pailer/releases)

</div>

---


## ✨ 特性

* **🚀 极致性能**: 基于 Tauri + Rust，极低的内存占用和极快的启动速度。
* **🌍 国际化支持**: 原生支持中文和英文，无缝切换。
* **⚙️ 配置编辑**: 内置 Scoop 配置文件编辑器，无需手动寻找 JSON 文件。
* **📦 完整包管理**: 搜索、安装、卸载、更新 Scoop 软件包，以及管理 Buckets。
* **💻 内置终端**: 集成 PowerShell 终端，支持快速执行自定义命令。
* **🔍 快捷搜索**: 软件内快捷键支持，快速唤起搜索框。
* **🔄 版本控制**: 支持切换不同版本的 PowerShell 来执行 Scoop 命令。

## 🛠️ 技术栈

* **前端**: [SolidJS](https://www.solidjs.com/) + [TypeScript](https://www.typescriptlang.org/)
* **后端**: [Rust](https://www.rust-lang.org/)
* **样式**: [TailwindCSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
* **构建**: [Vite](https://vitejs.dev/) + [Tauri](https://tauri.app/)

## 📥 安装

### 方式 1：GitHub Releases

前往 [Releases](https://github.com/Kwensiu/Pailer/releases) 页面下载最新的 `.nsis` 安装包或 `Portable` 便携版。

### 方式 2：使用 Scoop 安装

```powershell
scoop bucket add carrot https://github.com/Kwensiu/scoop-carrot
scoop install pailer

```

## 📝 待办事项

* [ ] 根据反馈调整UI样式和组件可读性
* [ ] 引入更多的 Scoop 原生功能，例如安装、备份和软件包快速构建
* [ ] 添加 Scoop 本地安装，包括默认与自定义
* [ ] 添加兼容 Pailer 和 Scoop 的快速备份，用于系统/设备迁移
* [ ] 继续优化i18n支持，包括后端与更多语言
* [ ] 优化操作逻辑，实现键盘快捷操作
* [ ] 更多...

## 🏗️ 开发与构建

如果你想自行编译或参与开发，请确保已安装 [Rust](https://www.rust-lang.org/tools/install) 和 [Node.js](https://nodejs.org/)。

1. **克隆仓库**:

```bash
git clone https://github.com/Kwensiu/Pailer.git
cd Pailer
```

2. **安装依赖**:

```bash
pnpm install
```

3. **启动开发模式**:

```bash
pnpm tauri dev
```

4. **构建正式版**:

```bash
pnpm tauri build
```

### 环境要求

- **Windows**: 建议安装 `make` (通过 `choco install make` 或 Git Bash 自带)。
- **工具**: 格式化依赖 `Prettier` (已包含在 devDependencies)。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

1. Fork 本仓库并 Clone 到本地 (`git clone https://github.com/Kwensiu/Pailer.git`)
2. 创建你的特性分支 (`git checkout -b feat/AmazingFeature`)
3. 运行 [开发自动化](#️-开发自动化) 检查文件
4. 提交你的修改 (`git commit -m 'feat: add some AmazingFeature'`)
5. 推送到分支 (`git push origin feat/AmazingFeature`)
6. 开启一个 Pull Request

### 🛠️ 开发自动化

本项目使用 `Makefile` 管理常用开发任务。

### 快捷命令总览

| 命令             | 说明                                              |
| :----------------- | :-------------------------------------------------- |
| `make i18n`      | 自动同步 `src\locales` 到 Tauri 资源目录并生成类型定义 |
| `make check`     | 检查整个项目的代码规范                            |
| `make format`    | **推荐**：已调整为仅格式化当前改动过的文件        |

## 🙏 鸣谢

* [Rscoop/AmarBego](https://github.com/AmarBego/Rscoop) - 初始原型参考。
* [Scoop](https://github.com/ScoopInstaller/Scoop) - 最棒的 Windows 包管理器。
* 所有参与测试和反馈的朋友们。

## 📄 开源协议

本项目采用 [MIT License](https://www.google.com/search?q=LICENSE) 开源协议。
