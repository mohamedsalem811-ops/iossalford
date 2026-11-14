import { latinDigits } from './digits';

/**
 * A name as it is compared: digits 0-9, lower case, no spaces at the ends and single spaces
 * between words. Kept in customers.name_key (database 8) so a customer is found by name with an
 * index instead of reading every customer.
 */
export function nameKey(name: string): string {
  return latinDigits(name).toLowerCase().trim().split(/\s+/).join(' ');
}
