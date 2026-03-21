# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/Kwensiu/Pailer/compare/v1.6.0...v1.0.0) (2026-03-21)


### ⚠ BREAKING CHANGES

* **core:** The createStoredSignal hook has been renamed to createTauriSignal. Update all imports and references accordingly.
* **lib:** Background task functionality moved to separate module

### Features

* add ANSI color support and warning detection for operations ([7e2ff02](https://github.com/Kwensiu/Pailer/commit/7e2ff025d1331b723be69a4288f839e90f8d07d6))
* add auto-detect functionality for Scoop installation path ([9c93128](https://github.com/Kwensiu/Pailer/commit/9c9312838e710187388e1982c73495c87e0b7bfa))
* add automatic update functionality to AboutSection ([c819328](https://github.com/Kwensiu/Pailer/commit/c81932824f35bd34869938861d5d354cf3159e9c))
* add branch switching support for git buckets ([8809cab](https://github.com/Kwensiu/Pailer/commit/8809cab1218693ebf5b07fa9ce40255d37657064))
* add change package bucket functionality. ([adb048d](https://github.com/Kwensiu/Pailer/commit/adb048d8011df0355f86b8c4fcb8a531fdaafad8))
* Add CI version warnings in package update tooltips ([144c45d](https://github.com/Kwensiu/Pailer/commit/144c45d3a16789cd2280cc9e47b45015f18f350b))
* add clickable update icon for package updates in PackageGridView and PackageListView ([fad3327](https://github.com/Kwensiu/Pailer/commit/fad3327094a560d30e579c4e379f991fff73c2ec))
* add GitHub Actions workflow for test builds ([4907711](https://github.com/Kwensiu/Pailer/commit/49077112bca26ec43cd8cb481aea4b715ec90ac9))
* add global hotkey to focus search bar on search page ([1f2ab4f](https://github.com/Kwensiu/Pailer/commit/1f2ab4fd03f929e9dd00e227175ac69373bf8084))
* add Google site verification HTML file ([9fcccf8](https://github.com/Kwensiu/Pailer/commit/9fcccf88709104598165d1e61185af62cf4342f4))
* add hotkey settings toggle ([517f0d7](https://github.com/Kwensiu/Pailer/commit/517f0d7b5b31e7ac6b4c1f015efeb0c191588661))
* add loading indicators for bucket fetching and enhance bucket management ([0b5d294](https://github.com/Kwensiu/Pailer/commit/0b5d294b0fe04497e18a15de3b91186c5180f882))
* add make all command for streamlined development workflow ([483a393](https://github.com/Kwensiu/Pailer/commit/483a39349276372679998b6cdb9e0e213b4a44c3))
* add NSIS installer locale path support and refactor variable naming in i18n.rs ([bba3970](https://github.com/Kwensiu/Pailer/commit/bba3970daf015a02dc90ef41042e0f15ed8086c4))
* add operation management system with minimized indicators and multi-instance warning ([fe2abe1](https://github.com/Kwensiu/Pailer/commit/fe2abe1c2ef6cec20484bf2e63cab9c8070ce1da))
* add proxy settings management for Scoop. ([5d3f25b](https://github.com/Kwensiu/Pailer/commit/5d3f25bd96d1ef9cf5bd6ba99a27b380cbd0ca3f))
* add refresh functionality to InstalledPageHeader. Merge view button ([056b4e8](https://github.com/Kwensiu/Pailer/commit/056b4e8bff100ef7d61b4b5d6dd09ecd99c4d922))
* add refresh functionality to InstalledPageHeader. Merge view button ([4f9974a](https://github.com/Kwensiu/Pailer/commit/4f9974aa2e7064af88698d43b15f2266cbb3596e))
* add release-please and change workflow to tauri-action@v0 ([#18](https://github.com/Kwensiu/Pailer/issues/18)) ([ae0fe90](https://github.com/Kwensiu/Pailer/commit/ae0fe90bb0f1d7ebc706c96210e17e2213cd762f))
* add Scoop path configuration wizard ([#79](https://github.com/Kwensiu/Pailer/issues/79)) ([901cef1](https://github.com/Kwensiu/Pailer/commit/901cef193b270f285cbbd114369fe689d058b057))
* add session bypass for MSI CWD-mismatch modal and MSI state logging for dev sessions ([20f8031](https://github.com/Kwensiu/Pailer/commit/20f803155c3027c1c772109433fedf48a5582757))
* Add session storage caching for PowerShell executable detection ([#30](https://github.com/Kwensiu/Pailer/issues/30)) ([46d8b17](https://github.com/Kwensiu/Pailer/commit/46d8b17b5fa3ba9fa2a34ebb0a376f48ad00a753))
* add settings management with default launch page ([f6c4efa](https://github.com/Kwensiu/Pailer/commit/f6c4efa3370d534b99f2a3b0c961b692c084815c))
* Add silent refresh to some components ([48d9c26](https://github.com/Kwensiu/Pailer/commit/48d9c26e23866a6cc28e24e3c36ad936d4a3e3a8))
* add silent startup option integrated into startup settings ([6690ab6](https://github.com/Kwensiu/Pailer/commit/6690ab63d41cb7bef60e3e164da286fff94bf0f8))
* add startup settings management for application auto-start on Windows ([3db6b8f](https://github.com/Kwensiu/Pailer/commit/3db6b8f15d4f79e0c2f355a11d3c7bc052ff252d))
* add update all bottom ([4870f63](https://github.com/Kwensiu/Pailer/commit/4870f633b99469feab1f87b6de9a2fba7a1c0e71))
* add updateBucketsCache function to manage bucket cache updates ([1d24b28](https://github.com/Kwensiu/Pailer/commit/1d24b2851924561c4d87ff407c22c027ac6cccf7))
* add versioned apps management and enhance cache handling ([71f13ed](https://github.com/Kwensiu/Pailer/commit/71f13ed9b2c186dba8a9e2553891d58cd8373fd8))
* add versioned packages store for efficient version management ([bb7dbc4](https://github.com/Kwensiu/Pailer/commit/bb7dbc4ebea7d63803547bfbb2d39a160d393c41))
* add Windows DPAPI encryption module, fix wrong name(scoopmeta) and UI ([#9](https://github.com/Kwensiu/Pailer/issues/9)) ([c12014d](https://github.com/Kwensiu/Pailer/commit/c12014dc1fe0985a0f1468a2c66aa3fc8ddc9a9a))
* added check for updates section in the about component in settings ([c991a94](https://github.com/Kwensiu/Pailer/commit/c991a946c4803ef338f3f41f6f48d6d5b6e9b215))
* added modal reusable and refactored all modals for theme consistency ([0baeac1](https://github.com/Kwensiu/Pailer/commit/0baeac181d362142259553ed5344277b4574468d))
* **backend:** enhance package management commands ([bedbe3b](https://github.com/Kwensiu/Pailer/commit/bedbe3b8848c1d00cfc628b705de384f35358cda))
* **bucket-search:** Remove extended search info API and implement frontend hard-coded solution ([c4d271c](https://github.com/Kwensiu/Pailer/commit/c4d271c5aac224f476cb3d84db0a8499bfb43b35))
* **bucket:** 优化 bucket 更新逻辑并增强日志记录 ([25c6d18](https://github.com/Kwensiu/Pailer/commit/25c6d18da5600eb795235f5798c02fe62047f23e))
* **bucket:** 重构 bucket 安装逻辑并增强 Scoop 路径管理 ([8d1580f](https://github.com/Kwensiu/Pailer/commit/8d1580f9a675aaa190c14a99c8357ec25f3a8767))
* **Card:** add conditionalContent prop with dynamic height animation and accessibility improvements ([8191e98](https://github.com/Kwensiu/Pailer/commit/8191e98e6905e77cacf20f44d37a921c2079c5d6))
* **components:** 替换 CheckCircle 图标为 CircleCheckBig [skip ci] ([8b66f4e](https://github.com/Kwensiu/Pailer/commit/8b66f4e4627071235119afb896d0d6f005b9b7a2))
* **config:** add dependabot configuration for automated dependency updates ([e498e4d](https://github.com/Kwensiu/Pailer/commit/e498e4dbe68a84a2d90c72caefd953bb1820ab7c))
* configure NSIS installer for user-level installation with custom template and localization ([92932c5](https://github.com/Kwensiu/Pailer/commit/92932c5496366f5b283351a1a1892eb2108ae844))
* continue refactoring and enhancing i18n ([f8bdc7c](https://github.com/Kwensiu/Pailer/commit/f8bdc7c7fab97b33c774ff9d74c7f221cd833530))
* **core:** Refactor state management and commands ([ff37fb0](https://github.com/Kwensiu/Pailer/commit/ff37fb08e29ae642d507a4ff8245fd4118e685b7))
* **core:** update app logic and page components ([0e08235](https://github.com/Kwensiu/Pailer/commit/0e082356a8d16ab7a21d49dc7a83d419f5896f35))
* **core:** update backend utilities and configuration ([1d42ad6](https://github.com/Kwensiu/Pailer/commit/1d42ad6c93c505bdd5f0c62c1734d5cbc0f3b688))
* **custom-update:** 实现自定义更新检查与安装功能（实验） ([b72d82b](https://github.com/Kwensiu/Pailer/commit/b72d82b597e9ed001969b869e7eef147179cd5bc))
* **DebugModal:** 优化调试模态框性能并改进日志处理 [skip ci] ([f247d21](https://github.com/Kwensiu/Pailer/commit/f247d2123f68a99f2b8bf416282f4a2d4371bd8c))
* **debug:** 实现增强的应用数据清理与重置功能 [skip ci] ([fa96d16](https://github.com/Kwensiu/Pailer/commit/fa96d16280ec9ba9f68c5527f763d9dc276ce7bf))
* **debug:** 支持读取新旧目录的日志文件 ([c9ecd70](https://github.com/Kwensiu/Pailer/commit/c9ecd708302ecaa9008ba5afa7a959effbcfa965))
* **doctor:** Add CommandInputField component to Doctor page, enabling direct execution of Scoop and PowerShell commands in the UI with real-time output display and quick action prompts ([e172254](https://github.com/Kwensiu/Pailer/commit/e17225442e7e1095d7f42b48a17846f00941bc6f))
* **doctor:** Enhance Doctor page functionality ([cfe31e4](https://github.com/Kwensiu/Pailer/commit/cfe31e425560d590a371494e7fcd8e9916a02363))
* **doctor:** enhance health check with i18n suggestions and UI improvements & fixes ([8991b49](https://github.com/Kwensiu/Pailer/commit/8991b499f4e3ea213dbf85598d24f8026180823f))
* **doctor:** 为Doctor页面新增 CommandInputField 组件，支持直接在 UI 中运行 Scoop 和 PowerShell 命令，提供实时输出展示及快捷操作提示 ([e172254](https://github.com/Kwensiu/Pailer/commit/e17225442e7e1095d7f42b48a17846f00941bc6f))
* documentation page ([52099db](https://github.com/Kwensiu/Pailer/commit/52099dbb4b7e6d007c0c8a6e190b904cbb48c8f7))
* DRY, Consolidated repeating settings sections into common ([104f421](https://github.com/Kwensiu/Pailer/commit/104f421d04d8857781b6f327b679ed19415ab23d))
* enhance auto-update settings UI and localization ([908c156](https://github.com/Kwensiu/Pailer/commit/908c156c4a032ba0c5ef2d911803decad4c0ca51))
* enhance bucket fetching with force refresh capability ([0333340](https://github.com/Kwensiu/Pailer/commit/0333340453ecfe59fa2722fc87e782eaea395300))
* enhance bucket management with cache refresh and loading indicators ([d7e083d](https://github.com/Kwensiu/Pailer/commit/d7e083d41cd3ad5b73f94fbfc6d499bc4b12fae8))
* enhance bucket page functionality and modal layering ([df57830](https://github.com/Kwensiu/Pailer/commit/df578305e0a9e571d2758e63cdb9cd0c3cd888e0))
* enhance BucketInfoModal and BucketCard with new icons and clickable links; update useBuckets and useSearch for improved type handling ([b1a39a4](https://github.com/Kwensiu/Pailer/commit/b1a39a4caea332813646aa97ac8822c4a255aeee))
* enhance BucketInfoModal with improved functionality ([82164ab](https://github.com/Kwensiu/Pailer/commit/82164ab4faffcca4e42cc823913828bfd067fa11))
* enhance cache cleanup and factory reset functionality ([3111f88](https://github.com/Kwensiu/Pailer/commit/3111f88ff6d95daf7e4414f1fa23773166e9f302))
* enhance frontend features and components ([b16f849](https://github.com/Kwensiu/Pailer/commit/b16f8492540744a28430c7f5a9b3a71482ff44de))
* enhance hooks with improved type handling and additional functionality; refactor useSearch to integrate package info and operations ([75f1223](https://github.com/Kwensiu/Pailer/commit/75f12239af58e4fc7f30ba9f8a3656d85d335e15))
* enhance modal animations and theming, adjust z-index ([b5935e1](https://github.com/Kwensiu/Pailer/commit/b5935e10ed463a4aee8b001ae6c29f3f8bcbe47f))
* enhance package grid UI and reorganize localization ([6717487](https://github.com/Kwensiu/Pailer/commit/6717487417db152c7e60c61828e5c88a2b252f85))
* enhance Scoop configuration detection and installed packages management ([#13](https://github.com/Kwensiu/Pailer/issues/13)) ([f45d2b7](https://github.com/Kwensiu/Pailer/commit/f45d2b7d57843fa3ae6210997dec8355ce7a387f))
* enhance search bar with expandable UI, global shortcuts, and session persistence ([a2ce18c](https://github.com/Kwensiu/Pailer/commit/a2ce18c0c3d471201743da780bffc3ff82b37e62))
* Enhance UI components and functionality ([e7c5127](https://github.com/Kwensiu/Pailer/commit/e7c512749bafaf12a8d3dd47c2e6f21db8387f7f))
* enhance UI styling and refactor components ([c3e94c5](https://github.com/Kwensiu/Pailer/commit/c3e94c5b600d57058739871e3282e881a9095cb7))
* enhance version manager with cache-aware mounting ([6921943](https://github.com/Kwensiu/Pailer/commit/692194355b685e598f619497e858b884469a87fd))
* Enhance Windows installer with environment refresh capability ([caf8154](https://github.com/Kwensiu/Pailer/commit/caf8154139c86652e8abeeaa14fdbbdbc9f1bef2))
* fixed up installed page logic, added Check Status button (alerts for package updates, bucket updates), enabled support for versioned installs (detects versioned installs from install.json missing bucket field) ([9da88da](https://github.com/Kwensiu/Pailer/commit/9da88daaa907c734eb9d293b7e7ece6819d638f9))
* full bucket support (install, remove, browse, expanded buckets) ([0fec390](https://github.com/Kwensiu/Pailer/commit/0fec390a769eb7815b19af75e9a375c345c9c825))
* full versioned installs support ([7a8f356](https://github.com/Kwensiu/Pailer/commit/7a8f3564b4c8f7fc8d22d8ec1b547633111cca21))
* **hooks:** optimize data management and state handling ([8861e1f](https://github.com/Kwensiu/Pailer/commit/8861e1f52bc3d3102bde7130c16e50fe3240a41d))
* **i18n:** Add i18n support for application update notifications ([09f3162](https://github.com/Kwensiu/Pailer/commit/09f3162b6ede882db1eebb70c086ad0053115ebf))
* **i18n:** Implement internationalization support and component updates ([991c920](https://github.com/Kwensiu/Pailer/commit/991c920bc559b05efc6ab441bc00322491d5d2cf))
* **i18n:** Optimize language initialization logic and prevent memory leaks ([faddc67](https://github.com/Kwensiu/Pailer/commit/faddc676ec546570ff2117bd17f77abe46048924))
* **i18n:** update type definitions and translations ([b9e5230](https://github.com/Kwensiu/Pailer/commit/b9e5230ab59ed87fd9594922898e285ff47118b3))
* **i18n:** 为 Scoop 状态模态框添加国际化支持 [skip ci] ([fe403bd](https://github.com/Kwensiu/Pailer/commit/fe403bdf2aa6ac6972412a26bf2f2e51c719a0d9))
* **icon:** change to new app icon of Pailer ([3b7bc25](https://github.com/Kwensiu/Pailer/commit/3b7bc2556db2b62618bbb4397cc4bc38ed077659))
* implement advanced search functionality with bucket filtering and global hotkeys ([0184edc](https://github.com/Kwensiu/Pailer/commit/0184edc54cd85e9b3c9a8142294de2091b2dc326))
* implement auto-cleanup feature for settings page ([e53014e](https://github.com/Kwensiu/Pailer/commit/e53014e192836bb026546825cc8629984390990b))
* implement bucket installation functionality and improve UI components ([f053e4b](https://github.com/Kwensiu/Pailer/commit/f053e4baca4d1181bf779fce0f8763d953ceddd4))
* implement error detection and improve operation modals ([b283803](https://github.com/Kwensiu/Pailer/commit/b2838036949356e4d3a406edec8a8180a155cb86))
* implement internationalization support ([04205ce](https://github.com/Kwensiu/Pailer/commit/04205ce663cdb15fd80e0eda40ac87e2c8508071))
* implement Scoop installation detection and update handling ([71cd39f](https://github.com/Kwensiu/Pailer/commit/71cd39fc32a7fef97897e7965cdc5c2d394f87b4))
* implement tray support with a Scoop Apps launcher, see issue https://github.com/AmarBego/Rscoop/issues/1 ([b5369f4](https://github.com/Kwensiu/Pailer/commit/b5369f41cd7d74664ee54a7ccfdd7e71b89c6871))
* **info:** 优化包信息获取逻辑以支持已安装包的 bucket 识别 ([9217a1b](https://github.com/Kwensiu/Pailer/commit/9217a1b3ea313e89f7e6211dbcffa138a6988833))
* **installed-packages:** Update icon components and optimize list view styles ([b8714ac](https://github.com/Kwensiu/Pailer/commit/b8714acc5b155d9c0a6ab2114e597b55a9b4a9a6))
* **installed:** autofocus search input on open ([c4a5ac6](https://github.com/Kwensiu/Pailer/commit/c4a5ac633f5a76515e4c53d9dc6ad9b112d8cb63))
* **InstalledPage:** 每次进入Packages页面时执行静默刷新（实验） ([54a6d5d](https://github.com/Kwensiu/Pailer/commit/54a6d5dc811f6be49777ffe311fa67c766a55d12))
* **installed:** Support search keyword persistence ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* internationalize sidebar navigation and fix button key typo ([cf2cae3](https://github.com/Kwensiu/Pailer/commit/cf2cae3f602b9a15dafa4e5b4745a296194dda74))
* invalidate caches after deleting app version to prevent stale data ([b3f34bf](https://github.com/Kwensiu/Pailer/commit/b3f34bf551a7cd6cc8c038e97672aeacee0078ff))
* major backend core functionality updates ([edc4d1e](https://github.com/Kwensiu/Pailer/commit/edc4d1eb761d2154dd75a96dc632aac3f892fec0))
* migrating doctor page to Card reusable ([c89ae93](https://github.com/Kwensiu/Pailer/commit/c89ae937756f3bd3be053c55680abcc7ed44ceb3))
* **modal:** ensure clean state for new operations ([a33ddd1](https://github.com/Kwensiu/Pailer/commit/a33ddd18620c0197138298622d1daa060c79266f))
* notes ([aaf037a](https://github.com/Kwensiu/Pailer/commit/aaf037acaf9ebecb0d05dd88bed3a6320bb3cd4e))
* **OperationModal:** Optimize scroll behavior to auto-scroll only when user approaches bottom ([bf48e56](https://github.com/Kwensiu/Pailer/commit/bf48e56de20a6cdf680d3170853682f5e48e6cae))
* **pages:** enhance main application pages ([be7570d](https://github.com/Kwensiu/Pailer/commit/be7570d5f5cf4d93601ee6f5c533415423ea3260))
* **powershell:** add PowerShell executable selection and management ([f9d4be2](https://github.com/Kwensiu/Pailer/commit/f9d4be28d72139d46689fbde1d04627caee088d6))
* refactor bucket path handling to use state scoop path and simplify directory retrieval ([0d08ee6](https://github.com/Kwensiu/Pailer/commit/0d08ee60aeb013e970c91eac3f16e1b3584ab008))
* refactor system tray with customizable shortcuts and i18n support ([3e200bb](https://github.com/Kwensiu/Pailer/commit/3e200bb04ca391854ebe49ecd7b7ad14df281f58))
* **release:** bump version to 1.4.7 with i18n integration and UI enhancements ([63fdf0c](https://github.com/Kwensiu/Pailer/commit/63fdf0cddd86d4f58851d664d944c3c3eb0a8c2b))
* **release:** 更新版本号至1.5.0，同时更新版本发布流程并完善 Release Notes ([4f53f72](https://github.com/Kwensiu/Pailer/commit/4f53f7231d89a4b65082233b0ca0856a87b28b7b))
* **release:** 更新版本号至1.5.0，同时更新版本发布流程并完善 Release Notes ([60bfe5d](https://github.com/Kwensiu/Pailer/commit/60bfe5dd21a36e9be8149a43bf8be0b9d2e17c9c))
* **release:** 调整 Release 工作流 ([6c87685](https://github.com/Kwensiu/Pailer/commit/6c876852c8b004ec253bcec80df027994f53e3a0))
* remove global floating Update All button ([08e43a4](https://github.com/Kwensiu/Pailer/commit/08e43a4c2aba4c335a0fa2eebb892071f5edd629))
* render ANSI colors in CommandInput temporary output ([ce90b3b](https://github.com/Kwensiu/Pailer/commit/ce90b3bec5d107998b0aca180b2659c1043b4665))
* **ScoopStatusModal:** 将原有的内联应用问题列表逻辑提取为独立的 AppsWithIssuesTable 组件 [skip ci] ([a2d2063](https://github.com/Kwensiu/Pailer/commit/a2d2063d4bb272ca3e3ba4db2ce3ea8c015e692b))
* **search:** Add Bucket filter to SearchPage ([07bd189](https://github.com/Kwensiu/Pailer/commit/07bd1894b48bbef6f8d426994922de7a2c88cc0e))
* **search:** add text highlighting and cache mechanism ([5b619c8](https://github.com/Kwensiu/Pailer/commit/5b619c84cec088f26789213896eb58ad18e32079))
* **SearchBar:** Add callback for search bar clear button ([2477de2](https://github.com/Kwensiu/Pailer/commit/2477de2990d42b9d29725e3d61aa8cfb6caa826f))
* **search:** 添加package更新时间字段 ([23892d4](https://github.com/Kwensiu/Pailer/commit/23892d40e02d5c4af414c5a2c74417bbf907ecf6))
* **search:** 添加搜索结果手动刷新功能 ([130e6a1](https://github.com/Kwensiu/Pailer/commit/130e6a11484069b756eae284e7899882128ac6a7))
* **self-update:** add Pailer self-update for Scoop installations ([#82](https://github.com/Kwensiu/Pailer/issues/82)) ([a03cc51](https://github.com/Kwensiu/Pailer/commit/a03cc518322fbcc5aebd35e69867e96387b8f750))
* **settings:** add command to get Scoop config directory ([46a7b5f](https://github.com/Kwensiu/Pailer/commit/46a7b5f993f275d9f788ee2f66bfa0a19dd8779f))
* **settings:** Add Scoop configuration editing functionality ([356c5af](https://github.com/Kwensiu/Pailer/commit/356c5af8d763ace9ef05d298e5690d2d10fe22ac))
* **settings:** Adjust test builds and remove unused i18n keys ([d5135ac](https://github.com/Kwensiu/Pailer/commit/d5135ac93e3c1a5b7043d21ce0daf7fb2a94f713))
* **settings:** Attempted to fix a critical bug related to Bucket retrieval ([9048829](https://github.com/Kwensiu/Pailer/commit/904882987d7c62d3c1815644a76f5d3a9542faad))
* **settings:** Categorize settings and enhance user experience ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* **settings:** improve API key encryption with random nonces ([192830a](https://github.com/Kwensiu/Pailer/commit/192830af8f0c807e90508a32957eded73be98eb3))
* **settings:** improve PowerShell settings and diagnostic info ([7ae41d1](https://github.com/Kwensiu/Pailer/commit/7ae41d182eb08f482e9f0486752922328bdaa11e))
* **settings:** improve update check error handling ([24b924b](https://github.com/Kwensiu/Pailer/commit/24b924b2693dc888f8aee0b060cd0a1d6deea24c))
* **settings:** Refine About page content for clearer fork's information ([a93e2d2](https://github.com/Kwensiu/Pailer/commit/a93e2d2b3df9db5712205e370dbdc632d21ceac9))
* **settings:** remove one of the scoop update functionality from about section ([44bc8ec](https://github.com/Kwensiu/Pailer/commit/44bc8ec23ddf0400fd0f4144eb196559b389f2ef))
* **settings:** 改进更新检查与错误处理机制 [skip ci] ([54918ca](https://github.com/Kwensiu/Pailer/commit/54918ca0530e155b46e6c4d5a70087a4952d9122))
* **settings:** 新增获取 Scoop 配置及执行任意命令接口 ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* **settings:** 添加UI配置持久化保存 ([2be7e41](https://github.com/Kwensiu/Pailer/commit/2be7e41102d1ffc53d06037bb055287b4b55ad34))
* **settings:** 添加全局“更新全部”按钮的显示控制功能 [skip ci] ([f1b627a](https://github.com/Kwensiu/Pailer/commit/f1b627a33f60dbb86cf6c6b0f89ef4089c3f029f))
* **settings:** 添加应用程序数据管理功能 ([f92572f](https://github.com/Kwensiu/Pailer/commit/f92572f8676c17c71f08c0ea54c4a9a6fc31ce60))
* **settings:** 添加版本号前缀并优化更新提示 ([29eab02](https://github.com/Kwensiu/Pailer/commit/29eab0279d354c55adfe5fd02b0456539d6edfa7))
* **settings:** 解决了测试版检查更新失败问题 [skip ci] ([486b7f3](https://github.com/Kwensiu/Pailer/commit/486b7f3763d4d452c58231d88f0cbe212c5645cf))
* **settings:** 调整应用数据管理组件位置并优化界面布局 [skip ci] ([be847e5](https://github.com/Kwensiu/Pailer/commit/be847e5c8d8d137092de940e7f1003a2c8fb6da3))
* **storage:** 迁移应用数据至 Tauri Store 并重构数据清理 ([dc82303](https://github.com/Kwensiu/Pailer/commit/dc823032bc17a0514ae29c23040a468d091b26ef))
* switch view and settings tab persistence to localStorage ([f41a165](https://github.com/Kwensiu/Pailer/commit/f41a1656e8c19f90f264273d7b47fa57fe3eff92))
* **theme:** add system theme and set as default ([bce848b](https://github.com/Kwensiu/Pailer/commit/bce848b5c797b0ba62353497aa67a531c0b49260))
* **ui:** Add virtual list component for efficient large data rendering ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* **ui:** enhance doctor and settings components ([ad019fa](https://github.com/Kwensiu/Pailer/commit/ad019fa3d035ac6610a8f345c8182db2e2bbde97))
* **ui:** 优化界面布局与交互细节 / Optimize UI Layout and Interaction Details ([6b93698](https://github.com/Kwensiu/Pailer/commit/6b936988b5f010ed34469f67a9bd9cbb3301e24c))
* unify store files and migrate legacy data ([a5ab3ba](https://github.com/Kwensiu/Pailer/commit/a5ab3ba30c6627506988b332d1cb2994a4789bc8))
* update AboutSection UI adn remove depercated elements ([fb323ff](https://github.com/Kwensiu/Pailer/commit/fb323ff65306470a2696fd2a318e0535e6a00bc1))
* update project branding and fix hook bugs ([050b8b0](https://github.com/Kwensiu/Pailer/commit/050b8b0df4bd645bbe5065be973d7f4dc87cc5f0))
* update README ([ad72980](https://github.com/Kwensiu/Pailer/commit/ad7298043962dee0f2f15fe250c41b6564df2dff))
* update release notes, fix multiple instances issue. ([ddf2876](https://github.com/Kwensiu/Pailer/commit/ddf28765f90aa92a6a4d1ae0cb029214dd239b04))
* **update-log:** 添加更新日志功能并支持静默更新模式 ([6437024](https://github.com/Kwensiu/Pailer/commit/64370248a7a0daf7207401537802bbbb3bbf9073))
* **update:** add force update option and improve operation modal handling ([629423c](https://github.com/Kwensiu/Pailer/commit/629423cf53498f1146642c3e9ce875c14e415af0))
* **update:** Add test update channel support ([0ab2b2a](https://github.com/Kwensiu/Pailer/commit/0ab2b2abd200796eb820cb0411c0551636b5abae))
* **update:** 添加测试更新命令和通道配置支持 ([0c9de2e](https://github.com/Kwensiu/Pailer/commit/0c9de2e680c7e6d2d3879cf6d5733384b3d5b6ab))
* **virustotal:** fixed virustotal API config write location ([976380d](https://github.com/Kwensiu/Pailer/commit/976380da2917f9afbb9b09c4f32a5521a5c88856))
* 优化PackageInfo展示 ([205bc69](https://github.com/Kwensiu/Pailer/commit/205bc6974b8ebb418e8cb9dff86ac7c249c11cf4))


### Bug Fixes

* **bucket:** improve branch switching functions ([cf3b72b](https://github.com/Kwensiu/Pailer/commit/cf3b72bd33f5ce4b5ecf464b7c66d970195ce706))
* **build:** 修复版本号拼写错误 ([e0e835a](https://github.com/Kwensiu/Pailer/commit/e0e835aceee31520bcabab145f69ce20c711bf6a))
* cache clearing logic and improve internationalization ([da4f438](https://github.com/Kwensiu/Pailer/commit/da4f438a7983648de7266aa3073136d8a0ab1c96))
* clarify known bug in installation instructions ([c57e738](https://github.com/Kwensiu/Pailer/commit/c57e738bce05758eaea19757197d581d5ac3155f))
* clear updater pubkey in tauri configuration ([3a3b72d](https://github.com/Kwensiu/Pailer/commit/3a3b72d52431021d19262a58bfc6e84885c8755b))
* **cold-start:** 优化冷启动事件触发逻辑并减少重试次数 [skip ci] ([d7853a0](https://github.com/Kwensiu/Pailer/commit/d7853a07a17c3dcb7510e6ed4a562a6a4e408ee8))
* correct Scoop config path to use .config directory ([6fd2c72](https://github.com/Kwensiu/Pailer/commit/6fd2c7281ebf03a5a053485d498e48f1bcb08fbc))
* **crypto:** update windows DPAPI function signatures ([c0e6502](https://github.com/Kwensiu/Pailer/commit/c0e65029a9df14670c2a67cb740e21056b7b8e24))
* **debug:** 优化应用数据清理与 WebView 缓存处理 ([c6604a1](https://github.com/Kwensiu/Pailer/commit/c6604a19c94f7fc47b4f2a9d45298263001a6eec))
* **doctor:** Add retry mechanism and separate loading/retry states ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* **encoding:** 修复 PowerShell 命令执行时的中文乱码问题 ([a07d0f5](https://github.com/Kwensiu/Pailer/commit/a07d0f50f248e9002a373cf1a643c1f72968714c))
* enhance session storage caching and update modal UI ([25ca893](https://github.com/Kwensiu/Pailer/commit/25ca893129383f5bb030d565aed3772eafec2e21))
* ensure OperationModal displays for cleanup commands ([d5ab12e](https://github.com/Kwensiu/Pailer/commit/d5ab12ec1ef73245333f6c277764f5e53eef9a55))
* **error-detection:** 增强错误检测逻辑以减少误报 ([257f8e0](https://github.com/Kwensiu/Pailer/commit/257f8e0f671f1478471a86e376c67db83efd2ac6))
* **hooks:** Optimize bucket search and caching logic with redundant state removal ([7c792cd](https://github.com/Kwensiu/Pailer/commit/7c792cd8843a0ee7f0ff4eb3feb971fb737fc555))
* i18n support for tooltips and improve package operations ([a164f56](https://github.com/Kwensiu/Pailer/commit/a164f5605da00a34af3158ed95626ec391f4f983))
* **i18n:** fix language selection ([378ef96](https://github.com/Kwensiu/Pailer/commit/378ef96f3cb9fa20a16503229d7ba249d5ae95c1))
* improve startup registry cleanup and error handling ([03dcf97](https://github.com/Kwensiu/Pailer/commit/03dcf97506e097913684775e4807e2ce3d6cf1fe))
* **installed-page:** add margin bottom to search container ([6febbff](https://github.com/Kwensiu/Pailer/commit/6febbffbd71a295e0f6bcd57840a0dd5a3406f41))
* **layout:** Adjust page layout and refine styling details ([d37ab95](https://github.com/Kwensiu/Pailer/commit/d37ab95bb72509b110976b9218562495080aab9a))
* **layout:** Optimize table and card layouts to prevent text overflow ([e0a82e0](https://github.com/Kwensiu/Pailer/commit/e0a82e0e441bc3f7bc5ec3f3e8d47a983be52d9a))
* minimized indicator UI and related issues ([60975ea](https://github.com/Kwensiu/Pailer/commit/60975ea38a167c01e2caef507ab51e8e9c43ef73))
* minor UI tweaks ([7a8f356](https://github.com/Kwensiu/Pailer/commit/7a8f3564b4c8f7fc8d22d8ec1b547633111cca21))
* **modal:** implement intelligent scroll management for operation modals ([2860719](https://github.com/Kwensiu/Pailer/commit/2860719a0463e4575936833528e801e9f3edecf8))
* modals, links ([0fec390](https://github.com/Kwensiu/Pailer/commit/0fec390a769eb7815b19af75e9a375c345c9c825))
* **OperationModal:** set z-index to z-60 ([d033af5](https://github.com/Kwensiu/Pailer/commit/d033af5c9d21cbdebc8b999a212cd523532233d2))
* **operations:** reset state before starting new package operations ([9b39ea3](https://github.com/Kwensiu/Pailer/commit/9b39ea3393df9a72a7ed924765169e57ffdd7764))
* optimize error handling and code cleanup for useInstalledPackages hook ([2f40b27](https://github.com/Kwensiu/Pailer/commit/2f40b27a7267c9e3bcc8d88887d3131e94e242b6))
* optimize workflows and i18n support ([5ff851d](https://github.com/Kwensiu/Pailer/commit/5ff851d4857875954eee69bcf12c87e93ec7d616))
* potential crash in set_scoop_path if settings is not an object ([a5ab3ba](https://github.com/Kwensiu/Pailer/commit/a5ab3ba30c6627506988b332d1cb2994a4789bc8))
* **powershell:** prevent console window from appearing on Windows ([cf1b7ac](https://github.com/Kwensiu/Pailer/commit/cf1b7ac68fdd2abb335bf7dedeb8ef85aebca76e))
* **powershell:** prevent console window from appearing on Windows ([7354526](https://github.com/Kwensiu/Pailer/commit/7354526a9e46f3ba0bd3fec129377f8e930bbf7e))
* **powershell:** Re-add -NoProfile in powershell.rs ([0668e3d](https://github.com/Kwensiu/Pailer/commit/0668e3db0138d5cfc9c56d79aaf483e6eb66aff1))
* prevent dropdown menu clicks from triggering card onClick in package views ([905f3db](https://github.com/Kwensiu/Pailer/commit/905f3dbdc6775c1e798de8784addf61c2e632e53))
* readme ([7cec9ac](https://github.com/Kwensiu/Pailer/commit/7cec9acd2e9296e79d83294de84445644bb693e5))
* README.md ([d25c8b1](https://github.com/Kwensiu/Pailer/commit/d25c8b1fe98123d536da28826b2687f1dd751ea5))
* redundant migration calls in settings.rs (migration is now only in initStore) ([a5ab3ba](https://github.com/Kwensiu/Pailer/commit/a5ab3ba30c6627506988b332d1cb2994a4789bc8))
* refactor OperationModal and fix styling bugs ([b9127b6](https://github.com/Kwensiu/Pailer/commit/b9127b6987ea082882791575dc39dbdb58308f37))
* remove empty pubkey from updater configuration ([7276f92](https://github.com/Kwensiu/Pailer/commit/7276f926ea759585ce14abf02e6810d629652a50))
* remove empty pubkey from updater configuration ([b642814](https://github.com/Kwensiu/Pailer/commit/b642814bcfe4bea82cb001ee172bbea40cae48ec))
* remove PowerShell selector flicker ([ff1d5c4](https://github.com/Kwensiu/Pailer/commit/ff1d5c47d78bad7209b40538273d8cd93c6bb9d6))
* Remove unused file `AnimatedUpdateButton.tsx` ([13db862](https://github.com/Kwensiu/Pailer/commit/13db862845f3a950be199b9768858cf914b0147c))
* reset update status to 'idle' when no update is available ([077687e](https://github.com/Kwensiu/Pailer/commit/077687e34f816761a2b612c34fbb1bd676e5bc5c))
* resolve app close issue by moving cache cleanup ([5d45350](https://github.com/Kwensiu/Pailer/commit/5d45350264818e5f0bd4075bd3b9d0161042c51a))
* resolve critical issues from code review ([9b907fa](https://github.com/Kwensiu/Pailer/commit/9b907fabe7de15e2d789b8251f155936b8940cee))
* resolve loading state and type issues in useSearch hook ([e32368a](https://github.com/Kwensiu/Pailer/commit/e32368a5b78c8f561f2066de433ca08b2ad7eaaa))
* resolve manifest modal z-index layering issue ([66a61b3](https://github.com/Kwensiu/Pailer/commit/66a61b3b595d52748aa8a981c184d91c8ffa7bb4))
* resolve SolidJS cleanup warnings by wrapping signals in createRoot ([6e33863](https://github.com/Kwensiu/Pailer/commit/6e33863708377abd58030e84ba95bf47f1d0ff05))
* Respect default launch page setting on app restart ([fb53aa9](https://github.com/Kwensiu/Pailer/commit/fb53aa903f145937852bff20945ce3f7cc2d608f))
* **settings:** 更新 Scoop 路径设置后同步更新内存状态 ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* Solving the issue of two operationmodals popping up during manual updates ([5d5366b](https://github.com/Kwensiu/Pailer/commit/5d5366b8d1a94b819a1bd8269d8276a09ec0617b))
* **tauri:** Change build target to NSIS, disable MSI generation ([7d4d5e6](https://github.com/Kwensiu/Pailer/commit/7d4d5e699e4078cd86018b17f963a59f1bf05d32))
* **tauri:** Ensure main window is visible and focused on startup ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* the shortcut toggle in settings cannot be hot-swapped ([0b7467d](https://github.com/Kwensiu/Pailer/commit/0b7467d58456dabcf7551dd82c8fd5a23b016331))
* Tweak some UI elements. Adjust release.yml function. ([412a264](https://github.com/Kwensiu/Pailer/commit/412a264542d1deff4cf295fd990f7932b97b74a4))
* **ui:** minor text corrections and icon updates ([66b5365](https://github.com/Kwensiu/Pailer/commit/66b5365acf3eb51e4ed7cb3cdf178bba93143ffb))
* update actions/upload-artifact from v3 to v4 ([6d7002f](https://github.com/Kwensiu/Pailer/commit/6d7002f9f93f949c37f6a17f12c6ba35297e5522))
* update fetch options and improve cache handling in bucket commands (Possible potential problems) ([346d411](https://github.com/Kwensiu/Pailer/commit/346d411e92a7e53813beaca5b083a4060a9080fd))
* update package-lock.json to sync with package.json dependencies ([81c3a8c](https://github.com/Kwensiu/Pailer/commit/81c3a8cbb5ffde1796b32c45f0869cdfe9571446))
* update release workflow ([#15](https://github.com/Kwensiu/Pailer/issues/15)) ([87e5e4b](https://github.com/Kwensiu/Pailer/commit/87e5e4ba56a0be8654ffbc078a002a06b785d784))
* update updater pubkey and release endpoint in tauri configuration ([3794f95](https://github.com/Kwensiu/Pailer/commit/3794f959166f22e8e477b003738f1639c15b3594))
* update updater pubkey in tauri configuration ([6b9246e](https://github.com/Kwensiu/Pailer/commit/6b9246ec36345cf12493d77251a9630a0e51b7ad))
* update version to 1.4.65 for Semver and MSI compliance ([4a3f192](https://github.com/Kwensiu/Pailer/commit/4a3f1929ef7171200da076c738b386b8a941a390))
* **update:** fix version display showing 'unknown' when update check fails ([0621b43](https://github.com/Kwensiu/Pailer/commit/0621b43be4b9d544f38440d93e13c471bf7f89b9))
* upgrade @tauri-apps/plugin-process from 2.3.0 to 2.3.1 ([ad483cd](https://github.com/Kwensiu/Pailer/commit/ad483cdefcb272be873c572963441da69b08edd7))
* upgrade @tauri-apps/plugin-store from 2.4.0 to 2.4.1 ([6aa4977](https://github.com/Kwensiu/Pailer/commit/6aa4977aade3297f751e9265ba910b97223168d0))
* upgrade lucide-solid from 0.546.0 to 0.552.0 ([f03027c](https://github.com/Kwensiu/Pailer/commit/f03027c199b1034fd40d7b1f4854ff29b3a97ca6))
* upgrade lucide-solid from 0.552.0 to 0.554.0 ([3272e43](https://github.com/Kwensiu/Pailer/commit/3272e435ce3b8bea2ddaead3e292d73fe58207ed))
* upgrade solid-js from 1.9.9 to 1.9.10 ([8680974](https://github.com/Kwensiu/Pailer/commit/86809740f3b36be62b6ea5569b32f99eea2bdd1e))
* use semantic version comparison in auto cleanup ([59c0d0b](https://github.com/Kwensiu/Pailer/commit/59c0d0ba4b6e2df898605c5c6a6bf2eec2e1f3e6))
* weird bug ([c43b4e6](https://github.com/Kwensiu/Pailer/commit/c43b4e66660ac88f49416176497dff9c7f9c7bc9))
* workflow smoother ([42746cf](https://github.com/Kwensiu/Pailer/commit/42746cf0702ce7c56522120f3698ce8a58c369c2))


### UI

* add markdown processing utility and GitHub-style CSS ([d896987](https://github.com/Kwensiu/Pailer/commit/d896987dc954fad73e29713395442a51f49b7d65))
* add new BulkUpdateProgress to separate bucketPage responsibilities ([85cac66](https://github.com/Kwensiu/Pailer/commit/85cac66289eb6d1be9664c3476f372b10f6d1bb3))
* add OpenPathButton component ([80654b1](https://github.com/Kwensiu/Pailer/commit/80654b11d4192a306df016f0192246c341caf745))
* add ToastAlert.tsx component to replace some temporary prompts ([be47704](https://github.com/Kwensiu/Pailer/commit/be477048a3472efa06b547443e6637949a66d045))
* add version type filtering and improve dropdown UI consistency ([97fe627](https://github.com/Kwensiu/Pailer/commit/97fe6278836c9f0fd8436b9c8cff7c9e40fef631))
* adjust toast messages to show on top(999) ([97a4827](https://github.com/Kwensiu/Pailer/commit/97a4827800e6537425f5f1f706a1c82e0334a3a7))
* css improvements ([7e1ad12](https://github.com/Kwensiu/Pailer/commit/7e1ad125ae342c7ea9077caa640d0c1068ced242))
* Enhance PackageInfoModal with dropdown and force update ([80ae5bf](https://github.com/Kwensiu/Pailer/commit/80ae5bfdd6c66094b5818d3a1f4621ccd7d931be))
* fix incorrect ui in OperationModal and PackageInfoModal ([c81ae0a](https://github.com/Kwensiu/Pailer/commit/c81ae0a6c83d184752fe8933df282e324a87822b))
* improve UI adjustments and modal layering ([83cc69a](https://github.com/Kwensiu/Pailer/commit/83cc69a69e57f1d3e42b12a5400980a58ba38793))
* Redesign BucketInfoModal with enhanced interactions ([3b3e157](https://github.com/Kwensiu/Pailer/commit/3b3e157f11ff3a866a114fd885e7050af2e2b9ca))
* Refactor Dropdown component with reactive state management ([b5870d5](https://github.com/Kwensiu/Pailer/commit/b5870d5ef45c664f6c633f810b76fa44c083f74e))
* Update localization and modal rendering consistency ([2246275](https://github.com/Kwensiu/Pailer/commit/22462751d45df2e370ba3d8526087213eff7528c))
* update settings, styles, and localization ([48c2f41](https://github.com/Kwensiu/Pailer/commit/48c2f412ff518add3e78a6b34fd060f100ae952d))


### Performance

* **bucket:** Limit concurrent updates to prevent system overload ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* implement unified data preloading for improved startup performance ([9918b35](https://github.com/Kwensiu/Pailer/commit/9918b35c1da53a21eba3762a60e688d5378ba9f0))
* improve bucket install command ([0e08b1f](https://github.com/Kwensiu/Pailer/commit/0e08b1f4e171578aa6f92cea3ab3d2898ce491d5))
* **OperationModal.tsx:** 减少一次 requestAnimationFrame 调用层级 ([587ff20](https://github.com/Kwensiu/Pailer/commit/587ff2091ceaf9a89a80cdcbef7ea2c37528fb91))
* optimize session storage with anti-loop protection ([af654cf](https://github.com/Kwensiu/Pailer/commit/af654cfedecaa668d1b706b4a175dc4562010698))


### Styles

* **AppDataManagement:** 调整数据管理页面样式细节 ([99f97e5](https://github.com/Kwensiu/Pailer/commit/99f97e5b79c06ee59876a71592105c857d362587))
* **css:** 调整全局样式去除默认输入框焦点轮廓 ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* **empty-state:** Improve empty state design for no matching packages ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* enhance frontend styling and UI improvements ([7f07b2e](https://github.com/Kwensiu/Pailer/commit/7f07b2e94a4dc8b12537c1dbfc61866b4146b583))


### Refactoring

* Adjust logging levels and wrap SolidJS stores in createRoot ([df4e779](https://github.com/Kwensiu/Pailer/commit/df4e779148aeb1550e750c233d504df07072a618))
* **AnimatedButton.tsx:** 使用 createMemo 优化按钮宽度计算逻辑 ([bdcb13a](https://github.com/Kwensiu/Pailer/commit/bdcb13a9b0149c3b28a3f8e02808f40fffb6d459))
* **App.tsx:** 限制调试日志仅在开发环境输出 ([70495a7](https://github.com/Kwensiu/Pailer/commit/70495a7d8e4f0baf5f8a21414faa412a32219938))
* **bucket:** 重构桶更新状态管理和进度条展示 ([cf05b22](https://github.com/Kwensiu/Pailer/commit/cf05b22adc4d0bcfed61e180eb7fd6eb5db7d183))
* centralize cache refresh logic in operations store ([02f0607](https://github.com/Kwensiu/Pailer/commit/02f0607ac9cccf85d1c7876e862effe7b0de1417))
* **component:** Rename and optimize confirmation panel component logic ([1b324d5](https://github.com/Kwensiu/Pailer/commit/1b324d5e2d7465358e6c591c627783b91c8348e9))
* consolidate modals and standardize button theming ([4aea4ce](https://github.com/Kwensiu/Pailer/commit/4aea4ce035402a9c4e426071021c4c1205cf4e56))
* consolidate package operations into shared hooks ([1e08e16](https://github.com/Kwensiu/Pailer/commit/1e08e16a6b1522d52f4c09f656f52c5da8f363b3))
* **core:** rename createStoredSignal to createTauriSignal ([41bb48a](https://github.com/Kwensiu/Pailer/commit/41bb48ab55917eb6edd7aa80b980e0772a7c65e6))
* enhance Header and BucketSearch components for improved styling and usability ([3088f46](https://github.com/Kwensiu/Pailer/commit/3088f4662e811c82dc4fd4403536632187ac1961))
* enhance package operations and modal interactions ([8ab30a8](https://github.com/Kwensiu/Pailer/commit/8ab30a8ba8f40764989015d42424cdfa8388936d))
* extract command execution state to operations store ([34eaebf](https://github.com/Kwensiu/Pailer/commit/34eaebf207a4d95b0452e7c666f9263bf1df99db))
* file structure and imports ([4f77dd1](https://github.com/Kwensiu/Pailer/commit/4f77dd15a83c31c23fed85c74e8cfb916f9b2791))
* **header:** remove language selector component in header ([ffef53e](https://github.com/Kwensiu/Pailer/commit/ffef53e6911ca5058a3648d1f59a753a1a801943))
* **hooks:** Optimize useBuckets cache logic to reduce unnecessary loading states ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* **i18n:** enhance i18n feature ([ba39414](https://github.com/Kwensiu/Pailer/commit/ba39414e52339b5d8675726fc7efc7cd4eed7988))
* **i18n:** Optimizes the front-end and back-end i18n synchronization mechanism ([cd0cb2d](https://github.com/Kwensiu/Pailer/commit/cd0cb2d4d2e14fc21cbcec6e1f7a3a3dc830e4fa))
* implement AES encryption for VirusTotal API key storage ([aa29e0e](https://github.com/Kwensiu/Pailer/commit/aa29e0e7a0507851f883d9f897e8e424b88373a9))
* improve operation modal lifecycle and status handling ([470a7de](https://github.com/Kwensiu/Pailer/commit/470a7dedc6d664ef03591343d64296a02c77adb9))
* **installed-packages:** 提升包扫描加载过程的日志粒度 ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* **installed:** Extract action buttons into reusable components ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* **installed:** implement unified context menu system ([a5b1e72](https://github.com/Kwensiu/Pailer/commit/a5b1e72a71a78915f999d3cbfa2deeae39a1f0dc))
* **installed:** redesign package list with context menu ([de8047f](https://github.com/Kwensiu/Pailer/commit/de8047fd70b4ba620f7b8ff47ba37a872214b64f))
* **installed:** 优化已安装包列表视图组件 ([e172254](https://github.com/Kwensiu/Pailer/commit/e17225442e7e1095d7f42b48a17846f00941bc6f))
* **lib:** move background tasks to separate scheduler module to align with upstream ([4535c08](https://github.com/Kwensiu/Pailer/commit/4535c08a771c5c4a2c7ec5d941dacbcc205c28ba))
* massive backend optimization with caching, async ops, and architecture improvements ([6fd139d](https://github.com/Kwensiu/Pailer/commit/6fd139d44772eb09b22dc6b779ae476c93716f2b))
* migrate deprecated lucide icons to new names ([feeed5f](https://github.com/Kwensiu/Pailer/commit/feeed5f3d779dc9bcea125f056d48a4120811e03))
* **MinimizedIndicator.tsx:** 替换 createEffect 为 onMount/onCleanup 生命周期钩子 ([eb4e50b](https://github.com/Kwensiu/Pailer/commit/eb4e50b3238e27cb0b3d7bfc4730476db88d044a))
* **modal:** replace custom modals with reusable modal component ([c1e8788](https://github.com/Kwensiu/Pailer/commit/c1e8788de3e1fd59d57034eb0b1e331ae83a3a8d))
* optimize installed packages page user experience ([fde1057](https://github.com/Kwensiu/Pailer/commit/fde1057aae800cb5c648e891d5bb871bb6505acc))
* persist Scoop config in localStorage to prevent doctor page flickering ([ce0a24d](https://github.com/Kwensiu/Pailer/commit/ce0a24dac30dbc50a556988d92cdceca02dbb4dd))
* **powershell:** refactor PowerShell output error detection for improved maintainability ([0429cdc](https://github.com/Kwensiu/Pailer/commit/0429cdce0f848f019a36afa09a10d1da3ef15a17))
* **powershell:** 移除 PowerShell 启动参数 `-NoProfile` ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* remove duplicate data fetching logic in ScoopInfo saveConfig ([ff54f29](https://github.com/Kwensiu/Pailer/commit/ff54f298ff0fbfbcc855725f041abed0d2694f19))
* remove update logging functionality ([131c411](https://github.com/Kwensiu/Pailer/commit/131c411a2fa3333825f838d62e06b863a0d29958))
* rename custom_update to fallback_update and fix critical issues ([7a54bb0](https://github.com/Kwensiu/Pailer/commit/7a54bb0719f63d8b864037cc0203fed7d6fdbb73))
* rename WindowBehaviorSettings to TraySettings and remove unused TrayAppsSettings ([2a271f1](https://github.com/Kwensiu/Pailer/commit/2a271f1b7fa3befdb50f226bb157ef42ef783540))
* replace deprecated actions/create-release with ncipollo/release-action ([d5fc50d](https://github.com/Kwensiu/Pailer/commit/d5fc50d360ca971778a6533affc3ff15f7486206))
* **scroll:** enhance scroll management with terminal controls ([719e277](https://github.com/Kwensiu/Pailer/commit/719e277cf0bc0909e3c73a5414e6ee4ace4b5821))
* **settings:** remove legacy store migration logic ([08def66](https://github.com/Kwensiu/Pailer/commit/08def66f2f541a6b0ceee2406053b5f6ce59b8c7))
* **settings:** replace theme toggle with dropdown selection ([7b7ff0a](https://github.com/Kwensiu/Pailer/commit/7b7ff0a50452971a4d03cb8ddf228f8816a4bd29))
* **settings:** 移除不必要的i18n回退显示 [skip ci] ([d30a628](https://github.com/Kwensiu/Pailer/commit/d30a6282eb796a1534ccd7a13b425e27ab331c40))
* simplify AboutSection update system ([b76314b](https://github.com/Kwensiu/Pailer/commit/b76314bea92b9002b81cc74936fca662925025f9))
* split up settings into components ([72c08b2](https://github.com/Kwensiu/Pailer/commit/72c08b2c2105e4535ca938612107c5101b589a6b))
* streamline installed packages hook with optimized caching ([5b20207](https://github.com/Kwensiu/Pailer/commit/5b202071a7d96a18ba500685cc9ad2a50cc66dbe))
* **types:** enhance data types and storage mechanisms ([5016a26](https://github.com/Kwensiu/Pailer/commit/5016a26c47cd19ef77f304f3f38a5229cefaeb3f))
* **types:** Update parameter names for better semantics ([3df7a14](https://github.com/Kwensiu/Pailer/commit/3df7a14409c037d7594f085a9b24e001ad3d0d9d))
* **ui:** 替换页面切换方式为持久化渲染模式 ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* unify bucket date formatting logic ([6d16919](https://github.com/Kwensiu/Pailer/commit/6d16919ff28d9b2c6d968a22b828750f036372a0))
* update logic to use centralized update store ([8ac5144](https://github.com/Kwensiu/Pailer/commit/8ac5144dc1b17d909b322bc36208b4b64f51f506))
* update scoop path detection logic and log output ([2131678](https://github.com/Kwensiu/Pailer/commit/2131678717242324fb27679bdb7cf14c98e6ce2b))
* update settings UI and add UpdateModal component ([873993f](https://github.com/Kwensiu/Pailer/commit/873993fc2c8b54df54d2d0e54345138dcc95b4fd))
* **utils:** 增强 Scoop 安装路径检测逻辑的日志输出 ([824150d](https://github.com/Kwensiu/Pailer/commit/824150db46dc08c562475b6135a876985a66b347))
* 统一代码格式化并优化项目结构 [skip ci] ([97f637c](https://github.com/Kwensiu/Pailer/commit/97f637cfe90e0e7d03b3ce4571ddf7088b981ef5))


### Chores

* bump version to v1.0.0 ([98a989a](https://github.com/Kwensiu/Pailer/commit/98a989abf24b8c8c187a864373d16d3764de24f9))

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
