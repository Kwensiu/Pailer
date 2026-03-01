<div align="center">

<img src="https://raw.githubusercontent.com/Kwensiu/Pailer/main/src-tauri/icons/icon.png" alt="Pailer Logo" width="120">

# Pailer

**Tauri + Rust**

[中文版本](./doc/README-zh.md) | English

Pailer is a modern GUI for [Scoop](https://scoop.sh/).
</br>
Pailer is Forked from [Rscoop](https://github.com/AmarBego/Rscoop), which has </br> undergone deep refactoring and significant feature enhancements.

[![GitHub Release](https://img.shields.io/github/v/release/Kwensiu/Pailer?style=coverage-square)](https://github.com/Kwensiu/Pailer/releases)

</div>

---

## ✨ Features

* **🚀 Extreme Performance**: Built with Tauri + Rust, ensuring minimal memory footprint and lightning-fast startup.
* **🌍 Internationalization**: Native support for English and Chinese with seamless switching.
* **⚙️ Configuration Editor**: Built-in Scoop config editor—no more hunting for JSON files manually.
* **📦 Complete Package Management**: Search, install, uninstall, and update Scoop packages, plus full Bucket management.
* **💻 Integrated Terminal**: Embedded PowerShell terminal for executing custom commands on the fly.
* **🔍 Instant Search**: In-app hotkey support to trigger the search bar instantly.
* **🔄 Version Control**: Switch between different PowerShell versions to execute Scoop commands.

## 🛠️ Tech Stack

* **Frontend**: [SolidJS](https://www.solidjs.com/) + [TypeScript](https://www.typescriptlang.org/)
* **Backend**: [Rust](https://www.rust-lang.org/)
* **Styling**: [TailwindCSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
* **Build Tools**: [Vite](https://vitejs.dev/) + [Tauri](https://tauri.app/)

## 📥 Installation

### Method 1: GitHub Releases

Go to the [Releases](https://github.com/Kwensiu/Pailer/releases) page to download the latest `.nsis` installer or the `Portable` version.

### Method 2: Install via Scoop

```powershell
scoop bucket add carrot https://github.com/Kwensiu/scoop-carrot
scoop install pailer

```

## 📝 Roadmap / TODO

* [ ] Refine UI styles and component readability based on user feedback.
* [ ] Integrate more native Scoop features (e.g., app export/backup and rapid manifest building).
* [ ] Add local Scoop installation support (Default & Custom paths).
* [ ] Implement fast backup/restore compatible with Pailer and Scoop for system migration.
* [ ] Continue optimizing i18n support for backend and additional languages.
* [ ] Optimize UX with full keyboard navigation and shortcuts.
* [ ] ...and more.

## 🏗️ Development & Build

To compile the project or contribute, ensure you have [Rust](https://www.rust-lang.org/tools/install) and [Node.js](https://nodejs.org/) installed.

1. **Clone the repository**:

```bash
git clone https://github.com/Kwensiu/Pailer.git
cd Pailer

```

2. **Install dependencies**:

```bash
pnpm install

```

3. **Start development mode**:

```bash
pnpm tauri dev

```

4. **Build production release**:

```bash
pnpm tauri build

```

### Environment Requirements

* **Windows**: `make` is recommended (install via `choco install make` or use the version bundled with Git Bash).
* **Tooling**: `Prettier` for formatting (included in `devDependencies`).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the project and clone it locally.
2. Create your feature branch (`git checkout -b feat/AmazingFeature`).
3. Run [Development Automation](#️-development-automation) tools to check your files.
4. Commit your changes (`git commit -m 'feat: add some AmazingFeature'`).
5. Push to the branch (`git push origin feat/AmazingFeature`).
6. Open a Pull Request.

### 🛠️ Development Automation

This project uses a `Makefile` to manage common development tasks.

### Command Overview

| Command | Description |
| --- | --- |
| `make i18n` | Syncs `src\locales` to Tauri resources and generates type definitions. |
| `make check` | Runs a full project lint/style check. |
| `make format` | **Recommended**: Formats only the files currently modified (staged/unstaged). |

## 🙏 Acknowledgments

* [Rscoop / AmarBego](https://github.com/AmarBego/Rscoop) - The original prototype and inspiration.
* [Scoop](https://github.com/ScoopInstaller/Scoop) - The best package manager for Windows.
* To all contributors, beta testers, and users for their feedback.

## 📄 License

This project is licensed under the [MIT License](https://www.google.com/search?q=LICENSE).
