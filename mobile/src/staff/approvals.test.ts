/**
 * The owner's approval on the spot (phase S4): a token only after the owner's PIN, used once,
 * for its purpose, within two minutes; a wrong PIN gives nothing.
 */
import { Alert } from 'react-native';

import * as device from '@/security/device';

import { askOwner, takeApproval } from './approvals';

const typePin = (pin: string | null) =>
  jest.spyOn(Alert, 'prompt').mockImplementation((_t, _m, buttons) => {
    if (!Array.isArray(buttons)) return;
    if (pin === null) buttons.find((b) => b.text === 'إلغاء')?.onPress?.();
    else buttons.find((b) => b.text === 'موافقة')?.onPress?.(pin);
  });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(device, 'faceIdStatus').mockResolvedValue('none');
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

it('gives a token after the owner PIN, used once and only for its purpose', async () => {
  jest.spyOn(device.pinVault, 'verify').mockResolvedValue({ ok: true });
  typePin('19283746');
  const token = (await askOwner('jewelry', 'discount', 'خصم'))!;
  expect(takeApproval(token, 'return')).toBe(false);
  const again = (await askOwner('jewelry', 'discount', 'خصم'))!;
  expect(takeApproval(again, 'discount')).toBe(true);
  expect(takeApproval(again, 'discount')).toBe(false);
});

it('gives nothing for a wrong PIN or a cancel', async () => {
  jest
    .spyOn(device.pinVault, 'verify')
    .mockResolvedValue({ ok: false, attemptsLeft: 4, lockedUntil: 0 });
  typePin('00000000');
  expect(await askOwner('jewelry', 'return', 'مرتجع')).toBeNull();
  typePin(null);
  expect(await askOwner('jewelry', 'return', 'مرتجع')).toBeNull();
});

it('expires after two minutes', async () => {
  jest.spyOn(device.pinVault, 'verify').mockResolvedValue({ ok: true });
  typePin('19283746');
  // The clock is fixed while the approval is given: a slow run must not make it look newer.
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  const token = (await askOwner('jewelry', 'return', 'مرتجع'))!;
  clock.mockReturnValue(1_000_000 + 2 * 60_000 + 1);
  expect(takeApproval(token, 'return')).toBe(false);
});

it('uses Face ID first where it is set up', async () => {
  jest.spyOn(device, 'faceIdStatus').mockResolvedValue('ready');
  jest.spyOn(device, 'askFaceId').mockResolvedValue({ ok: true });
  const prompt = typePin('x');
  const token = await askOwner('jewelry', 'discount', 'خصم');
  expect(prompt).not.toHaveBeenCalled();
  expect(takeApproval(token!, 'discount')).toBe(true);
});
