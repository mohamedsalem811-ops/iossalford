import { TabStack } from '@/components/tab-stack';
import { errorBoundary } from '@/components/error-screen';

/** The receipts tab has its own stack: a native header with the search bar and filters. */
export default TabStack;

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('receipts/layout');
