import { defineConfig } from 'vitepress';

const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'Pailer';

export default defineConfig({
  title: 'Pailer Docs',
  description: 'Modern GUI for Scoop Package Manager',
  base: process.env.GITHUB_ACTIONS ? `/${repo}/` : '/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README-zh.md', 'I18N_ARCHITECTURE.md'],
  themeConfig: {
    socialLinks: [
      {
        icon: 'github',
        link: process.env.GITHUB_REPOSITORY
          ? `https://github.com/${process.env.GITHUB_REPOSITORY}`
          : 'https://github.com',
      },
    ],
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/',
      themeConfig: {
        nav: [
          { text: '关于 Pailer', link: '/introduction' },
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '使用指南', link: '/guide/search' },
        ],
        sidebar: [
          {
            text: '基础介绍',
            items: [
              { text: '关于 Pailer', link: '/introduction' },
              { text: '快速开始', link: '/guide/getting-started' },
            ],
          },
          {
            text: '使用指南',
            items: [
              { text: '搜索 - 发现软件', link: '/guide/search' },
              { text: '仓库 - 管理源', link: '/guide/buckets' },
              { text: '软件包 - 已安装', link: '/guide/installed' },
              { text: '诊断 - 系统健康', link: '/guide/doctor' },
              { text: '设置 - 个性化', link: '/guide/settings' },
            ],
          },
        ],
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'About Pailer', link: '/en/introduction' },
          { text: 'Getting Started', link: '/en/guide/getting-started' },
          { text: 'User Guide', link: '/en/guide/search' },
        ],
        sidebar: [
          {
            text: 'Introduction',
            items: [
              { text: 'About Pailer', link: '/en/introduction' },
              { text: 'Getting Started', link: '/en/guide/getting-started' },
            ],
          },
          {
            text: 'User Guide',
            items: [
              { text: 'Search - Discover Software', link: '/en/guide/search' },
              { text: 'Buckets - Manage Sources', link: '/en/guide/buckets' },
              { text: 'Packages - Installed', link: '/en/guide/installed' },
              { text: 'Doctor - System Health', link: '/en/guide/doctor' },
              { text: 'Settings - Personalization', link: '/en/guide/settings' },
            ],
          },
        ],
      },
    },
  },
});
