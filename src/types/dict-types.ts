export interface Dict {
  app: {
    buckets: string;
    doctor: string;
    packages: string;
    search: string;
    settings: string;
    title: string;
  };
  bucket: {
    card: {
      local: string;
      packages: string;
      update: string;
      updated: string;
      updating: string;
      view: string;
    };
    errors: {
      alreadyExists: string;
      cloneFailed: string;
      fetchBranchesFailed: string;
      notFound: string;
      switchBranchFailed: string;
      switchBranchSuccess: string;
      uncommittedChanges: string;
    };
    grid: {
      bulkUpdateCompletedSuccess: string;
      bulkUpdateCompletedWithFailures: string;
      cancellingUpdates: string;
      errorDetails: string;
      hideErrors: string;
      loading: string;
      noBucketsDescription: string;
      noBucketsFound: string;
      noGitBuckets: string;
      refresh: string;
      reloadLocal: string;
      reloadLocalShort: string;
      showErrors: string;
      title: string;
      updateAllGit: string;
      updateAllGitShort: string;
      updateCancelled: string;
      updateCompleted: string;
      updatingBuckets: string;
    };
    page: {
      description: string;
    };
    search: {
      backToVerified: string;
      backToVerifiedTitle: string;
      cancel: string;
      clearSearch: string;
      closeSearch: string;
      communityBuckets: string;
      description: string;
      disableChineseBuckets: string;
      disableCommunity: string;
      disableCommunityTitle: string;
      discoverDescription: string;
      discoverNew: string;
      enableExpandedSearch: string;
      estimatedDownloadSize: string;
      expandNote: string;
      expandSearchTitle: string;
      filterOptions: string;
      largeDatasetWarning: string;
      minimumGithubStars: string;
      noCacheDate: string;
      note: string;
      refreshCommunityData: string;
      resetCacheTitle: string;
      resultsCount: string;
      retry: string;
      searchBuckets: string;
      searchForBuckets: string;
      sortApps: string;
      sortBy: string;
      sortName: string;
      sortRelevance: string;
      sortStars: string;
      totalBuckets: string;
    };
    searchResults: {
      copyCommand: string;
      customName: string;
      details: string;
      expandedSearch: string;
      install: string;
      installCommand: string;
      installTitle: string;
      installed: string;
      installing: string;
      noBucketsFound: string;
      noDescription: string;
      openInGithub: string;
      removing: string;
      removingTitle: string;
      searchingBuckets: string;
      title: string;
      tryAdjustTerms: string;
      updated: string;
      urlCopied: string;
      viewDetails: string;
    };
    update: {
      hasUncommittedChanges: string;
      success: string;
      upToDate: string;
    };
  };
  bucketInfo: {
    availablePackages: string;
    branch: string;
    bucket: string;
    clickToViewInfo: string;
    close: string;
    description: string;
    details: string;
    external: string;
    git: string;
    gitRepository: string;
    install: string;
    installing: string;
    lastUpdated: string;
    loadAllPackages: string;
    loadAllWarning: string;
    loadPackages: string;
    loadingPackages: string;
    localDirectory: string;
    name: string;
    noPackagesFound: string;
    openFolder: string;
    packages: string;
    packagesCount: string;
    path: string;
    refreshBucket: string;
    refreshManifests: string;
    removing: string;
    repository: string;
    tooManyPackages: string;
    type: string;
    unknown: string;
    viewOnGithub: string;
    viewPackagesOnRepository: string;
  };
  buttons: {
    auto: string;
    cancel: string;
    clear: string;
    close: string;
    closeDialog: string;
    collapse: string;
    confirm: string;
    copyToClipboard: string;
    delete: string;
    forceUpdate: string;
    goToBuckets: string;
    install: string;
    later: string;
    openPath: string;
    refresh: string;
    remove: string;
    removeAll: string;
    removeSelected: string;
    save: string;
    showLess: string;
    showMore: string;
    sure: string;
    switch: string;
    switchBucket: string;
    uninstall: string;
    updateAll: string;
    view: string;
  };
  common: {
    time: {
      daysAgo: string;
      monthsAgo: string;
      today: string;
      yearsAgo: string;
      yesterday: string;
    };
  };
  contextMenu: {
    openFolder: string;
    processing: string;
  };
  doctor: {
    addShimModal: {
      addShim: string;
      arguments: string;
      argumentsHelp: string;
      argumentsPlaceholder: string;
      commandPath: string;
      globalShim: string;
      shimName: string;
      title: string;
    };
    cacheManager: {
      cacheIsEmpty: string;
      confirmDeletion: string;
      confirmScoopCacheRm: string;
      deleteAll: string;
      deleteFiles: string;
      filterPlaceholder: string;
      name: string;
      noCachedFiles: string;
      openCacheDirectory: string;
      scoopCacheRmDescription: string;
      scoopCacheRmWarning: string;
      selectedPackages: string;
      settings: {
        preserveVersioned: string;
        preserveVersionedDescription: string;
        title: string;
        useScoopCleanup: string;
      };
      size: string;
      title: string;
      version: string;
    };
    checkup: {
      description: string;
      install: string;
      installing: string;
      issuesFound: string;
      items: {
        gitInstalled: string;
        gitSuggestion: string;
        helperInstalled: string;
        helperNotInstalled: string;
        helperSuggestion: string;
        longPathsEnabled: string;
        longPathsSuggestion: string;
        mainBucketInstalled: string;
        mainBucketSuggestion: string;
        scoopOnNtfs: string;
        scoopOnNtfsSuggestion: string;
        windowsDeveloperModeEnabled: string;
        windowsDeveloperModeSuggestion: string;
      };
      runCheckup: string;
      scrollToIssues: string;
      title: string;
    };
    cleanup: {
      cleanupOldVersions: string;
      cleanupOutdatedCache: string;
      description: string;
      title: string;
    };
    commandInput: {
      clearOutput: string;
      enterCommand: string;
      enterFullCommand: string;
      executingCommand: string;
      run: string;
      running: string;
      scoopPrefixDisabled: string;
      scoopPrefixEnabled: string;
      switchInputMode: string;
      title: string;
      waitingForCommands: string;
    };
    proxySettings: {
      clearSuccess: string;
      description: string;
      loadError: string;
      loading: string;
      proxyAddress: string;
      proxyPlaceholder: string;
      saveError: string;
      saveSuccess: string;
      title: string;
    };
    refreshAll: string;
    scoopInfo: {
      cancel: string;
      editConfiguration: string;
      editScoopConfiguration: string;
      noConfigurationFound: string;
      save: string;
      saveErrorPrefix: string;
      saveSuccess: string;
      title: string;
    };
    shimDetails: {
      arguments: string;
      hide: string;
      noArgs: string;
      path: string;
      source: string;
      unhide: string;
    };
    shimManager: {
      addShim: string;
      args: string;
      attributes: string;
      filterPlaceholder: string;
      hidden: string;
      name: string;
      noShimsFound: string;
      openShimDirectory: string;
      sourcePackage: string;
      title: string;
    };
    title: string;
    versionedApps: {
      bucket: string;
      cleanupAllOldVersionsError: string;
      cleanupAllOldVersionsInfo: string;
      cleanupAllOldVersionsSuccess: string;
      cleanupAllOldVersionsWarning: string;
      confirmCleanupAllOldVersions: string;
      currentVersion: string;
      deleteVersionError: string;
      deleteVersionSuccess: string;
      filterPlaceholder: string;
      localVersions: string;
      name: string;
      noVersionedApps: string;
      noVersionedAppsDesc: string;
      openAppsDirectory: string;
      preserveVersionedInstalls: string;
      selectAction: string;
      switchVersionError: string;
      switchVersionSuccess: string;
      title: string;
    };
  };
  installed: {
    grid: {
      bucket: string;
      updatedOn: string;
      version: string;
    };
    header: {
      allBuckets: string;
      allVersionTypes: string;
      bucketLabel: string;
      filter: string;
      heldPackages: string;
      refresh: string;
      resetFilters: string;
      searchPlaceholder: string;
      switchToGridView: string;
      switchToListView: string;
      title: string;
      updateAll: string;
      versionTypeLabel: string;
      versionedSoftware: string;
    };
    list: {
      bucket: string;
      cannotUnhold: string;
      changeBucket: string;
      ciVersionNote: string;
      heldTooltip: string;
      holdPackage: string;
      name: string;
      openFolder: string;
      switchVersion: string;
      unholdPackage: string;
      uninstall: string;
      update: string;
      updateAvailableTooltip: string;
      updated: string;
      version: string;
    };
  };
  language: {
    description: string;
    title: string;
  };
  manifest: {
    openFailed: string;
    title: string;
    urlError: string;
  };
  manifestModal: {
    loading: string;
    title: string;
  };
  messages: {
    loading: string;
  };
  noPackagesFound: {
    browsePackages: string;
    clearFilters: string;
    noInstalledYet: string;
    noMatchCriteria: string;
    title: string;
  };
  operation: {
    completed: string;
    failed: {
      generic: string;
      withErrors: string;
    };
    updateAllSuccess: string;
    withWarnings: string;
  };
  packageInfo: {
    backToBucket: string;
    bucket: string;
    changeBucket: string;
    changeBucketFor: string;
    close: string;
    current: string;
    debugStructure: string;
    description: string;
    details: string;
    ensureSoftwarePresent: string;
    errorChangingBucket: string;
    errorDeletingVersion: string;
    errorLoadingManifest: string;
    errorLoadingVersions: string;
    errorSwitchingVersion: string;
    force: string;
    forceUpdate: string;
    forceUpdating: string;
    homepage: string;
    includes: string;
    installDate: string;
    installed: string;
    installedVersion: string;
    installing: string;
    latestVersion: string;
    license: string;
    name: string;
    notes: string;
    openFolder: string;
    success: {
      changeBucket: string;
      forceUpdate: string;
      install: string;
      switchVersion: string;
      uninstall: string;
      update: string;
    };
    title: string;
    uninstalling: string;
    update: string;
    updateDate: string;
    updating: string;
    version: string;
    versionSwitch: string;
    viewBucketInfo: string;
    viewManifest: string;
    warning: string;
  };
  pailerUpdate: {
    error: string;
    forceUpdateTitle: string;
    notScoopInstall: string;
    updateButton: string;
    updateSteps: string;
    updateTitle: string;
  };
  scoopConfigWizard: {
    autoDetect: string;
    autoDetectFailed: string;
    autoDetectFailedSystem: string;
    autoDetectedSuccess: string;
    browse: string;
    copied: string;
    customInstallation: string;
    detecting: string;
    enterPath: string;
    globalAppsDirectory: string;
    learnMore: string;
    notInstalled: string;
    officialInstallation: string;
    pathLabel: string;
    pathPlaceholder: string;
    powershellInstructions: string;
    saveAndContinue: string;
    saveFailed: string;
    scoopDescription: string;
    scoopDirectory: string;
    selectDirectory: string;
    title: string;
    validatePath: string;
    validating: string;
    validationFailed: string;
    validationMissingDirectories: string;
    validationPathNotDirectory: string;
    validationPathNotExist: string;
    validationPathsNotDirectories: string;
    validationSuccess: string;
    visitWebsite: string;
    visitWebsiteText: string;
    welcomeDescription: string;
    welcomeTitle: string;
  };
  scoopStatus: {
    allGoodMessage: string;
    appsWithIssues: string;
    badges: {
      heldPackage: string;
      updateAvailable: string;
    };
    bucketsOutOfDate: string;
    errorCheckingStatus: string;
    networkFailure: string;
    scoopOutOfDate: string;
    table: {
      installed: string;
      latest: string;
      name: string;
      status: string;
    };
    title: string;
  };
  search: {
    bar: {
      clearSearch: string;
      placeholder: string;
      searchHelp: string;
    };
    bucketInfo: {
      loadFailed: string;
      loading: string;
      notFound: string;
    };
    emptyState: {
      description: string;
      title: string;
    };
    filter: {
      allBuckets: string;
    };
    help: {
      allBuckets: string;
      bucketSearch: string;
      description: string;
      exactMatch: string;
      examples: string;
      normalSearch: string;
      note: string;
      title: string;
    };
    refreshResults: string;
    results: {
      copied: string;
      copyCommand: string;
      customInstall: string;
      installed: string;
      installedDifferentBucketTooltip: string;
      multipleVersionsInstalled: string;
      noPackagesFound: string;
      pageInfo: string;
      toggleDetails: string;
      versionedSupport: string;
      viewBucket: string;
      viewCommits: string;
      viewManifest: string;
    };
    settings: {
      allowCachePrebuild: string;
      allowCachePrebuildDescription: string;
      open: string;
      title: string;
    };
    tabs: {
      includes: string;
      packages: string;
    };
  };
  settings: {
    about: {
      autoCheck: string;
      autoCheckTooltip: string;
      checkNow: string;
      customizedVersion: string;
      description: string;
      downloadingNoSize: string;
      downloadingUpdate: string;
      goToProject: string;
      installWarning: string;
      installingUpdate: string;
      joinDiscussion: string;
      latestVersion: string;
      managedByScoop: string;
      noReleaseNotes: string;
      releaseNotes: string;
      retry: string;
      scoopUpdateInstruction: string;
      submitIssue: string;
      updateAvailable: string;
      updateFailed: string;
      updateReady: string;
      updateStatus: string;
    };
    appData: {
      clearCache: string;
      clearCacheButton: string;
      clearCacheDescription: string;
      clearCacheError: string;
      clearError: string;
      clearingCache: string;
      dataDirectory: string;
      description: string;
      factoryReset: string;
      factoryResetButton: string;
      factoryResetDescription: string;
      loadError: string;
      logDirectory: string;
      openDirectory: string;
      resetting: string;
      sure: string;
      title: string;
    };
    autoCleanup: {
      cleanOldVersions: string;
      cleanOldVersionsDescription: string;
      cleanOutdatedCache: string;
      cleanOutdatedCacheDescription: string;
      description: string;
      title: string;
      versionsToKeep: string;
    };
    bucketAutoUpdate: {
      active: string;
      autoUpdatePackages: string;
      autoUpdatePackagesDescription: string;
      customInterval: string;
      customIntervalDescription: string;
      customIntervalSaved: string;
      dayDisplay: string;
      dayFormat: string;
      days: string;
      daysFormat: string;
      debug: string;
      debugDescription: string;
      description: string;
      error: string;
      every24Hours: string;
      every24HoursDescription: string;
      every24HoursDisplay: string;
      everyWeek: string;
      everyWeekDescription: string;
      everyWeekDisplay: string;
      hourDisplay: string;
      hourFormat: string;
      hours: string;
      hoursFormat: string;
      intervalTooShort: string;
      minimumInterval: string;
      minuteDisplay: string;
      minuteFormat: string;
      minutes: string;
      minutesFormat: string;
      off: string;
      offDescription: string;
      oneHourDisplay: string;
      previewFormat: string;
      quantity: string;
      save: string;
      saved: string;
      saving: string;
      secondsFormat: string;
      silentUpdate: string;
      silentUpdateDescription: string;
      sixHoursDisplay: string;
      title: string;
      unit: string;
      weekDisplay: string;
      weekFormat: string;
      weeks: string;
      weeksFormat: string;
    };
    category: {
      about: string;
      automation: string;
      management: string;
      security: string;
      windowUi: string;
    };
    debug: {
      description: string;
      title: string;
    };
    defaultLaunchPage: {
      buckets: string;
      description: string;
      doctor: string;
      installed: string;
      search: string;
      settings: string;
      title: string;
    };
    heldPackages: {
      description: string;
      noPackagesHeld: string;
      title: string;
      unhold: string;
    };
    hotkey: {
      description: string;
      note: string;
      title: string;
    };
    powershell: {
      autoDetect: string;
      description: string;
      pwsh: string;
      title: string;
      windows: string;
    };
    scoopConfiguration: {
      description: string;
      detectError: string;
      detectSuccess: string;
      pathLabel: string;
      pathPlaceholder: string;
      saveError: string;
      saveSuccess: string;
      title: string;
    };
    scoopUpdate: {
      description: string;
      title: string;
    };
    startup: {
      description: string;
      silentStartup: {
        description: string;
        title: string;
      };
      title: string;
    };
    theme: {
      darkMode: string;
      description: string;
      lightMode: string;
      systemMode: string;
      title: string;
    };
    title: string;
    tray: {
      closeAndDisable: string;
      hide: string;
      keepInTray: string;
      notificationMessage: string;
      notificationTitle: string;
      quit: string;
      refreshApps: string;
      scoopApps: string;
      show: string;
    };
    trayApps: {
      availableApps: string;
      configure: string;
      enableTrayApps: string;
      enableTrayAppsDescription: string;
      manageContextMenu: string;
      manageTrayAppsDescription: string;
      noAvailableApps: string;
      noSelectedApps: string;
      selectedApps: string;
      title: string;
    };
    virustotal: {
      apiKey: string;
      apiKeyPlaceholder: string;
      autoScanPackages: string;
      description: string;
      invalidApiKey: string;
      loadError: string;
      loading: string;
      saveError: string;
      saveSuccess: string;
      title: string;
    };
    windowBehavior: {
      description: string;
      title: string;
    };
  };
  status: {
    cancelled: string;
    completed: string;
    error: string;
    failed: string;
    inProgress: string;
    loading: string;
    warning: string;
  };
  virustotal: {
    noThreats: string;
  };
  warnings: {
    multiInstance: {
      dontShowAgain: string;
      message: string;
      title: string;
    };
  };
  [key: string]: string | ((...args: any[]) => string) | any;
}
