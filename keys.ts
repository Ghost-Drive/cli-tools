// File: keys.ts

import * as fs from 'fs';
import * as path from 'path';

export function getKeys(): { mnemonic: string; key: string } {
    const keysPath = path.resolve(__dirname, '../.data/keys.json');
    const rawData = fs.readFileSync(keysPath, 'utf-8');
    const keys = JSON.parse(rawData);

    return keys;
}
