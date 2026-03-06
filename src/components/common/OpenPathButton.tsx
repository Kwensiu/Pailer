import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { Folder } from 'lucide-solid';
import { toast } from './ToastAlert';

interface OpenPathButtonProps {
  /**
   * The path to open
   */
  path: string;
  /**
   * Whether to validate the path exists before opening
   */
  validatePath?: boolean;
  /**
   * Whether to show error toast if path doesn't exist or opening fails
   */
  showErrorToast?: boolean;
  /**
   * Custom tooltip text
   */
  tooltip?: string;
  /**
   * Additional CSS classes
   */
  class?: string;
  /**
   * Button size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

export default function OpenPathButton(props: OpenPathButtonProps) {
  const handleClick = async () => {
    try {
      if (props.validatePath) {
        const pathExists = await invoke<boolean>('path_exists', { path: props.path });
        if (!pathExists) {
          if (props.showErrorToast) {
            toast.error('Path does not exist');
          }
          return;
        }
      }

      await openPath(props.path);
    } catch (error) {
      console.error('Failed to open path:', error);
      if (props.showErrorToast) {
        toast.error('Failed to open directory');
      }
    }
  };

  const sizeClass = () => {
    switch (props.size) {
      case 'sm':
        return 'btn-sm';
      case 'lg':
        return 'btn-lg';
      default:
        return 'btn-sm';
    }
  };

  return (
    <button
      class={`btn btn-ghost ${sizeClass()} tooltip tooltip-bottom ${props.class || ''}`}
      data-tip={props.tooltip || 'Open Path'}
      onClick={handleClick}
    >
      <Folder class="h-5 w-5" />
    </button>
  );
}
