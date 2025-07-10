import { SMALL, LARGE } from './constants';

export type Tick = {
  uuid: string
  size: typeof SMALL | typeof LARGE;
  rotation: number
  label?: string
};