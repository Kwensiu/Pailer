# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1](https://github.com/Kwensiu/Pailer/compare/v1.1.0...v1.1.1) (2026-03-03)


### Bug Fixes

* minimized indicator UI and related issues ([60975ea](https://github.com/Kwensiu/Pailer/commit/60975ea38a167c01e2caef507ab51e8e9c43ef73))
* refactor OperationModal and fix styling bugs ([b9127b6](https://github.com/Kwensiu/Pailer/commit/b9127b6987ea082882791575dc39dbdb58308f37))
* the shortcut toggle in settings cannot be hot-swapped ([0b7467d](https://github.com/Kwensiu/Pailer/commit/0b7467d58456dabcf7551dd82c8fd5a23b016331))

## [1.1.0](https://github.com/Kwensiu/Pailer/compare/v1.0.0...v1.1.0) (2026-03-02)


### Features

* add make all command for streamlined development workflow ([483a393](https://github.com/Kwensiu/Pailer/commit/483a39349276372679998b6cdb9e0e213b4a44c3))
* enhance cache cleanup and factory reset functionality ([3111f88](https://github.com/Kwensiu/Pailer/commit/3111f88ff6d95daf7e4414f1fa23773166e9f302))
* update AboutSection UI adn remove depercated elements ([fb323ff](https://github.com/Kwensiu/Pailer/commit/fb323ff65306470a2696fd2a318e0535e6a00bc1))

## 1.0.0 (2026-03-01)

### 🎉 Initial Release

Pailer is a modern, powerful GUI manager for Scoop, forked from AmarBego's [Rscoop](https://github.com/AmarBego/Rscoop) with significant enhancements and improvements.

### ✨ Features

#### Core Functionality
- **Complete Scoop Management**: Full GUI-based management of Scoop packages, buckets, and configurations.
- **Package Operations**: Install, update, uninstall, and manage packages with an intuitive interface.
- **Bucket Management**: Add, remove, and manage Scoop buckets effortlessly.
- **Search & Discovery**: Advanced search functionality for packages and buckets.

#### Enhanced Features
- **Internationalization Support**: Multi-language support (English and Chinese).
- **Portable Terminal**: Integrated terminal for advanced operations.
- **Configuration Editor**: Built-in editor for Scoop configuration files.
- **Modern UI/UX**: Redesigned interface with improved user experience.
- **Real-time Updates**: Live status updates and progress indicators.
- **Repository Switching**: Quick repository switching for installed packages.
- **Hotkey Search**: Global hotkey support for instant text-based package search.
- **In-App Terminal**: Built-in PowerShell terminal for quick command execution.
- **PowerShell Version Control**: Specify and switch PowerShell versions for Scoop commands.

### 🛠️ Technical Stack
- **Frontend**: SolidJS with TypeScript
- **Backend**: Rust with Tauri framework
- **Styling**: TailwindCSS with DaisyUI components
- **Build**: Vite for fast development and building

### 📦 Installation
- Download from [GitHub Releases](https://github.com/Kwensiu/Pailer/releases)
- Download with Scoop:
  - `scoop bucket add carrot https://github.com/Kwensiu/scoop-carrot`
  - `scoop install pailer`
- Portable version available for advanced users

### 🔧 Requirements
- Windows 10 or later
- Scoop installed (optional, can be installed through Pailer)
- Internet connection for package operations

### 📄 License
MIT License - see `LICENSE` file for details.

### 🙏 Acknowledgments
- Original project: [AmarBego's Rscoop](https://github.com/AmarBego/Rscoop)
- Scoop community for the amazing package manager.
- All contributors and beta testers.
