import { invoke } from '@tauri-apps/api/core';

export async function getCurrentVersionInstallTime(packageName: string): Promise<string> {
  try {
    const result = await invoke<string>('get_current_version_install_time', {
      packageName,
    });
    return result;
  } catch (error: unknown) {
    console.error('Failed to get current version install time:', error);
    return '';
  }
}
