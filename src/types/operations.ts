import { ScoopPackage, ScoopInfo } from './scoop';

/**
 * Timestamp in milliseconds since epoch
 */
export type Timestamp = number;

/**
 * Output source type for operation logs
 */
export type OutputSource =
  | 'stdout'
  | 'stderr'
  | 'system'
  | 'custom'
  | 'command'
  | 'error'
  | 'success';

/**
 * Operation status enum
 */
export enum OperationStatus {
  InProgress = 'in-progress',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Cancelled = 'cancelled',
}

export const CANCEL_EVENT_PREFIX = 'cancel-operation:';

/**
 * Operation type enum
 */
export enum OperationType {
  Install = 'install',
  Uninstall = 'uninstall',
  Update = 'update',
  AutoUpdate = 'auto-update',
  UpdateAll = 'update-all',
}

/**
 * Next step configuration for operation modal
 */
export interface OperationNextStep {
  buttonLabel: string;
  onNext: () => void;
}

/**
 * Modal state for operation display
 */
export interface ModalState {
  operationTitle: string | null;
  operationNextStep: OperationNextStep | null;
  isScanning?: boolean;
}

/**
 * Package info modal state
 */
export interface PackageInfoModalState {
  selectedPackage: ScoopPackage | null;
  info: ScoopInfo | null;
  loading: boolean;
  error: string | null;
}

/**
 * Operation output interface
 * Represents a single line of output from an operation
 */
export interface OperationOutput {
  operationId: string;
  line: string;
  source: OutputSource;
  message?: string;
  timestamp: Timestamp;
}

/**
 * Operation result interface
 * Represents the final result of an operation
 */
export interface OperationResult {
  operationId: string;
  success: boolean;
  operationName: string;
  errorCount?: number;
  warningCount?: number;
  finalStatus?: OperationStatus;
  message?: string;
  timestamp: Timestamp;
  packageName?: string;
  packageSource?: string | null;
  packageState?: ScoopPackage;
}

/**
 * Minimized state interface
 * Represents the state of a minimized operation in the tray
 */
export interface MinimizedState {
  operationId: string;
  isMinimized: boolean;
  showIndicator: boolean;
  title: string;
  result?: OperationStatus;
  timestamp: Timestamp;
}

/**
 * Base operation state properties
 */
export interface BaseOperationState {
  id: string;
  title: string;
  status: OperationStatus;
  isMinimized: boolean;
  output: OperationOutput[];
  result?: OperationResult;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  scrollPosition?: number;
  wasAtBottom?: boolean;
}

/**
 * Scan operation specific properties
 */
export interface ScanOperationState {
  isScan: true;
  nextStep?: OperationNextStep;
}

/**
 * Package operation specific properties
 */
export interface PackageOperationState {
  isScan: false;
  operationType: OperationType;
  packageName: string;
  bucketName?: string;
  forceUpdate?: boolean;
  onInstallConfirm?: () => void;
  nextStep?: OperationNextStep;
}

/**
 * Operation state interface
 * Represents the complete state of an operation
 */
export type OperationState = BaseOperationState & (ScanOperationState | PackageOperationState);

/**
 * Minimized indicator props interface
 */
export interface MinimizedIndicatorProps {
  operationId: string;
  title: string;
  status: OperationStatus;
  isMinimized: boolean;
  visible: boolean;
  onClick: () => void;
  onClose?: () => void;
  index?: number;
}

/**
 * Operation modal props interface
 */
export interface OperationModalProps {
  operationId?: string;
  title: string | null;
  onClose: (operationId: string, wasSuccess: boolean) => void;
  onOperationFinished?: (operationId: string, wasSuccess: boolean) => void;
  nextStep?: OperationNextStep;
  isScan?: boolean;
  onInstallConfirm?: () => void;
}

/**
 * Operation queue management interface
 */
export interface OperationQueue {
  active: OperationState[];
  completed: OperationState[];
  maxConcurrent: number;
}

/**
 * Multi-instance warning configuration
 */
export interface MultiInstanceWarning {
  enabled: boolean;
  threshold: number;
  dismissed: boolean;
}

/**
 * Large dataset warning configuration for bucket search
 */
export interface LargeDatasetWarning {
  dismissed: boolean;
}
