import { ScoopPackage, ScoopInfo } from './scoop';

export interface OperationNextStep {
  buttonLabel: string;
  onNext: () => void;
}

export interface ModalState {
  operationTitle: string | null;
  operationNextStep: OperationNextStep | null;
  isScanning?: boolean;
}

export interface PackageInfoModalState {
  selectedPackage: ScoopPackage | null;
  info: ScoopInfo | null;
  loading: boolean;
  error: string | null;
}

// Operation output interface
export interface OperationOutput {
  operationId: string; // camelCase for consistency
  line: string;
  source: string; // Support custom source values
  message?: string; // Optional message property
  timestamp: number; // Milliseconds since epoch
}

// Operation result interface
export interface OperationResult {
  operationId: string; // camelCase for consistency
  success: boolean;
  operationName: string; // Raw operation name like "Installing maa"
  errorCount?: number; // Number of errors (if any)
  message?: string; // Legacy/custom messages (optional, for backward compatibility)
  timestamp: number; // Milliseconds since epoch
}

// Operation status
export type OperationStatus = 'in-progress' | 'success' | 'error' | 'cancelled';

// Minimized state interface
export interface MinimizedState {
  operationId: string;
  isMinimized: boolean;
  showIndicator: boolean;
  title: string;
  result?: OperationStatus;
  timestamp: number;
}

// Operation state interface
export interface OperationState {
  id: string;
  title: string;
  status: OperationStatus;
  isMinimized: boolean;
  output: OperationOutput[];
  result?: OperationResult;
  createdAt: number;
  updatedAt: number;
  isScan?: boolean;
  nextStep?: OperationNextStep;
  onInstallConfirm?: () => void;
  operationType?: 'install' | 'uninstall' | 'update' | 'auto-update';
  packageName?: string;
}

// Minimized indicator props interface
export interface MinimizedIndicatorProps {
  operationId: string;
  title: string;
  status: OperationStatus;
  isMinimized: boolean;
  visible: boolean;
  onClick: () => void;
  onClose?: () => void;
  index?: number; // For layout calculation
}

// Operation modal props interface
export interface OperationModalProps {
  operationId?: string;
  title: string | null;
  onClose: (operationId: string, wasSuccess: boolean) => void;
  onOperationFinished?: (operationId: string, wasSuccess: boolean) => void; // New callback for operation completion
  nextStep?: OperationNextStep;
  isScan?: boolean;
  onInstallConfirm?: () => void;
}

// Operation queue management interface
export interface OperationQueue {
  active: OperationState[];
  completed: OperationState[];
  maxConcurrent: number;
}

// Multi-instance warning configuration
export interface MultiInstanceWarning {
  enabled: boolean;
  threshold: number; // Operation count to trigger warning
  dismissed: boolean;
}
