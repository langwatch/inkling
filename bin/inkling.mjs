#!/usr/bin/env node
import { main } from "../src/cli.mjs";
import { updateNotice } from "../src/update.mjs";

const notice = updateNotice();
process.exitCode = await main(process.argv.slice(2));
process.stderr.write(await notice);
