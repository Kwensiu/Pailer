# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.17.2](https://github.com/Kwensiu/Pailer/compare/v1.17.2...v1.17.2) (2026-06-20)


### ⚠ BREAKING CHANGES

* **core:** The createStoredSignal hook has been renamed to createTauriSignal. Update all imports and references accordingly.
* **lib:** Background task functionality moved to separate module

### Features

* add administrator privilege retry support for package operations ([8de04dc](https://github.com/Kwensiu/Pailer/commit/8de04dc655620d14b932954c14b941e3a3a84dfb))
* add ANSI color support and warning detection for operations ([7e2ff02](https://github.com/Kwensiu/Pailer/commit/7e2ff025d1331b723be69a4288f839e90f8d07d6))
* add branch switching support for git buckets ([8809cab](https://github.com/Kwensiu/Pailer/commit/8809cab1218693ebf5b07fa9ce40255d37657064))
* add bypass self-update option for Scoop install ([7f85dad](https://github.com/Kwensiu/Pailer/commit/7f85dad2694ed3e2f4fb9f908743c940ed42c195))
* Add CI version warnings in package update tooltips ([144c45d](https://github.com/Kwensiu/Pailer/commit/144c45d3a16789cd2280cc9e47b45015f18f350b))
* add global hotkey to focus search bar on search page ([1f2ab4f](https://github.com/Kwensiu/Pailer/commit/1f2ab4fd03f929e9dd00e227175ac69373bf8084))
* add global scoop operation queue mode ([42773c7](https://github.com/Kwensiu/Pailer/commit/42773c7db15945949141babe40594e8360699dcf))
* add hotkey settings toggle ([517f0d7](https://github.com/Kwensiu/Pailer/commit/517f0d7b5b31e7ac6b4c1f015efeb0c191588661))
* add make all command for streamlined development workflow ([483a393](https://github.com/Kwensiu/Pailer/commit/483a39349276372679998b6cdb9e0e213b4a44c3))
* add notify icon settings dedupe commands and doctor UI ([59300de](https://github.com/Kwensiu/Pailer/commit/59300de64052a49396e6eb0e51cb6349165ed270))
* add NSIS installer locale path support and refactor variable naming in i18n.rs ([bba3970](https://github.com/Kwensiu/Pailer/commit/bba3970daf015a02dc90ef41042e0f15ed8086c4))
* add operation management system with minimized indicators and multi-instance warning ([fe2abe1](https://github.com/Kwensiu/Pailer/commit/fe2abe1c2ef6cec20484bf2e63cab9c8070ce1da))
* add package icon display with backend extraction logic ([70bd64e](https://github.com/Kwensiu/Pailer/commit/70bd64ecf54d362b1205ab7a057d46449b8c43dd))
* add package version switching and improve context menu navigation ([f781952](https://github.com/Kwensiu/Pailer/commit/f781952b15ff157174d404a2ba3cb3db7c21cfd1))
* add release-please and change workflow to tauri-action@v0 ([#18](https://github.com/Kwensiu/Pailer/issues/18)) ([ae0fe90](https://github.com/Kwensiu/Pailer/commit/ae0fe90bb0f1d7ebc706c96210e17e2213cd762f))
* add robust tray config migration with snapshot sync and safer dedupe ([bc38596](https://github.com/Kwensiu/Pailer/commit/bc385962db2706c75237c191cc674ca30bf4f7de))
* add Scoop path configuration wizard ([#79](https://github.com/Kwensiu/Pailer/issues/79)) ([901cef1](https://github.com/Kwensiu/Pailer/commit/901cef193b270f285cbbd114369fe689d058b057))
* Add session storage caching for PowerShell executable detection ([#30](https://github.com/Kwensiu/Pailer/issues/30)) ([46d8b17](https://github.com/Kwensiu/Pailer/commit/46d8b17b5fa3ba9fa2a34ebb0a376f48ad00a753))
* Add silent refresh to some components ([48d9c26](https://github.com/Kwensiu/Pailer/commit/48d9c26e23866a6cc28e24e3c36ad936d4a3e3a8))
* add silent startup option integrated into startup settings ([6690ab6](https://github.com/Kwensiu/Pailer/commit/6690ab63d41cb7bef60e3e164da286fff94bf0f8))
* add versioned apps management and enhance cache handling ([71f13ed](https://github.com/Kwensiu/Pailer/commit/71f13ed9b2c186dba8a9e2553891d58cd8373fd8))
* add versioned packages store for efficient version management ([bb7dbc4](https://github.com/Kwensiu/Pailer/commit/bb7dbc4ebea7d63803547bfbb2d39a160d393c41))
* add Windows DPAPI encryption module, fix wrong name(scoopmeta) and UI ([#9](https://github.com/Kwensiu/Pailer/issues/9)) ([c12014d](https://github.com/Kwensiu/Pailer/commit/c12014dc1fe0985a0f1468a2c66aa3fc8ddc9a9a))
* allow zero old versions in auto cleanup ([b8adf6c](https://github.com/Kwensiu/Pailer/commit/b8adf6ce72b4c252fb3338ad4cba6523369cd865))
* allow zero old versions in auto cleanup ([d8ada6a](https://github.com/Kwensiu/Pailer/commit/d8ada6a6b810c9127943b80b99b8f61a471a0749))
* **backend:** enhance package management commands ([bedbe3b](https://github.com/Kwensiu/Pailer/commit/bedbe3b8848c1d00cfc628b705de384f35358cda))
* **bucket-search:** Remove extended search info API and implement frontend hard-coded solution ([c4d271c](https://github.com/Kwensiu/Pailer/commit/c4d271c5aac224f476cb3d84db0a8499bfb43b35))
* **bucket:** implement bucket search with infinite scroll pagination ([fde924f](https://github.com/Kwensiu/Pailer/commit/fde924fe18a8236eb8b20c8b505587debaab195d))
* **bucket:** 优化 bucket 更新逻辑并增强日志记录 ([25c6d18](https://github.com/Kwensiu/Pailer/commit/25c6d18da5600eb795235f5798c02fe62047f23e))
* **Card:** add conditionalContent prop with dynamic height animation and accessibility improvements ([8191e98](https://github.com/Kwensiu/Pailer/commit/8191e98e6905e77cacf20f44d37a921c2079c5d6))
* **components:** 替换 CheckCircle 图标为 CircleCheckBig [skip ci] ([8b66f4e](https://github.com/Kwensiu/Pailer/commit/8b66f4e4627071235119afb896d0d6f005b9b7a2))
* **config:** add dependabot configuration for automated dependency updates ([e498e4d](https://github.com/Kwensiu/Pailer/commit/e498e4dbe68a84a2d90c72caefd953bb1820ab7c))
* configure NSIS installer for user-level installation with custom template and localization ([92932c5](https://github.com/Kwensiu/Pailer/commit/92932c5496366f5b283351a1a1892eb2108ae844))
* continue refactoring and enhancing i18n ([f8bdc7c](https://github.com/Kwensiu/Pailer/commit/f8bdc7c7fab97b33c774ff9d74c7f221cd833530))
* **core:** update app logic and page components ([0e08235](https://github.com/Kwensiu/Pailer/commit/0e082356a8d16ab7a21d49dc7a83d419f5896f35))
* **core:** update backend utilities and configuration ([1d42ad6](https://github.com/Kwensiu/Pailer/commit/1d42ad6c93c505bdd5f0c62c1734d5cbc0f3b688))
* **custom-update:** 实现自定义更新检查与安装功能（实验） ([b72d82b](https://github.com/Kwensiu/Pailer/commit/b72d82b597e9ed001969b869e7eef147179cd5bc))
* **DebugModal:** 优化调试模态框性能并改进日志处理 [skip ci] ([f247d21](https://github.com/Kwensiu/Pailer/commit/f247d2123f68a99f2b8bf416282f4a2d4371bd8c))
* **debug:** 实现增强的应用数据清理与重置功能 [skip ci] ([fa96d16](https://github.com/Kwensiu/Pailer/commit/fa96d16280ec9ba9f68c5527f763d9dc276ce7bf))
* **debug:** 支持读取新旧目录的日志文件 ([c9ecd70](https://github.com/Kwensiu/Pailer/commit/c9ecd708302ecaa9008ba5afa7a959effbcfa965))
* **doctor:** add shim args editing capability ([1689995](https://github.com/Kwensiu/Pailer/commit/16899953576f248dac57b2fd7c908c239add67e8))
* **doctor:** enhance health check with i18n suggestions and UI improvements & fixes ([8991b49](https://github.com/Kwensiu/Pailer/commit/8991b499f4e3ea213dbf85598d24f8026180823f))
* enhance auto-update settings UI and localization ([908c156](https://github.com/Kwensiu/Pailer/commit/908c156c4a032ba0c5ef2d911803decad4c0ca51))
* enhance bucket page functionality and modal layering ([df57830](https://github.com/Kwensiu/Pailer/commit/df578305e0a9e571d2758e63cdb9cd0c3cd888e0))
* enhance BucketInfoModal with improved functionality ([82164ab](https://github.com/Kwensiu/Pailer/commit/82164ab4faffcca4e42cc823913828bfd067fa11))
* enhance cache cleanup and factory reset functionality ([3111f88](https://github.com/Kwensiu/Pailer/commit/3111f88ff6d95daf7e4414f1fa23773166e9f302))
* enhance frontend features and components ([b16f849](https://github.com/Kwensiu/Pailer/commit/b16f8492540744a28430c7f5a9b3a71482ff44de))
* enhance modal animations and theming, adjust z-index ([b5935e1](https://github.com/Kwensiu/Pailer/commit/b5935e10ed463a4aee8b001ae6c29f3f8bcbe47f))
* enhance package grid UI and reorganize localization ([6717487](https://github.com/Kwensiu/Pailer/commit/6717487417db152c7e60c61828e5c88a2b252f85))
* enhance Scoop configuration detection and installed packages management ([#13](https://github.com/Kwensiu/Pailer/issues/13)) ([f45d2b7](https://github.com/Kwensiu/Pailer/commit/f45d2b7d57843fa3ae6210997dec8355ce7a387f))
* enhance search bar with expandable UI, global shortcuts, and session persistence ([a2ce18c](https://github.com/Kwensiu/Pailer/commit/a2ce18c0c3d471201743da780bffc3ff82b37e62))
* enhance UI styling and refactor components ([c3e94c5](https://github.com/Kwensiu/Pailer/commit/c3e94c5b600d57058739871e3282e881a9095cb7))
* enhance version manager with cache-aware mounting ([6921943](https://github.com/Kwensiu/Pailer/commit/692194355b685e598f619497e858b884469a87fd))
* **hooks:** optimize data management and state handling ([8861e1f](https://github.com/Kwensiu/Pailer/commit/8861e1f52bc3d3102bde7130c16e50fe3240a41d))
* **i18n:** Optimize language initialization logic and prevent memory leaks ([faddc67](https://github.com/Kwensiu/Pailer/commit/faddc676ec546570ff2117bd17f77abe46048924))
* **i18n:** update type definitions and translations ([b9e5230](https://github.com/Kwensiu/Pailer/commit/b9e5230ab59ed87fd9594922898e285ff47118b3))
* **i18n:** 为 Scoop 状态模态框添加国际化支持 [skip ci] ([fe403bd](https://github.com/Kwensiu/Pailer/commit/fe403bdf2aa6ac6972412a26bf2f2e51c719a0d9))
* **icon:** change to new app icon of Pailer ([3b7bc25](https://github.com/Kwensiu/Pailer/commit/3b7bc2556db2b62618bbb4397cc4bc38ed077659))
* **icons:** enhance icon extraction with PrivateExtractIconsW and size support ([76a58ab](https://github.com/Kwensiu/Pailer/commit/76a58abc9f035fb8435e4cc6f87093c0a1e90936))
* implement advanced search functionality with bucket filtering and global hotkeys ([0184edc](https://github.com/Kwensiu/Pailer/commit/0184edc54cd85e9b3c9a8142294de2091b2dc326))
* implement auto-cleanup feature for settings page ([e53014e](https://github.com/Kwensiu/Pailer/commit/e53014e192836bb026546825cc8629984390990b))
* implement internationalization support ([04205ce](https://github.com/Kwensiu/Pailer/commit/04205ce663cdb15fd80e0eda40ac87e2c8508071))
* improve UI and improve search UX ([#94](https://github.com/Kwensiu/Pailer/issues/94)) ([e403657](https://github.com/Kwensiu/Pailer/commit/e4036572c4261b90e0f59266e411d828f076ff0c))
* **info:** 优化包信息获取逻辑以支持已安装包的 bucket 识别 ([9217a1b](https://github.com/Kwensiu/Pailer/commit/9217a1b3ea313e89f7e6211dbcffa138a6988833))
* **InstalledPage:** 每次进入Packages页面时执行静默刷新（实验） ([54a6d5d](https://github.com/Kwensiu/Pailer/commit/54a6d5dc811f6be49777ffe311fa67c766a55d12))
* internationalize sidebar navigation and fix button key typo ([cf2cae3](https://github.com/Kwensiu/Pailer/commit/cf2cae3f602b9a15dafa4e5b4745a296194dda74))
* invalidate caches after deleting app version to prevent stale data ([b3f34bf](https://github.com/Kwensiu/Pailer/commit/b3f34bf551a7cd6cc8c038e97672aeacee0078ff))
* major backend core functionality updates ([edc4d1e](https://github.com/Kwensiu/Pailer/commit/edc4d1eb761d2154dd75a96dc632aac3f892fec0))
* **modal:** ensure clean state for new operations ([a33ddd1](https://github.com/Kwensiu/Pailer/commit/a33ddd18620c0197138298622d1daa060c79266f))
* **OperationModal:** Optimize scroll behavior to auto-scroll only when user approaches bottom ([bf48e56](https://github.com/Kwensiu/Pailer/commit/bf48e56de20a6cdf680d3170853682f5e48e6cae))
* optimize bucket loading ([68f719b](https://github.com/Kwensiu/Pailer/commit/68f719b37c24705901f3de7949efd47ddc79f0e3))
* **package-info:** add fast path for low-risk version switches ([5d59651](https://github.com/Kwensiu/Pailer/commit/5d59651e0c37ee8a1d556fdeb85da1959be2fe4d))
* **package-info:** add Run action with split entry selector in footer ([802d563](https://github.com/Kwensiu/Pailer/commit/802d563c41cd95ff526466cb5ce2b1217793628c))
* **pages:** enhance main application pages ([be7570d](https://github.com/Kwensiu/Pailer/commit/be7570d5f5cf4d93601ee6f5c533415423ea3260))
* **powershell:** add PowerShell executable selection and management ([f9d4be2](https://github.com/Kwensiu/Pailer/commit/f9d4be28d72139d46689fbde1d04627caee088d6))
* queue per-package update all operations ([eb98c19](https://github.com/Kwensiu/Pailer/commit/eb98c198950ca9e92be9d62eb1ad1cff43c74d5b))
* refactor system tray with customizable shortcuts and i18n support ([3e200bb](https://github.com/Kwensiu/Pailer/commit/3e200bb04ca391854ebe49ecd7b7ad14df281f58))
* **release:** bump version to 1.4.7 with i18n integration and UI enhancements ([63fdf0c](https://github.com/Kwensiu/Pailer/commit/63fdf0cddd86d4f58851d664d944c3c3eb0a8c2b))
* **release:** 更新版本号至1.5.0，同时更新版本发布流程并完善 Release Notes ([4f53f72](https://github.com/Kwensiu/Pailer/commit/4f53f7231d89a4b65082233b0ca0856a87b28b7b))
* **release:** 更新版本号至1.5.0，同时更新版本发布流程并完善 Release Notes ([60bfe5d](https://github.com/Kwensiu/Pailer/commit/60bfe5dd21a36e9be8149a43bf8be0b9d2e17c9c))
* **release:** 调整 Release 工作流 ([6c87685](https://github.com/Kwensiu/Pailer/commit/6c876852c8b004ec253bcec80df027994f53e3a0))
* remove global floating Update All button ([08e43a4](https://github.com/Kwensiu/Pailer/commit/08e43a4c2aba4c335a0fa2eebb892071f5edd629))
* render ANSI colors in CommandInput temporary output ([ce90b3b](https://github.com/Kwensiu/Pailer/commit/ce90b3bec5d107998b0aca180b2659c1043b4665))
* **ScoopStatusModal:** 将原有的内联应用问题列表逻辑提取为独立的 AppsWithIssuesTable 组件 [skip ci] ([a2d2063](https://github.com/Kwensiu/Pailer/commit/a2d2063d4bb272ca3e3ba4db2ce3ea8c015e692b))
* **search:** Add Bucket filter to SearchPage ([07bd189](https://github.com/Kwensiu/Pailer/commit/07bd1894b48bbef6f8d426994922de7a2c88cc0e))
* **search:** add cache prebuild setting ([303c9e6](https://github.com/Kwensiu/Pailer/commit/303c9e6ed9626c7242cd4d0ba8c59c0d229fee5c))
* **search:** add contentMenu to search page ([4650e8a](https://github.com/Kwensiu/Pailer/commit/4650e8a64f7457a76777ce5acb2d98b3c41e1ff7))
* **search:** add text highlighting and cache mechanism ([5b619c8](https://github.com/Kwensiu/Pailer/commit/5b619c84cec088f26789213896eb58ad18e32079))
* **search:** coordinate manifest cache refreshes ([44d8184](https://github.com/Kwensiu/Pailer/commit/44d818435f4f0a74a3a0e083d2ec84ff18bcc93b))
* **search:** 添加package更新时间字段 ([23892d4](https://github.com/Kwensiu/Pailer/commit/23892d40e02d5c4af414c5a2c74417bbf907ecf6))
* **search:** 添加搜索结果手动刷新功能 ([130e6a1](https://github.com/Kwensiu/Pailer/commit/130e6a11484069b756eae284e7899882128ac6a7))
* **self-update:** add Pailer self-update for Scoop installations ([#82](https://github.com/Kwensiu/Pailer/issues/82)) ([a03cc51](https://github.com/Kwensiu/Pailer/commit/a03cc518322fbcc5aebd35e69867e96387b8f750))
* **settings:** add command to get Scoop config directory ([46a7b5f](https://github.com/Kwensiu/Pailer/commit/46a7b5f993f275d9f788ee2f66bfa0a19dd8779f))
* **settings:** add Scoop self-update bypass option ([45dd5fa](https://github.com/Kwensiu/Pailer/commit/45dd5fa1185fc073cfb1ba15b7cb625754383ed4))
* **settings:** Adjust test builds and remove unused i18n keys ([d5135ac](https://github.com/Kwensiu/Pailer/commit/d5135ac93e3c1a5b7043d21ce0daf7fb2a94f713))
* **settings:** improve API key encryption with random nonces ([192830a](https://github.com/Kwensiu/Pailer/commit/192830af8f0c807e90508a32957eded73be98eb3))
* **settings:** improve PowerShell settings and diagnostic info ([7ae41d1](https://github.com/Kwensiu/Pailer/commit/7ae41d182eb08f482e9f0486752922328bdaa11e))
* **settings:** improve update check error handling ([24b924b](https://github.com/Kwensiu/Pailer/commit/24b924b2693dc888f8aee0b060cd0a1d6deea24c))
* **settings:** remove one of the scoop update functionality from about section ([44bc8ec](https://github.com/Kwensiu/Pailer/commit/44bc8ec23ddf0400fd0f4144eb196559b389f2ef))
* **settings:** 改进更新检查与错误处理机制 [skip ci] ([54918ca](https://github.com/Kwensiu/Pailer/commit/54918ca0530e155b46e6c4d5a70087a4952d9122))
* **settings:** 添加UI配置持久化保存 ([2be7e41](https://github.com/Kwensiu/Pailer/commit/2be7e41102d1ffc53d06037bb055287b4b55ad34))
* **settings:** 添加全局“更新全部”按钮的显示控制功能 [skip ci] ([f1b627a](https://github.com/Kwensiu/Pailer/commit/f1b627a33f60dbb86cf6c6b0f89ef4089c3f029f))
* **settings:** 添加应用程序数据管理功能 ([f92572f](https://github.com/Kwensiu/Pailer/commit/f92572f8676c17c71f08c0ea54c4a9a6fc31ce60))
* **settings:** 添加版本号前缀并优化更新提示 ([29eab02](https://github.com/Kwensiu/Pailer/commit/29eab0279d354c55adfe5fd02b0456539d6edfa7))
* **settings:** 解决了测试版检查更新失败问题 [skip ci] ([486b7f3](https://github.com/Kwensiu/Pailer/commit/486b7f3763d4d452c58231d88f0cbe212c5645cf))
* **settings:** 调整应用数据管理组件位置并优化界面布局 [skip ci] ([be847e5](https://github.com/Kwensiu/Pailer/commit/be847e5c8d8d137092de940e7f1003a2c8fb6da3))
* stabilize Windows startup identity with Scoop shim and fixed AUMID ([#124](https://github.com/Kwensiu/Pailer/issues/124)) ([beea204](https://github.com/Kwensiu/Pailer/commit/beea2042fd2e068e2dd33c3b0ffcad41dc43fb09))
* **storage:** 迁移应用数据至 Tauri Store 并重构数据清理 ([dc82303](https://github.com/Kwensiu/Pailer/commit/dc823032bc17a0514ae29c23040a468d091b26ef))
* switch view and settings tab persistence to localStorage ([f41a165](https://github.com/Kwensiu/Pailer/commit/f41a1656e8c19f90f264273d7b47fa57fe3eff92))
* **tauri:** add tray config migration for updates and self-update ([f0c5773](https://github.com/Kwensiu/Pailer/commit/f0c57731bbd263af4f47e1d3adf0fa0bafe75443))
* **theme:** add system theme and set as default ([bce848b](https://github.com/Kwensiu/Pailer/commit/bce848b5c797b0ba62353497aa67a531c0b49260))
* **ui:** enhance doctor and settings components ([ad019fa](https://github.com/Kwensiu/Pailer/commit/ad019fa3d035ac6610a8f345c8182db2e2bbde97))
* **ui:** expose tray config migration settings and status ([e6ea108](https://github.com/Kwensiu/Pailer/commit/e6ea108f41105ec9401516fd66757c4b9b12deab))
* **ui:** implement global modal stack management and focus trapping ([64ea4f9](https://github.com/Kwensiu/Pailer/commit/64ea4f972aec583c64b7558e29a02df11c500c06))
* unify store files and migrate legacy data ([a5ab3ba](https://github.com/Kwensiu/Pailer/commit/a5ab3ba30c6627506988b332d1cb2994a4789bc8))
* update AboutSection UI adn remove depercated elements ([fb323ff](https://github.com/Kwensiu/Pailer/commit/fb323ff65306470a2696fd2a318e0535e6a00bc1))
* update project branding and fix hook bugs ([050b8b0](https://github.com/Kwensiu/Pailer/commit/050b8b0df4bd645bbe5065be973d7f4dc87cc5f0))
* **update-log:** 添加更新日志功能并支持静默更新模式 ([6437024](https://github.com/Kwensiu/Pailer/commit/64370248a7a0daf7207401537802bbbb3bbf9073))
* **update:** add force update option and improve operation modal handling ([629423c](https://github.com/Kwensiu/Pailer/commit/629423cf53498f1146642c3e9ce875c14e415af0))
* **update:** Add test update channel support ([0ab2b2a](https://github.com/Kwensiu/Pailer/commit/0ab2b2abd200796eb820cb0411c0551636b5abae))
* **updates:** reflect running state in package actions ([b073f14](https://github.com/Kwensiu/Pailer/commit/b073f1436ca0d52e043aac276f17bfd8ae04474e))
* **update:** 添加测试更新命令和通道配置支持 ([0c9de2e](https://github.com/Kwensiu/Pailer/commit/0c9de2e680c7e6d2d3879cf6d5733384b3d5b6ab))
* 优化PackageInfo展示 ([205bc69](https://github.com/Kwensiu/Pailer/commit/205bc6974b8ebb418e8cb9dff86ac7c249c11cf4))


### Bug Fixes

* bucket-specific package info and manifest state ([#99](https://github.com/Kwensiu/Pailer/issues/99)) ([0b8fc97](https://github.com/Kwensiu/Pailer/commit/0b8fc977404c61d61a8713a46c6e1e47ae12994a))
* **bucket:** improve branch switching functions ([cf3b72b](https://github.com/Kwensiu/Pailer/commit/cf3b72bd33f5ce4b5ecf464b7c66d970195ce706))
* **bucket:** persist bulk update progress across navigation ([#136](https://github.com/Kwensiu/Pailer/issues/136)) ([07c039e](https://github.com/Kwensiu/Pailer/commit/07c039e661d5e71bdaa74d8bb153974d911b76bf))
* **build:** 修复版本号拼写错误 ([e0e835a](https://github.com/Kwensiu/Pailer/commit/e0e835aceee31520bcabab145f69ce20c711bf6a))
* cache clearing logic and improve internationalization ([da4f438](https://github.com/Kwensiu/Pailer/commit/da4f438a7983648de7266aa3073136d8a0ab1c96))
* change bucket modal state and bucket resolution ([#135](https://github.com/Kwensiu/Pailer/issues/135)) ([5fbd9b7](https://github.com/Kwensiu/Pailer/commit/5fbd9b7b00d09eef3ea0bd04ee25b95d4c098454))
* check local latest version for updates to avoid false positives ([8a31fe8](https://github.com/Kwensiu/Pailer/commit/8a31fe8be27d9bd98656f876bc554523450d9ee4))
* **ci:** align Tauri JS packages with Rust crate ([8b8aa66](https://github.com/Kwensiu/Pailer/commit/8b8aa66306f403acd566ceb48627817ecb599e46))
* clarify silent bucket auto update refresh ([15aa7b6](https://github.com/Kwensiu/Pailer/commit/15aa7b6a5060ddc10b979ed348a033d28ab56b82))
* clarify tray icon cleanup behavior ([cce71e4](https://github.com/Kwensiu/Pailer/commit/cce71e4dc863e44dcb4b4099bda67630a0c321e8))
* **cold-start:** 优化冷启动事件触发逻辑并减少重试次数 [skip ci] ([d7853a0](https://github.com/Kwensiu/Pailer/commit/d7853a07a17c3dcb7510e6ed4a562a6a4e408ee8))
* correct Scoop config path to use .config directory ([6fd2c72](https://github.com/Kwensiu/Pailer/commit/6fd2c7281ebf03a5a053485d498e48f1bcb08fbc))
* correct SHA256 hash formatting in fallback update ([51164c4](https://github.com/Kwensiu/Pailer/commit/51164c42d8134a64f067cfbbfb7326a0919bd379))
* **crypto:** update windows DPAPI function signatures ([c0e6502](https://github.com/Kwensiu/Pailer/commit/c0e65029a9df14670c2a67cb740e21056b7b8e24))
* **debug:** 优化应用数据清理与 WebView 缓存处理 ([c6604a1](https://github.com/Kwensiu/Pailer/commit/c6604a19c94f7fc47b4f2a9d45298263001a6eec))
* **dropdown:** use independent body class and allow marker ([2a6e02f](https://github.com/Kwensiu/Pailer/commit/2a6e02f8c968629e43cd6221b7518b0c7cc664e1))
* **encoding:** 修复 PowerShell 命令执行时的中文乱码问题 ([a07d0f5](https://github.com/Kwensiu/Pailer/commit/a07d0f50f248e9002a373cf1a643c1f72968714c))
* enhance session storage caching and update modal UI ([25ca893](https://github.com/Kwensiu/Pailer/commit/25ca893129383f5bb030d565aed3772eafec2e21))
* ensure OperationModal displays for cleanup commands ([d5ab12e](https://github.com/Kwensiu/Pailer/commit/d5ab12ec1ef73245333f6c277764f5e53eef9a55))
* **error-detection:** 增强错误检测逻辑以减少误报 ([257f8e0](https://github.com/Kwensiu/Pailer/commit/257f8e0f671f1478471a86e376c67db83efd2ac6))
* extract Scoop path settings module ([2305065](https://github.com/Kwensiu/Pailer/commit/23050655fd391fb717f3a55b638de589846e1df7))
* handle configured Scoop root ([d353d73](https://github.com/Kwensiu/Pailer/commit/d353d7324c2bf541a395a41372491dc77ff62459))
* harden tray self-update snapshot handling ([04c9a89](https://github.com/Kwensiu/Pailer/commit/04c9a894d5d76eae7385dddc9f63f4adb10f8b76))
* i18n support for tooltips and improve package operations ([a164f56](https://github.com/Kwensiu/Pailer/commit/a164f5605da00a34af3158ed95626ec391f4f983))
* **i18n:** fix language selection ([378ef96](https://github.com/Kwensiu/Pailer/commit/378ef96f3cb9fa20a16503229d7ba249d5ae95c1))
* **icons:** stabilize package icon cache ([372331d](https://github.com/Kwensiu/Pailer/commit/372331d3a94e84e62baaf7b0a7c6382f2514632d))
* improve self-update script restart logic ([0d0f888](https://github.com/Kwensiu/Pailer/commit/0d0f8880a684276fe3fa2ba7d0f85fde8cdc830e))
* improve startup registry cleanup and error handling ([03dcf97](https://github.com/Kwensiu/Pailer/commit/03dcf97506e097913684775e4807e2ce3d6cf1fe))
* improve state management, storage synchronization and i18n ([4183c19](https://github.com/Kwensiu/Pailer/commit/4183c1928a5d6f87ec2895607020ed61e50ea2b4))
* **installed-page:** add margin bottom to search container ([6febbff](https://github.com/Kwensiu/Pailer/commit/6febbffbd71a295e0f6bcd57840a0dd5a3406f41))
* **layout:** Adjust page layout and refine styling details ([d37ab95](https://github.com/Kwensiu/Pailer/commit/d37ab95bb72509b110976b9218562495080aab9a))
* **layout:** Optimize table and card layouts to prevent text overflow ([e0a82e0](https://github.com/Kwensiu/Pailer/commit/e0a82e0e441bc3f7bc5ec3f3e8d47a983be52d9a))
* minimized indicator UI and related issues ([60975ea](https://github.com/Kwensiu/Pailer/commit/60975ea38a167c01e2caef507ab51e8e9c43ef73))
* minor UI fixes and README update ([ff7cf69](https://github.com/Kwensiu/Pailer/commit/ff7cf696c9baddc701608dd60a5eb72b6d5c1e50))
* **modal:** implement intelligent scroll management for operation modals ([2860719](https://github.com/Kwensiu/Pailer/commit/2860719a0463e4575936833528e801e9f3edecf8))
* operation modal completion state and reduce ([a7cd2f0](https://github.com/Kwensiu/Pailer/commit/a7cd2f0ea4aa09bc0d3676f2cfecf70f8269802d))
* **OperationModal:** set z-index to z-60 ([d033af5](https://github.com/Kwensiu/Pailer/commit/d033af5c9d21cbdebc8b999a212cd523532233d2))
* **operations:** reset state before starting new package operations ([9b39ea3](https://github.com/Kwensiu/Pailer/commit/9b39ea3393df9a72a7ed924765169e57ffdd7764))
* optimize error handling and code cleanup for useInstalledPackages hook ([2f40b27](https://github.com/Kwensiu/Pailer/commit/2f40b27a7267c9e3bcc8d88887d3131e94e242b6))
* optimize workflows and i18n support ([5ff851d](https://github.com/Kwensiu/Pailer/commit/5ff851d4857875954eee69bcf12c87e93ec7d616))
* **package-info:** refine modal details and version actions ([f73985e](https://github.com/Kwensiu/Pailer/commit/f73985ed9ad5ceb2926d73c41ef4ab7894199c3e))
* **package-info:** sync package state after mutation events ([103e3ed](https://github.com/Kwensiu/Pailer/commit/103e3edd60e162dd9118386d7ed4c71ed53ae117))
* **package-info:** unify update flow and correct bucket modal install state ([d754105](https://github.com/Kwensiu/Pailer/commit/d75410592115843a6c74aced63eeb3a134bdbf03))
* PackageInfoModal version flicker and cloud icon logic ([eea3199](https://github.com/Kwensiu/Pailer/commit/eea31997c43c59b2b97ba9e470a5bb73571df74f))
* polish operation modal and tray interactions ([4bbc305](https://github.com/Kwensiu/Pailer/commit/4bbc305164bf25a5bd7fc1297ab1f0af55da5e06))
* potential crash in set_scoop_path if settings is not an object ([a5ab3ba](https://github.com/Kwensiu/Pailer/commit/a5ab3ba30c6627506988b332d1cb2994a4789bc8))
* **powershell:** prevent console window from appearing on Windows ([cf1b7ac](https://github.com/Kwensiu/Pailer/commit/cf1b7ac68fdd2abb335bf7dedeb8ef85aebca76e))
* **powershell:** prevent console window from appearing on Windows ([7354526](https://github.com/Kwensiu/Pailer/commit/7354526a9e46f3ba0bd3fec129377f8e930bbf7e))
* prevent dropdown menu clicks from triggering card onClick in package views ([905f3db](https://github.com/Kwensiu/Pailer/commit/905f3dbdc6775c1e798de8784addf61c2e632e53))
* prevent stale info refresh across pages ([8f09314](https://github.com/Kwensiu/Pailer/commit/8f09314b79f7c5c92ca293adf49f8cf1aff6f37b))
* **process:** use Windows API for process control ([c61b71a](https://github.com/Kwensiu/Pailer/commit/c61b71a4c3ed46a0cc811ea0664288a5db4b1e2f))
* re-add package notes and use effective theme for JSON details ([55b6bd5](https://github.com/Kwensiu/Pailer/commit/55b6bd569a95244958d506f7a93f235105e6e5f7))
* redundant migration calls in settings.rs (migration is now only in initStore) ([a5ab3ba](https://github.com/Kwensiu/Pailer/commit/a5ab3ba30c6627506988b332d1cb2994a4789bc8))
* refactor OperationModal and fix styling bugs ([b9127b6](https://github.com/Kwensiu/Pailer/commit/b9127b6987ea082882791575dc39dbdb58308f37))
* refine warning semantics and process retry ([570a2a3](https://github.com/Kwensiu/Pailer/commit/570a2a37d14b04e09e63e37cefea124dc0ea4ce2))
* remove PowerShell selector flicker ([ff1d5c4](https://github.com/Kwensiu/Pailer/commit/ff1d5c47d78bad7209b40538273d8cd93c6bb9d6))
* reset update status to 'idle' when no update is available ([077687e](https://github.com/Kwensiu/Pailer/commit/077687e34f816761a2b612c34fbb1bd676e5bc5c))
* resolve app close issue by moving cache cleanup ([5d45350](https://github.com/Kwensiu/Pailer/commit/5d45350264818e5f0bd4075bd3b9d0161042c51a))
* resolve critical issues from code review ([9b907fa](https://github.com/Kwensiu/Pailer/commit/9b907fabe7de15e2d789b8251f155936b8940cee))
* resolve loading state and type issues in useSearch hook ([e32368a](https://github.com/Kwensiu/Pailer/commit/e32368a5b78c8f561f2066de433ca08b2ad7eaaa))
* resolve manifest modal z-index layering issue ([66a61b3](https://github.com/Kwensiu/Pailer/commit/66a61b3b595d52748aa8a981c184d91c8ffa7bb4))
* resolve SolidJS cleanup warnings by wrapping signals in createRoot ([6e33863](https://github.com/Kwensiu/Pailer/commit/6e33863708377abd58030e84ba95bf47f1d0ff05))
* Respect default launch page setting on app restart ([fb53aa9](https://github.com/Kwensiu/Pailer/commit/fb53aa903f145937852bff20945ce3f7cc2d608f))
* Solving the issue of two operationmodals popping up during manual updates ([5d5366b](https://github.com/Kwensiu/Pailer/commit/5d5366b8d1a94b819a1bd8269d8276a09ec0617b))
* **tauri:** Change build target to NSIS, disable MSI generation ([7d4d5e6](https://github.com/Kwensiu/Pailer/commit/7d4d5e699e4078cd86018b17f963a59f1bf05d32))
* the shortcut toggle in settings cannot be hot-swapped ([0b7467d](https://github.com/Kwensiu/Pailer/commit/0b7467d58456dabcf7551dd82c8fd5a23b016331))
* **ui:** improve theme handling and consolidate doctor module translations ([f81225d](https://github.com/Kwensiu/Pailer/commit/f81225d696b0a11570aa45e3f6582c6b0664a270))
* **ui:** minor text corrections and icon updates ([66b5365](https://github.com/Kwensiu/Pailer/commit/66b5365acf3eb51e4ed7cb3cdf178bba93143ffb))
* update release workflow ([#15](https://github.com/Kwensiu/Pailer/issues/15)) ([87e5e4b](https://github.com/Kwensiu/Pailer/commit/87e5e4ba56a0be8654ffbc078a002a06b785d784))
* **update:** fix version display showing 'unknown' when update check fails ([0621b43](https://github.com/Kwensiu/Pailer/commit/0621b43be4b9d544f38440d93e13c471bf7f89b9))
* **updates:** refine Pailer self-update handling ([8f221f4](https://github.com/Kwensiu/Pailer/commit/8f221f4a9b68c0bf1fb9a31c196e691ce7841549))
* upgrade lucide-solid from 0.552.0 to 0.554.0 ([3272e43](https://github.com/Kwensiu/Pailer/commit/3272e435ce3b8bea2ddaead3e292d73fe58207ed))
* use detached cmd for scoop self-update ([#96](https://github.com/Kwensiu/Pailer/issues/96)) ([e491248](https://github.com/Kwensiu/Pailer/commit/e4912482f3208cae26b53e3a3e9da113459713ce))
* use semantic version comparison in auto cleanup ([59c0d0b](https://github.com/Kwensiu/Pailer/commit/59c0d0ba4b6e2df898605c5c6a6bf2eec2e1f3e6))
* versioning package unexpectedly held ([b1b4305](https://github.com/Kwensiu/Pailer/commit/b1b43052e436f6f043b24aae35368152868ca9aa))


### UI

* add markdown processing utility and GitHub-style CSS ([d896987](https://github.com/Kwensiu/Pailer/commit/d896987dc954fad73e29713395442a51f49b7d65))
* add minimized operations tray with cancellation UI ([82e3593](https://github.com/Kwensiu/Pailer/commit/82e3593d2a1afe72774fbcd3e23ba6ba55404d4f))
* add new BulkUpdateProgress to separate bucketPage responsibilities ([85cac66](https://github.com/Kwensiu/Pailer/commit/85cac66289eb6d1be9664c3476f372b10f6d1bb3))
* add OpenPathButton component ([80654b1](https://github.com/Kwensiu/Pailer/commit/80654b11d4192a306df016f0192246c341caf745))
* add ToastAlert.tsx component to replace some temporary prompts ([be47704](https://github.com/Kwensiu/Pailer/commit/be477048a3472efa06b547443e6637949a66d045))
* add version type filtering and improve dropdown UI consistency ([97fe627](https://github.com/Kwensiu/Pailer/commit/97fe6278836c9f0fd8436b9c8cff7c9e40fef631))
* adjust toast messages to show on top(999) ([97a4827](https://github.com/Kwensiu/Pailer/commit/97a4827800e6537425f5f1f706a1c82e0334a3a7))
* css improvements ([7e1ad12](https://github.com/Kwensiu/Pailer/commit/7e1ad125ae342c7ea9077caa640d0c1068ced242))
* Enhance PackageInfoModal with dropdown and force update ([80ae5bf](https://github.com/Kwensiu/Pailer/commit/80ae5bfdd6c66094b5818d3a1f4621ccd7d931be))
* fix incorrect ui in OperationModal and PackageInfoModal ([c81ae0a](https://github.com/Kwensiu/Pailer/commit/c81ae0a6c83d184752fe8933df282e324a87822b))
* improve change bucket modal ([4c6d4df](https://github.com/Kwensiu/Pailer/commit/4c6d4df3cb5f22adc70371c1d7f1ff8f3454d09b))
* improve UI adjustments and modal layering ([83cc69a](https://github.com/Kwensiu/Pailer/commit/83cc69a69e57f1d3e42b12a5400980a58ba38793))
* Redesign BucketInfoModal with enhanced interactions ([3b3e157](https://github.com/Kwensiu/Pailer/commit/3b3e157f11ff3a866a114fd885e7050af2e2b9ca))
* Refactor Dropdown component with reactive state management ([b5870d5](https://github.com/Kwensiu/Pailer/commit/b5870d5ef45c664f6c633f810b76fa44c083f74e))
* Update localization and modal rendering consistency ([2246275](https://github.com/Kwensiu/Pailer/commit/22462751d45df2e370ba3d8526087213eff7528c))
* update settings, styles, and localization ([48c2f41](https://github.com/Kwensiu/Pailer/commit/48c2f412ff518add3e78a6b34fd060f100ae952d))


### Performance

* **backend:** add operation cancellation support ([5f3212f](https://github.com/Kwensiu/Pailer/commit/5f3212fde19bebe5749af35d193615b7f44b3b3c))
* **buckets:** reuse bucket fetches and refresh cache ([28afb23](https://github.com/Kwensiu/Pailer/commit/28afb23e08a369f7b0e38508a178570436650c72))
* **cache:** harden storage cache lifecycle and refresh behavior ([35d6fb0](https://github.com/Kwensiu/Pailer/commit/35d6fb0dacda6c5fb068a743f2b792b756f89535))
* implement unified data preloading for improved startup performance ([9918b35](https://github.com/Kwensiu/Pailer/commit/9918b35c1da53a21eba3762a60e688d5378ba9f0))
* improve bucket install command ([0e08b1f](https://github.com/Kwensiu/Pailer/commit/0e08b1f4e171578aa6f92cea3ab3d2898ce491d5))
* **OperationModal.tsx:** 减少一次 requestAnimationFrame 调用层级 ([587ff20](https://github.com/Kwensiu/Pailer/commit/587ff2091ceaf9a89a80cdcbef7ea2c37528fb91))
* **operations:** add cancellation infrastructure and hooks ([ff5c2b6](https://github.com/Kwensiu/Pailer/commit/ff5c2b6fbf90450b0aaf904a5075b93c8437ac63))
* optimize session storage with anti-loop protection ([af654cf](https://github.com/Kwensiu/Pailer/commit/af654cfedecaa668d1b706b4a175dc4562010698))
* **utils:** avoid unnecessary shortcut name replacement ([4835608](https://github.com/Kwensiu/Pailer/commit/48356086c64db2cbbad07422b06a95aee18d562b))


### Styles

* **AppDataManagement:** 调整数据管理页面样式细节 ([99f97e5](https://github.com/Kwensiu/Pailer/commit/99f97e5b79c06ee59876a71592105c857d362587))
* enhance frontend styling and UI improvements ([7f07b2e](https://github.com/Kwensiu/Pailer/commit/7f07b2e94a4dc8b12537c1dbfc61866b4146b583))
* reorganize CSS files and refine component styles ([8373aa8](https://github.com/Kwensiu/Pailer/commit/8373aa89ae6bdd2eab34c1d237737eb68a629aab))
* **settings:** refine settings card layouts ([994c606](https://github.com/Kwensiu/Pailer/commit/994c606723d370ba0f95e52c774e10c470c1c574))


### Refactoring

* Adjust logging levels and wrap SolidJS stores in createRoot ([df4e779](https://github.com/Kwensiu/Pailer/commit/df4e779148aeb1550e750c233d504df07072a618))
* **AnimatedButton.tsx:** 使用 createMemo 优化按钮宽度计算逻辑 ([bdcb13a](https://github.com/Kwensiu/Pailer/commit/bdcb13a9b0149c3b28a3f8e02808f40fffb6d459))
* **App.tsx:** 限制调试日志仅在开发环境输出 ([70495a7](https://github.com/Kwensiu/Pailer/commit/70495a7d8e4f0baf5f8a21414faa412a32219938))
* **buckets:** centralize bucket preloading and improve state synchronization ([6812352](https://github.com/Kwensiu/Pailer/commit/6812352ddf0c35f72ed6635191c80a6304e72bb6))
* **bucket:** 重构桶更新状态管理和进度条展示 ([cf05b22](https://github.com/Kwensiu/Pailer/commit/cf05b22adc4d0bcfed61e180eb7fd6eb5db7d183))
* centralize cache refresh logic in operations store ([02f0607](https://github.com/Kwensiu/Pailer/commit/02f0607ac9cccf85d1c7876e862effe7b0de1417))
* centralize operation completion handling ([cf7fcd1](https://github.com/Kwensiu/Pailer/commit/cf7fcd1f8e435f7a3d096805b31519d96bbfdc70))
* **core:** rename createStoredSignal to createTauriSignal ([41bb48a](https://github.com/Kwensiu/Pailer/commit/41bb48ab55917eb6edd7aa80b980e0772a7c65e6))
* enhance auto cleanup and improve cache management UI ([#102](https://github.com/Kwensiu/Pailer/issues/102)) ([6b5cebe](https://github.com/Kwensiu/Pailer/commit/6b5cebe4885a4495b0937b226cbb8b8c6a8c0d62))
* enhance package operations and modal interactions ([8ab30a8](https://github.com/Kwensiu/Pailer/commit/8ab30a8ba8f40764989015d42424cdfa8388936d))
* extract command execution state to operations store ([34eaebf](https://github.com/Kwensiu/Pailer/commit/34eaebf207a4d95b0452e7c666f9263bf1df99db))
* file structure and imports ([4f77dd1](https://github.com/Kwensiu/Pailer/commit/4f77dd15a83c31c23fed85c74e8cfb916f9b2791))
* **header:** remove language selector component in header ([ffef53e](https://github.com/Kwensiu/Pailer/commit/ffef53e6911ca5058a3648d1f59a753a1a801943))
* **i18n:** enhance i18n feature ([ba39414](https://github.com/Kwensiu/Pailer/commit/ba39414e52339b5d8675726fc7efc7cd4eed7988))
* **i18n:** Optimizes the front-end and back-end i18n synchronization mechanism ([cd0cb2d](https://github.com/Kwensiu/Pailer/commit/cd0cb2d4d2e14fc21cbcec6e1f7a3a3dc830e4fa))
* implement AES encryption for VirusTotal API key storage ([aa29e0e](https://github.com/Kwensiu/Pailer/commit/aa29e0e7a0507851f883d9f897e8e424b88373a9))
* implement unified context menu architecture ([d584adf](https://github.com/Kwensiu/Pailer/commit/d584adf291ac98ccc14f87439ee4b150fde52c24))
* improve focus handling and collapsible card interactions ([#100](https://github.com/Kwensiu/Pailer/issues/100)) ([7c52995](https://github.com/Kwensiu/Pailer/commit/7c529957a4979b5f55eb31c1ebe0f530966a9423))
* improve operation modal lifecycle and status handling ([470a7de](https://github.com/Kwensiu/Pailer/commit/470a7dedc6d664ef03591343d64296a02c77adb9))
* **installed:** implement unified context menu system ([a5b1e72](https://github.com/Kwensiu/Pailer/commit/a5b1e72a71a78915f999d3cbfa2deeae39a1f0dc))
* **installed:** redesign package list with context menu ([de8047f](https://github.com/Kwensiu/Pailer/commit/de8047fd70b4ba620f7b8ff47ba37a872214b64f))
* **installed:** simplify scoop update flow ([5131901](https://github.com/Kwensiu/Pailer/commit/51319016faf622e9ed4314894641365ca3dd5f3e))
* **lib:** move background tasks to separate scheduler module to align with upstream ([4535c08](https://github.com/Kwensiu/Pailer/commit/4535c08a771c5c4a2c7ec5d941dacbcc205c28ba))
* **MinimizedIndicator.tsx:** 替换 createEffect 为 onMount/onCleanup 生命周期钩子 ([eb4e50b](https://github.com/Kwensiu/Pailer/commit/eb4e50b3238e27cb0b3d7bfc4730476db88d044a))
* **modal:** replace custom modals with reusable modal component ([c1e8788](https://github.com/Kwensiu/Pailer/commit/c1e8788de3e1fd59d57034eb0b1e331ae83a3a8d))
* **operations:** refine minimized tray stack ([c94f177](https://github.com/Kwensiu/Pailer/commit/c94f177f00ade6886164764d8729e27852a1b0dc))
* optimize installed packages page user experience ([fde1057](https://github.com/Kwensiu/Pailer/commit/fde1057aae800cb5c648e891d5bb871bb6505acc))
* persist Scoop config in localStorage to prevent doctor page flickering ([ce0a24d](https://github.com/Kwensiu/Pailer/commit/ce0a24dac30dbc50a556988d92cdceca02dbb4dd))
* **powershell:** refactor PowerShell output error detection for improved maintainability ([0429cdc](https://github.com/Kwensiu/Pailer/commit/0429cdce0f848f019a36afa09a10d1da3ef15a17))
* remove duplicate data fetching logic in ScoopInfo saveConfig ([ff54f29](https://github.com/Kwensiu/Pailer/commit/ff54f298ff0fbfbcc855725f041abed0d2694f19))
* remove update logging functionality ([131c411](https://github.com/Kwensiu/Pailer/commit/131c411a2fa3333825f838d62e06b863a0d29958))
* rename custom_update to fallback_update and fix critical issues ([7a54bb0](https://github.com/Kwensiu/Pailer/commit/7a54bb0719f63d8b864037cc0203fed7d6fdbb73))
* rename WindowBehaviorSettings to TraySettings and remove unused TrayAppsSettings ([2a271f1](https://github.com/Kwensiu/Pailer/commit/2a271f1b7fa3befdb50f226bb157ef42ef783540))
* restructure context menu system ([bdf884e](https://github.com/Kwensiu/Pailer/commit/bdf884ecec92335a2771b77aa38e73a1ea9585e5))
* **scoop:** simplify stale refresh bypass ([980b7fd](https://github.com/Kwensiu/Pailer/commit/980b7fd2eedb9cada3449d7e5dd409fa1a257970))
* **scroll:** enhance scroll management with terminal controls ([719e277](https://github.com/Kwensiu/Pailer/commit/719e277cf0bc0909e3c73a5414e6ee4ace4b5821))
* **search:** split page logic into focused hooks ([56c3ea6](https://github.com/Kwensiu/Pailer/commit/56c3ea6040cfdb86a089e39fc39575e882189dbd))
* **settings:** remove legacy store migration logic ([08def66](https://github.com/Kwensiu/Pailer/commit/08def66f2f541a6b0ceee2406053b5f6ce59b8c7))
* **settings:** replace theme toggle with dropdown selection ([7b7ff0a](https://github.com/Kwensiu/Pailer/commit/7b7ff0a50452971a4d03cb8ddf228f8816a4bd29))
* **settings:** 移除不必要的i18n回退显示 [skip ci] ([d30a628](https://github.com/Kwensiu/Pailer/commit/d30a6282eb796a1534ccd7a13b425e27ab331c40))
* simplify AboutSection update system ([b76314b](https://github.com/Kwensiu/Pailer/commit/b76314bea92b9002b81cc74936fca662925025f9))
* streamline installed packages hook with optimized caching ([5b20207](https://github.com/Kwensiu/Pailer/commit/5b202071a7d96a18ba500685cc9ad2a50cc66dbe))
* **tray:** improve app menu configuration ([d6902f8](https://github.com/Kwensiu/Pailer/commit/d6902f8f651a93f79c9692484c8cf7c75685d896))
* **types:** enhance data types and storage mechanisms ([5016a26](https://github.com/Kwensiu/Pailer/commit/5016a26c47cd19ef77f304f3f38a5229cefaeb3f))
* **ui:** improve modal handling and consolidate icons ([4e8f1dc](https://github.com/Kwensiu/Pailer/commit/4e8f1dcd43d24e6843f82aa9a0de9574d3de9e9d))
* **ui:** remove redundant package version delete confirm ([f3e9a2c](https://github.com/Kwensiu/Pailer/commit/f3e9a2cd04ae324789aed58d9368263c69fa9847))
* **ui:** split BucketInfoModal and PackageInfoModal into sub-components ([4eb68d3](https://github.com/Kwensiu/Pailer/commit/4eb68d34adc51baf3a47249aca45b3aa4bddbf23))
* unify bucket date formatting logic ([6d16919](https://github.com/Kwensiu/Pailer/commit/6d16919ff28d9b2c6d968a22b828750f036372a0))
* update logic to use centralized update store ([8ac5144](https://github.com/Kwensiu/Pailer/commit/8ac5144dc1b17d909b322bc36208b4b64f51f506))
* update scoop path detection logic and log output ([2131678](https://github.com/Kwensiu/Pailer/commit/2131678717242324fb27679bdb7cf14c98e6ce2b))
* update search logic, scoop bypass, tray stack ([#159](https://github.com/Kwensiu/Pailer/issues/159)) ([8ca2977](https://github.com/Kwensiu/Pailer/commit/8ca29771734c75799f8bee35e94801d56689fe63))
* update settings UI and add UpdateModal component ([873993f](https://github.com/Kwensiu/Pailer/commit/873993fc2c8b54df54d2d0e54345138dcc95b4fd))
* **update:** centralize package mutation refresh flow ([#155](https://github.com/Kwensiu/Pailer/issues/155)) ([e591ba4](https://github.com/Kwensiu/Pailer/commit/e591ba40222720fc1a73de2d392f6c4c7d442c88))
* 统一代码格式化并优化项目结构 [skip ci] ([97f637c](https://github.com/Kwensiu/Pailer/commit/97f637cfe90e0e7d03b3ce4571ddf7088b981ef5))


### Chores

* bump version to v1.0.0 ([98a989a](https://github.com/Kwensiu/Pailer/commit/98a989abf24b8c8c187a864373d16d3764de24f9))

## [1.17.2](https://github.com/Kwensiu/Pailer/compare/v1.17.1...v1.17.2) (2026-06-13)


### Features

* optimize bucket loading ([68f719b](https://github.com/Kwensiu/Pailer/commit/68f719b37c24705901f3de7949efd47ddc79f0e3))


### Bug Fixes

* refine warning semantics and process retry ([570a2a3](https://github.com/Kwensiu/Pailer/commit/570a2a37d14b04e09e63e37cefea124dc0ea4ce2))

## [1.17.1](https://github.com/Kwensiu/Pailer/compare/v1.17.0...v1.17.1) (2026-06-05)


### Bug Fixes

* clarify silent bucket auto update refresh ([15aa7b6](https://github.com/Kwensiu/Pailer/commit/15aa7b6a5060ddc10b979ed348a033d28ab56b82))
* extract Scoop path settings module ([2305065](https://github.com/Kwensiu/Pailer/commit/23050655fd391fb717f3a55b638de589846e1df7))
* handle configured Scoop root ([d353d73](https://github.com/Kwensiu/Pailer/commit/d353d7324c2bf541a395a41372491dc77ff62459))

## [1.17.0](https://github.com/Kwensiu/Pailer/compare/v1.16.1...v1.17.0) (2026-06-04)


### Features

* add global scoop operation queue mode ([42773c7](https://github.com/Kwensiu/Pailer/commit/42773c7db15945949141babe40594e8360699dcf))
* queue per-package update all operations ([eb98c19](https://github.com/Kwensiu/Pailer/commit/eb98c198950ca9e92be9d62eb1ad1cff43c74d5b))


### Bug Fixes

* **ci:** align Tauri JS packages with Rust crate ([8b8aa66](https://github.com/Kwensiu/Pailer/commit/8b8aa66306f403acd566ceb48627817ecb599e46))
* clarify tray icon cleanup behavior ([cce71e4](https://github.com/Kwensiu/Pailer/commit/cce71e4dc863e44dcb4b4099bda67630a0c321e8))
* polish operation modal and tray interactions ([4bbc305](https://github.com/Kwensiu/Pailer/commit/4bbc305164bf25a5bd7fc1297ab1f0af55da5e06))

## [1.16.1](https://github.com/Kwensiu/Pailer/compare/v1.16.0...v1.16.1) (2026-06-01)


### Refactoring

* centralize operation completion handling ([cf7fcd1](https://github.com/Kwensiu/Pailer/commit/cf7fcd1f8e435f7a3d096805b31519d96bbfdc70))
* **tray:** improve app menu configuration ([d6902f8](https://github.com/Kwensiu/Pailer/commit/d6902f8f651a93f79c9692484c8cf7c75685d896))

## [1.16.0](https://github.com/Kwensiu/Pailer/compare/v1.15.0...v1.16.0) (2026-05-31)


### Features

* **search:** coordinate manifest cache refreshes ([44d8184](https://github.com/Kwensiu/Pailer/commit/44d818435f4f0a74a3a0e083d2ec84ff18bcc93b))
* **updates:** reflect running state in package actions ([b073f14](https://github.com/Kwensiu/Pailer/commit/b073f1436ca0d52e043aac276f17bfd8ae04474e))


### Bug Fixes

* **icons:** stabilize package icon cache ([372331d](https://github.com/Kwensiu/Pailer/commit/372331d3a94e84e62baaf7b0a7c6382f2514632d))
* **updates:** refine Pailer self-update handling ([8f221f4](https://github.com/Kwensiu/Pailer/commit/8f221f4a9b68c0bf1fb9a31c196e691ce7841549))


### Performance

* **buckets:** reuse bucket fetches and refresh cache ([28afb23](https://github.com/Kwensiu/Pailer/commit/28afb23e08a369f7b0e38508a178570436650c72))


### Refactoring

* **operations:** refine minimized tray stack ([c94f177](https://github.com/Kwensiu/Pailer/commit/c94f177f00ade6886164764d8729e27852a1b0dc))
* **scoop:** simplify stale refresh bypass ([980b7fd](https://github.com/Kwensiu/Pailer/commit/980b7fd2eedb9cada3449d7e5dd409fa1a257970))
* **search:** split page logic into focused hooks ([56c3ea6](https://github.com/Kwensiu/Pailer/commit/56c3ea6040cfdb86a089e39fc39575e882189dbd))
* update search logic, scoop bypass, tray stack ([#159](https://github.com/Kwensiu/Pailer/issues/159)) ([8ca2977](https://github.com/Kwensiu/Pailer/commit/8ca29771734c75799f8bee35e94801d56689fe63))

## [1.15.0](https://github.com/Kwensiu/Pailer/compare/v1.14.1...v1.15.0) (2026-05-27)


### Features

* allow zero old versions in auto cleanup ([b8adf6c](https://github.com/Kwensiu/Pailer/commit/b8adf6ce72b4c252fb3338ad4cba6523369cd865))
* allow zero old versions in auto cleanup ([d8ada6a](https://github.com/Kwensiu/Pailer/commit/d8ada6a6b810c9127943b80b99b8f61a471a0749))


### Refactoring

* **update:** centralize package mutation refresh flow ([#155](https://github.com/Kwensiu/Pailer/issues/155)) ([e591ba4](https://github.com/Kwensiu/Pailer/commit/e591ba40222720fc1a73de2d392f6c4c7d442c88))

## [1.14.1](https://github.com/Kwensiu/Pailer/compare/v1.14.0...v1.14.1) (2026-04-10)


### Bug Fixes

* **bucket:** persist bulk update progress across navigation ([#136](https://github.com/Kwensiu/Pailer/issues/136)) ([07c039e](https://github.com/Kwensiu/Pailer/commit/07c039e661d5e71bdaa74d8bb153974d911b76bf))
* change bucket modal state and bucket resolution ([#135](https://github.com/Kwensiu/Pailer/issues/135)) ([5fbd9b7](https://github.com/Kwensiu/Pailer/commit/5fbd9b7b00d09eef3ea0bd04ee25b95d4c098454))
* operation modal completion state and reduce ([a7cd2f0](https://github.com/Kwensiu/Pailer/commit/a7cd2f0ea4aa09bc0d3676f2cfecf70f8269802d))

## [1.14.0](https://github.com/Kwensiu/Pailer/compare/v1.13.0...v1.14.0) (2026-04-07)


### Features

* **package-info:** add fast path for low-risk version switches ([5d59651](https://github.com/Kwensiu/Pailer/commit/5d59651e0c37ee8a1d556fdeb85da1959be2fe4d))
* **package-info:** add Run action with split entry selector in footer ([802d563](https://github.com/Kwensiu/Pailer/commit/802d563c41cd95ff526466cb5ce2b1217793628c))
* **tauri:** add tray config migration for updates and self-update ([f0c5773](https://github.com/Kwensiu/Pailer/commit/f0c57731bbd263af4f47e1d3adf0fa0bafe75443))
* **ui:** expose tray config migration settings and status ([e6ea108](https://github.com/Kwensiu/Pailer/commit/e6ea108f41105ec9401516fd66757c4b9b12deab))


### Bug Fixes

* harden tray self-update snapshot handling ([04c9a89](https://github.com/Kwensiu/Pailer/commit/04c9a894d5d76eae7385dddc9f63f4adb10f8b76))
* **package-info:** refine modal details and version actions ([f73985e](https://github.com/Kwensiu/Pailer/commit/f73985ed9ad5ceb2926d73c41ef4ab7894199c3e))
* **package-info:** sync package state after mutation events ([103e3ed](https://github.com/Kwensiu/Pailer/commit/103e3edd60e162dd9118386d7ed4c71ed53ae117))
* prevent stale info refresh across pages ([8f09314](https://github.com/Kwensiu/Pailer/commit/8f09314b79f7c5c92ca293adf49f8cf1aff6f37b))


### Refactoring

* **ui:** remove redundant package version delete confirm ([f3e9a2c](https://github.com/Kwensiu/Pailer/commit/f3e9a2cd04ae324789aed58d9368263c69fa9847))

## [1.13.0](https://github.com/Kwensiu/Pailer/compare/v1.12.0...v1.13.0) (2026-04-05)


### Features

* stabilize Windows startup identity with Scoop shim and fixed AUMID ([#124](https://github.com/Kwensiu/Pailer/issues/124)) ([beea204](https://github.com/Kwensiu/Pailer/commit/beea2042fd2e068e2dd33c3b0ffcad41dc43fb09))

## [1.12.0](https://github.com/Kwensiu/Pailer/compare/v1.11.1...v1.12.0) (2026-04-05)


### Features

* add administrator privilege retry support for package operations ([8de04dc](https://github.com/Kwensiu/Pailer/commit/8de04dc655620d14b932954c14b941e3a3a84dfb))
* add notify icon settings dedupe commands and doctor UI ([59300de](https://github.com/Kwensiu/Pailer/commit/59300de64052a49396e6eb0e51cb6349165ed270))
* add robust tray config migration with snapshot sync and safer dedupe ([bc38596](https://github.com/Kwensiu/Pailer/commit/bc385962db2706c75237c191cc674ca30bf4f7de))


### Bug Fixes

* improve self-update script restart logic ([0d0f888](https://github.com/Kwensiu/Pailer/commit/0d0f8880a684276fe3fa2ba7d0f85fde8cdc830e))
* PackageInfoModal version flicker and cloud icon logic ([eea3199](https://github.com/Kwensiu/Pailer/commit/eea31997c43c59b2b97ba9e470a5bb73571df74f))

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
