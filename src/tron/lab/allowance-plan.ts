import type { TronAllowanceProbe } from './compiler.js';
export const allowanceCasePlan:ReadonlyArray<Readonly<{variant:TronAllowanceProbe;operation:'approve'|'transferFrom'}>>=Object.freeze(([
  {variant:'standard',operation:'approve'}, {variant:'standard',operation:'transferFrom'},
  {variant:'approve-false',operation:'approve'}, {variant:'approve-malformed',operation:'approve'}, {variant:'approve-missing-event',operation:'approve'}, {variant:'approve-wrong-allowance',operation:'approve'},
  {variant:'delegated-false',operation:'transferFrom'}, {variant:'delegated-malformed',operation:'transferFrom'}, {variant:'delegated-missing-event',operation:'transferFrom'}, {variant:'delegated-wrong-allowance',operation:'transferFrom'},
] satisfies Array<{variant:TronAllowanceProbe;operation:'approve'|'transferFrom'}>).map(x=>Object.freeze(x)));
