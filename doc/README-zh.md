<p align="center">
<img src="../src-tauri/icons/icon.png" alt="Pailer Logo" width="120">
</p>

<h1>BBPlayer</h1>

A Scoop GUI Manager

<p align="center">
<strong>A Scoop GUI Manager<br> Built with Tauri and Rust.</strong>
</p>

<p align="center">
<a href="[https://github.com/Kwensiu/Pailer/releases](https://github.com/Kwensiu/Pailer/releases)"><img src="[https://img.shields.io/github/v/release/Kwensiu/Pailer?style=flat-square](https://www.google.com/search?q=https://img.shields.io/github/v/release/Kwensiu/Pailer%3Fstyle%3Dflat-square)" alt="Release"></a>
<a href="[https://github.com/Kwensiu/Pailer/blob/main/LICENSE](https://www.google.com/search?q=https://github.com/Kwensiu/Pailer/blob/main/LICENSE)"><img src="[https://img.shields.io/github/license/Kwensiu/Pailer?style=flat-square](https://www.google.com/search?q=https://img.shields.io/github/license/Kwensiu/Pailer%3Fstyle%3Dflat-square)" alt="License"></a>
<img src="[https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square](https://www.google.com/search?q=https://img.shields.io/badge/PRs-welcome-brightgreen.svg%3Fstyle%3Dflat-square)" alt="PRs Welcome">
</p>

---

Pailer 是一个为 [Scoop](https://scoop.sh/) 打造的现代化桌面客户端。它 fork 自 [Rscoop](https://github.com/AmarBego/Rscoop)，并在其基础上进行了深度重构和功能增强。通过 Rust 的高性能后端（Tauri）和 SolidJS 的极致前端响应，Pailer 为 Windows 软件包管理提供了前所未有的流畅体验。

## ✨ 特性 (Features)

* **🚀 极致性能**: 基于 Tauri + Rust，极低的内存占用和极快的启动速度。
* **🌍 国际化支持**: 原生支持中文和英文，无缝切换。
* **⚙️ 配置编辑**: 内置 Scoop 配置文件编辑器，无需手动寻找 JSON 文件。
* **📦 完整包管理**: 搜索、安装、卸载、更新 Scoop 软件包，以及管理 Buckets。
* **💻 内置终端**: 集成 PowerShell 终端，支持快速执行自定义命令。
* **🔍 快捷搜索**: 软件内快捷键支持，快速唤起搜索框。
* **🔄 版本控制**: 支持切换不同版本的 PowerShell 来执行 Scoop 命令。

## 🛠️ 技术栈 (Tech Stack)

* **Frontend**: [SolidJS](https://www.solidjs.com/) + [TypeScript](https://www.typescriptlang.org/)
* **Backend**: [Rust](https://www.rust-lang.org/) + [Tauri](https://tauri.app/)
* **Styling**: [TailwindCSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
* **Build Tool**: [Vite](https://vitejs.dev/)

## 📥 安装 (Installation)

### 方式 1：GitHub Releases (推荐)

前往 [Releases](https://github.com/Kwensiu/Pailer/releases) 页面下载最新的 `.msi` 安装包或 `Portable` 便携版。

### 方式 2：使用 Scoop 安装 (即将推出)

```powershell
scoop bucket add carrot https://github.com/Kwensiu/scoop-carrot
scoop install pailer

```

## 🏗️ 开发与构建 (Development)

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

### 🛠️ 开发自动化

本项目使用 `Makefile` 管理常用开发任务。

### 快捷命令总览


| 命令             | 说明                                              |
| :----------------- | :-------------------------------------------------- |
| `make i18n`      | 自动同步`locales` 到 Tauri 资源目录并生成类型定义 |
| `make bump`      | 运行版本更新脚本                                  |
| `make format`    | **推荐**：已调整为仅格式化当前改动过的文件        |
| `make format:pr` | 仅格式化与 origin/develop 相比变动的文件          |
| `make check`     | 检查整个项目的代码规范                            |

### 环境要求

- **Windows**: 建议安装 `make` (通过 `choco install make` 或 Git Bash 自带)。
- **工具**: 格式化依赖 `Prettier` (已包含在 devDependencies)。

## 📝 待办事项 (TODO)

* [ ] 支持更多的自定义主题颜色
* [ ] 优化包详情页的依赖显示
* [ ] 增加更多语言支持 (Japanese, French, etc.)

## 🤝 贡献 (Contributing)

欢迎提交 Issue 或 Pull Request！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

## 🙏 鸣谢 (Acknowledgments)

* [Rscoop](https://github.com/AmarBego/Rscoop) - 初始原型参考。
* [Scoop](https://github.com/ScoopInstaller/Scoop) - 最棒的 Windows 包管理器。
* 所有参与测试和反馈的朋友们。

## 📄 开源协议 (License)

本项目采用 [MIT License](https://www.google.com/search?q=LICENSE) 开源协议。
