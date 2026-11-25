// Packs the working tree (or installs INKLING_FLOW_PACKAGE) once before the cases start.
import { installInkling, ROOT } from "./harness.mjs";

export default function setup() {
  const spec = installInkling();
  process.stderr.write(`inkling flow: installed ${spec}, runs in ${ROOT}/runs\n`);
}
