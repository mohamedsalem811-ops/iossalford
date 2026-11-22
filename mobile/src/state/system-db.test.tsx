/**
 * Who the actions run as (fail closed): an employee who was suspended, or no longer works in this
 * system (rule A), is nobody, so every action is refused even on a screen already open.
 */
import { render } from '@testing-library/react-native';

import { migrate } from '@/db/migrate';
import { openMemoryDb } from '@/db/testing/node-db';
import type { Ctx } from '@/domain/context';
import { EMPTY_STAFF, setActive, setWorksIn, type Staff } from '@/staff/model';
import { useStaffStore } from '@/staff/store';

import { setActor } from './session';
import { CtxProvider, useCtx } from './system-db';

const SARA = { kind: 'employee' as const, id: 's1', name: 'سارة' };
const staff: Staff = {
  ...EMPTY_STAFF,
  employees: [{ id: 's1', name: 'سارة', active: true, createdAt: '', mustChangePin: false }],
};

async function actorIn(system: 'jewelry' | 'scarves') {
  const db = openMemoryDb();
  migrate(db);
  let ctx: Ctx | null = null;
  const Read = () => {
    ctx = useCtx();
    return null;
  };
  await render(
    <CtxProvider db={db} system={system}>
      <Read />
    </CtxProvider>,
  );
  return () => ctx!.actor;
}

beforeEach(() => setActor(SARA));

it('is the employee in a system they work in', async () => {
  useStaffStore.setState({ staff });
  expect((await actorIn('jewelry'))()).toEqual(SARA);
});

it('is nobody in a system the owner unticked for them, or once suspended', async () => {
  useStaffStore.setState({ staff: setWorksIn(staff, 's1', 'jewelry', false) });
  expect((await actorIn('jewelry'))()).toBeNull();
  expect((await actorIn('scarves'))()).toEqual(SARA);
  useStaffStore.setState({ staff: setActive(staff, 's1', false) });
  expect((await actorIn('scarves'))()).toBeNull();
});
