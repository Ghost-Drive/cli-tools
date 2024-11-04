import {AuthConfig} from "./types/AuthConfig.js";
import fs from 'fs';

export async function loadCreds(): Promise<AuthConfig> {
  let rawData = fs.readFileSync('.data/auth.json', 'utf-8');
  let config: AuthConfig = JSON.parse(rawData);
  return config;
}