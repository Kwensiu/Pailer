# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.11.1](https://github.com/Kwensiu/Pailer/compare/v1.11.0...v1.11.1) (2026-04-04)


### Bug Fixes

* **dropdown:** use independent body class and allow marker ([2a6e02f](https://github.com/Kwensiu/Pailer/commit/2a6e02f8c968629e43cd6221b7518b0c7cc664e1))


### UI

* add minimized operations tray with cancellation UI ([82e3593](https://github.com/Kwensiu/Pailer/commit/82e3593d2a1afe72774fbcd3e23ba6ba55404d4f))


### Performance

* **backend:** add operation cancellation support ([5f3212f](https://github.com/Kwensiu/Pailer/commit/5f3212fde19bebe5749af35d193615b7f44b3b3c))
* **operations:** add cancellation infrastructure and hooks ([ff5c2b6](https://github.com/Kwensiu/Pailer/commit/ff5c2b6fbf90450b0aaf904a5075b93c8437ac63))

## [1.11.0](https://github.com/Kwensiu/Pailer/compare/v1.10.1...v1.11.0) (2026-04-04)


### Features

* **bucket:** implement bucket search with infinite scroll pagination ([fde924f](https://github.com/Kwensiu/Pailer/commit/fde924fe18a8236eb8b20c8b505587debaab195d))
* **doctor:** add shim args editing capability ([1689995](https://github.com/Kwensiu/Pailer/commit/16899953576f248dac57b2fd7c908c239add67e8))
* **icons:** enhance icon extraction with PrivateExtractIconsW and size support ([76a58ab](https://github.com/Kwensiu/Pailer/commit/76a58abc9f035fb8435e4cc6f87093c0a1e90936))
* **search:** add cache prebuild setting ([303c9e6](https://github.com/Kwensiu/Pailer/commit/303c9e6ed9626c7242cd4d0ba8c59c0d229fee5c))
* **ui:** implement global modal stack management and focus trapping ([64ea4f9](https://github.com/Kwensiu/Pailer/commit/64ea4f972aec583c64b7558e29a02df11c500c06))


### Bug Fixes

* improve state management, storage synchronization and i18n ([4183c19](https://github.com/Kwensiu/Pailer/commit/4183c1928a5d6f87ec2895607020ed61e50ea2b4))
* minor UI fixes and README update ([ff7cf69](https://github.com/Kwensiu/Pailer/commit/ff7cf696c9baddc701608dd60a5eb72b6d5c1e50))


### Styles

* reorganize CSS files and refine component styles ([8373aa8](https://github.com/Kwensiu/Pailer/commit/8373aa89ae6bdd2eab34c1d237737eb68a629aab))


### Refactoring

* **ui:** improve modal handling and consolidate icons ([4e8f1dc](https://github.com/Kwensiu/Pailer/commit/4e8f1dcd43d24e6843f82aa9a0de9574d3de9e9d))
* **ui:** split BucketInfoModal and PackageInfoModal into sub-components ([4eb68d3](https://github.com/Kwensiu/Pailer/commit/4eb68d34adc51baf3a47249aca45b3aa4bddbf23))

## [1.10.1](https://github.com/Kwensiu/Pailer/compare/v1.10.0...v1.10.1) (2026-03-31)


### Bug Fixes

* correct SHA256 hash formatting in fallback update ([51164c4](https://github.com/Kwensiu/Pailer/commit/51164c42d8134a64f067cfbbfb7326a0919bd379))

## [1.10.0](https://github.com/Kwensiu/Pailer/compare/v1.9.0...v1.10.0) (2026-03-31)


### Features

* add bypass self-update option for Scoop install ([7f85dad](https://github.com/Kwensiu/Pailer/commit/7f85dad2694ed3e2f4fb9f908743c940ed42c195))
* add package icon display with backend extraction logic ([70bd64e](https://github.com/Kwensiu/Pailer/commit/70bd64ecf54d362b1205ab7a057d46449b8c43dd))
* add package version switching and improve context menu navigation ([f781952](https://github.com/Kwensiu/Pailer/commit/f781952b15ff157174d404a2ba3cb3db7c21cfd1))


### Bug Fixes

* check local latest version for updates to avoid false positives ([8a31fe8](https://github.com/Kwensiu/Pailer/commit/8a31fe8be27d9bd98656f876bc554523450d9ee4))
* versioning package unexpectedly held ([b1b4305](https://github.com/Kwensiu/Pailer/commit/b1b43052e436f6f043b24aae35368152868ca9aa))


### Refactoring

* implement unified context menu architecture ([d584adf](https://github.com/Kwensiu/Pailer/commit/d584adf291ac98ccc14f87439ee4b150fde52c24))
* restructure context menu system ([bdf884e](https://github.com/Kwensiu/Pailer/commit/bdf884ecec92335a2771b77aa38e73a1ea9585e5))

## [1.9.0](https://github.com/Kwensiu/Pailer/compare/v1.8.0...v1.9.0) (2026-03-29)


### Features

* **search:** add contentMenu to search page ([4650e8a](https://github.com/Kwensiu/Pailer/commit/4650e8a64f7457a76777ce5acb2d98b3c41e1ff7))


### Bug Fixes

* **package-info:** unify update flow and correct bucket modal install state ([d754105](https://github.com/Kwensiu/Pailer/commit/d75410592115843a6c74aced63eeb3a134bdbf03))


### UI

* improve change bucket modal ([4c6d4df](https://github.com/Kwensiu/Pailer/commit/4c6d4df3cb5f22adc70371c1d7f1ff8f3454d09b))


### Refactoring

* **buckets:** centralize bucket preloading and improve state synchronization ([6812352](https://github.com/Kwensiu/Pailer/commit/6812352ddf0c35f72ed6635191c80a6304e72bb6))

## [1.8.0](https://github.com/Kwensiu/Pailer/compare/v1.7.4...v1.8.0) (2026-03-29)


### Features

* **settings:** add Scoop self-update bypass option ([45dd5fa](https://github.com/Kwensiu/Pailer/commit/45dd5fa1185fc073cfb1ba15b7cb625754383ed4))


### Performance

* **cache:** harden storage cache lifecycle and refresh behavior ([35d6fb0](https://github.com/Kwensiu/Pailer/commit/35d6fb0dacda6c5fb068a743f2b792b756f89535))


### Styles

* **settings:** refine settings card layouts ([994c606](https://github.com/Kwensiu/Pailer/commit/994c606723d370ba0f95e52c774e10c470c1c574))

## [1.7.4](https://github.com/Kwensiu/Pailer/compare/v1.7.3...v1.7.4) (2026-03-27)


### Performance

* **utils:** avoid unnecessary shortcut name replacement ([4835608](https://github.com/Kwensiu/Pailer/commit/48356086c64db2cbbad07422b06a95aee18d562b))


### Refactoring

* **installed:** simplify scoop update flow ([5131901](https://github.com/Kwensiu/Pailer/commit/51319016faf622e9ed4314894641365ca3dd5f3e))

## [1.7.3](https://github.com/Kwensiu/Pailer/compare/v1.7.2...v1.7.3) (2026-03-27)


### Bug Fixes

* **ui:** improve theme handling and consolidate doctor module translations ([f81225d](https://github.com/Kwensiu/Pailer/commit/f81225d696b0a11570aa45e3f6582c6b0664a270))


### Refactoring

* enhance auto cleanup and improve cache management UI ([#102](https://github.com/Kwensiu/Pailer/issues/102)) ([6b5cebe](https://github.com/Kwensiu/Pailer/commit/6b5cebe4885a4495b0937b226cbb8b8c6a8c0d62))

## [1.7.2](https://github.com/Kwensiu/Pailer/compare/v1.7.1...v1.7.2) (2026-03-26)


### Bug Fixes

* bucket-specific package info and manifest state ([#99](https://github.com/Kwensiu/Pailer/issues/99)) ([0b8fc97](https://github.com/Kwensiu/Pailer/commit/0b8fc977404c61d61a8713a46c6e1e47ae12994a))
* re-add package notes and use effective theme for JSON details ([55b6bd5](https://github.com/Kwensiu/Pailer/commit/55b6bd569a95244958d506f7a93f235105e6e5f7))


### Refactoring

* improve focus handling and collapsible card interactions ([#100](https://github.com/Kwensiu/Pailer/issues/100)) ([7c52995](https://github.com/Kwensiu/Pailer/commit/7c529957a4979b5f55eb31c1ebe0f530966a9423))

## [1.7.1](https://github.com/Kwensiu/Pailer/compare/v1.7.0...v1.7.1) (2026-03-26)


### Bug Fixes

* use detached cmd for scoop self-update ([#96](https://github.com/Kwensiu/Pailer/issues/96)) ([e491248](https://github.com/Kwensiu/Pailer/commit/e4912482f3208cae26b53e3a3e9da113459713ce))

## [1.7.0](https://github.com/Kwensiu/Pailer/compare/v1.6.0...v1.7.0) (2026-03-25)


### Features

* improve UI and improve search UX ([#94](https://github.com/Kwensiu/Pailer/issues/94)) ([e403657](https://github.com/Kwensiu/Pailer/commit/e4036572c4261b90e0f59266e411d828f076ff0c))

## [1.6.0](https://github.com/Kwensiu/Pailer/compare/v1.5.0...v1.6.0) (2026-03-21)


### Features

* **theme:** add system theme and set as default ([bce848b](https://github.com/Kwensiu/Pailer/commit/bce848b5c797b0ba62353497aa67a531c0b49260))


### UI

* add version type filtering and improve dropdown UI consistency ([97fe627](https://github.com/Kwensiu/Pailer/commit/97fe6278836c9f0fd8436b9c8cff7c9e40fef631))
* Enhance PackageInfoModal with dropdown and force update ([80ae5bf](https://github.com/Kwensiu/Pailer/commit/80ae5bfdd6c66094b5818d3a1f4621ccd7d931be))
* Redesign BucketInfoModal with enhanced interactions ([3b3e157](https://github.com/Kwensiu/Pailer/commit/3b3e157f11ff3a866a114fd885e7050af2e2b9ca))
* Refactor Dropdown component with reactive state management ([b5870d5](https://github.com/Kwensiu/Pailer/commit/b5870d5ef45c664f6c633f810b76fa44c083f74e))
* Update localization and modal rendering consistency ([2246275](https://github.com/Kwensiu/Pailer/commit/22462751d45df2e370ba3d8526087213eff7528c))


### Refactoring

* **installed:** implement unified context menu system ([a5b1e72](https://github.com/Kwensiu/Pailer/commit/a5b1e72a71a78915f999d3cbfa2deeae39a1f0dc))

## [1.5.0](https://github.com/Kwensiu/Pailer/compare/v1.4.0...v1.5.0) (2026-03-21)


### Features

* add ANSI color support and warning detection for operations ([7e2ff02](https://github.com/Kwensiu/Pailer/commit/7e2ff025d1331b723be69a4288f839e90f8d07d6))
* render ANSI colors in CommandInput temporary output ([ce90b3b](https://github.com/Kwensiu/Pailer/commit/ce90b3bec5d107998b0aca180b2659c1043b4665))
* **self-update:** add Pailer self-update for Scoop installations ([#82](https://github.com/Kwensiu/Pailer/issues/82)) ([a03cc51](https://github.com/Kwensiu/Pailer/commit/a03cc518322fbcc5aebd35e69867e96387b8f750))


### Bug Fixes

* remove PowerShell selector flicker ([ff1d5c4](https://github.com/Kwensiu/Pailer/commit/ff1d5c47d78bad7209b40538273d8cd93c6bb9d6))

## [1.4.0](https://github.com/Kwensiu/Pailer/compare/v1.3.1...v1.4.0) (2026-03-19)


### Features

* add Scoop path configuration wizard ([#79](https://github.com/Kwensiu/Pailer/issues/79)) ([901cef1](https://github.com/Kwensiu/Pailer/commit/901cef193b270f285cbbd114369fe689d058b057))

## [1.3.1](https://github.com/Kwensiu/Pailer/compare/v1.3.0...v1.3.1) (2026-03-18)


### Bug Fixes

* **modal:** implement intelligent scroll management for operation modals ([2860719](https://github.com/Kwensiu/Pailer/commit/2860719a0463e4575936833528e801e9f3edecf8))
* **ui:** minor text corrections and icon updates ([66b5365](https://github.com/Kwensiu/Pailer/commit/66b5365acf3eb51e4ed7cb3cdf178bba93143ffb))


### Refactoring

* **scroll:** enhance scroll management with terminal controls ([719e277](https://github.com/Kwensiu/Pailer/commit/719e277cf0bc0909e3c73a5414e6ee4ace4b5821))

## [1.3.0](https://github.com/Kwensiu/Pailer/compare/v1.2.0...v1.3.0) (2026-03-17)


### Features

* add branch switching support for git buckets ([8809cab](https://github.com/Kwensiu/Pailer/commit/8809cab1218693ebf5b07fa9ce40255d37657064))


### Bug Fixes

* **bucket:** improve branch switching functions ([cf3b72b](https://github.com/Kwensiu/Pailer/commit/cf3b72bd33f5ce4b5ecf464b7c66d970195ce706))
* **crypto:** update windows DPAPI function signatures ([c0e6502](https://github.com/Kwensiu/Pailer/commit/c0e65029a9df14670c2a67cb740e21056b7b8e24))


### Refactoring

* **i18n:** Optimizes the front-end and back-end i18n synchronization mechanism ([cd0cb2d](https://github.com/Kwensiu/Pailer/commit/cd0cb2d4d2e14fc21cbcec6e1f7a3a3dc830e4fa))

## [1.2.0](https://github.com/Kwensiu/Pailer/compare/v1.1.3...v1.2.0) (2026-03-16)


### Features

* add versioned apps management and enhance cache handling ([71f13ed](https://github.com/Kwensiu/Pailer/commit/71f13ed9b2c186dba8a9e2553891d58cd8373fd8))
* add versioned packages store for efficient version management ([bb7dbc4](https://github.com/Kwensiu/Pailer/commit/bb7dbc4ebea7d63803547bfbb2d39a160d393c41))
* **backend:** enhance package management commands ([bedbe3b](https://github.com/Kwensiu/Pailer/commit/bedbe3b8848c1d00cfc628b705de384f35358cda))
* **core:** update app logic and page components ([0e08235](https://github.com/Kwensiu/Pailer/commit/0e082356a8d16ab7a21d49dc7a83d419f5896f35))
* **core:** update backend utilities and configuration ([1d42ad6](https://github.com/Kwensiu/Pailer/commit/1d42ad6c93c505bdd5f0c62c1734d5cbc0f3b688))
* enhance version manager with cache-aware mounting ([6921943](https://github.com/Kwensiu/Pailer/commit/692194355b685e598f619497e858b884469a87fd))
* **hooks:** optimize data management and state handling ([8861e1f](https://github.com/Kwensiu/Pailer/commit/8861e1f52bc3d3102bde7130c16e50fe3240a41d))
* **i18n:** update type definitions and translations ([b9e5230](https://github.com/Kwensiu/Pailer/commit/b9e5230ab59ed87fd9594922898e285ff47118b3))
* invalidate caches after deleting app version to prevent stale data ([b3f34bf](https://github.com/Kwensiu/Pailer/commit/b3f34bf551a7cd6cc8c038e97672aeacee0078ff))
* **pages:** enhance main application pages ([be7570d](https://github.com/Kwensiu/Pailer/commit/be7570d5f5cf4d93601ee6f5c533415423ea3260))
* **search:** add text highlighting and cache mechanism ([5b619c8](https://github.com/Kwensiu/Pailer/commit/5b619c84cec088f26789213896eb58ad18e32079))
* **settings:** improve PowerShell settings and diagnostic info ([7ae41d1](https://github.com/Kwensiu/Pailer/commit/7ae41d182eb08f482e9f0486752922328bdaa11e))
* **ui:** enhance doctor and settings components ([ad019fa](https://github.com/Kwensiu/Pailer/commit/ad019fa3d035ac6610a8f345c8182db2e2bbde97))


### Bug Fixes

* i18n support for tooltips and improve package operations ([a164f56](https://github.com/Kwensiu/Pailer/commit/a164f5605da00a34af3158ed95626ec391f4f983))
* optimize error handling and code cleanup for useInstalledPackages hook ([2f40b27](https://github.com/Kwensiu/Pailer/commit/2f40b27a7267c9e3bcc8d88887d3131e94e242b6))
* resolve app close issue by moving cache cleanup ([5d45350](https://github.com/Kwensiu/Pailer/commit/5d45350264818e5f0bd4075bd3b9d0161042c51a))
* resolve critical issues from code review ([9b907fa](https://github.com/Kwensiu/Pailer/commit/9b907fabe7de15e2d789b8251f155936b8940cee))


### UI

* add new BulkUpdateProgress to separate bucketPage responsibilities ([85cac66](https://github.com/Kwensiu/Pailer/commit/85cac66289eb6d1be9664c3476f372b10f6d1bb3))
* add OpenPathButton component ([80654b1](https://github.com/Kwensiu/Pailer/commit/80654b11d4192a306df016f0192246c341caf745))
* css improvements ([7e1ad12](https://github.com/Kwensiu/Pailer/commit/7e1ad125ae342c7ea9077caa640d0c1068ced242))
* fix incorrect ui in OperationModal and PackageInfoModal ([c81ae0a](https://github.com/Kwensiu/Pailer/commit/c81ae0a6c83d184752fe8933df282e324a87822b))
* improve UI adjustments and modal layering ([83cc69a](https://github.com/Kwensiu/Pailer/commit/83cc69a69e57f1d3e42b12a5400980a58ba38793))
* update settings, styles, and localization ([48c2f41](https://github.com/Kwensiu/Pailer/commit/48c2f412ff518add3e78a6b34fd060f100ae952d))


### Performance

* implement unified data preloading for improved startup performance ([9918b35](https://github.com/Kwensiu/Pailer/commit/9918b35c1da53a21eba3762a60e688d5378ba9f0))
* improve bucket install command ([0e08b1f](https://github.com/Kwensiu/Pailer/commit/0e08b1f4e171578aa6f92cea3ab3d2898ce491d5))
* optimize session storage with anti-loop protection ([af654cf](https://github.com/Kwensiu/Pailer/commit/af654cfedecaa668d1b706b4a175dc4562010698))


### Refactoring

* centralize cache refresh logic in operations store ([02f0607](https://github.com/Kwensiu/Pailer/commit/02f0607ac9cccf85d1c7876e862effe7b0de1417))
* enhance package operations and modal interactions ([8ab30a8](https://github.com/Kwensiu/Pailer/commit/8ab30a8ba8f40764989015d42424cdfa8388936d))
* file structure and imports ([4f77dd1](https://github.com/Kwensiu/Pailer/commit/4f77dd15a83c31c23fed85c74e8cfb916f9b2791))
* improve operation modal lifecycle and status handling ([470a7de](https://github.com/Kwensiu/Pailer/commit/470a7dedc6d664ef03591343d64296a02c77adb9))
* **installed:** redesign package list with context menu ([de8047f](https://github.com/Kwensiu/Pailer/commit/de8047fd70b4ba620f7b8ff47ba37a872214b64f))
* streamline installed packages hook with optimized caching ([5b20207](https://github.com/Kwensiu/Pailer/commit/5b202071a7d96a18ba500685cc9ad2a50cc66dbe))
* **types:** enhance data types and storage mechanisms ([5016a26](https://github.com/Kwensiu/Pailer/commit/5016a26c47cd19ef77f304f3f38a5229cefaeb3f))
* update scoop path detection logic and log output ([2131678](https://github.com/Kwensiu/Pailer/commit/2131678717242324fb27679bdb7cf14c98e6ce2b))

## [1.1.3](https://github.com/Kwensiu/Pailer/compare/v1.1.2...v1.1.3) (2026-03-05)


### Bug Fixes

* reset update status to 'idle' when no update is available ([077687e](https://github.com/Kwensiu/Pailer/commit/077687e34f816761a2b612c34fbb1bd676e5bc5c))

## [1.1.2](https://github.com/Kwensiu/Pailer/compare/v1.1.1...v1.1.2) (2026-03-04)


### 🐛 Bug Fixes

* enhance session storage caching and update modal UI ([25ca893](https://github.com/Kwensiu/Pailer/commit/25ca893129383f5bb030d565aed3772eafec2e21))


### 💻 User Interface

* add markdown processing utility and GitHub-style CSS ([d896987](https://github.com/Kwensiu/Pailer/commit/d896987dc954fad73e29713395442a51f49b7d65))


### 📐 Code Refactoring

* update logic to use centralized update store ([8ac5144](https://github.com/Kwensiu/Pailer/commit/8ac5144dc1b17d909b322bc36208b4b64f51f506))
* update settings UI and add UpdateModal component ([873993f](https://github.com/Kwensiu/Pailer/commit/873993fc2c8b54df54d2d0e54345138dcc95b4fd))

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
