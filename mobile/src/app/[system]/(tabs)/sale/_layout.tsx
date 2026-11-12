import { TabStack } from '@/components/tab-stack';
import { errorBoundary } from '@/components/error-screen';

/** The sale tab has its own stack: a native header with the search bar and the sets button. */
export default TabStack;

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('sale/layout');
