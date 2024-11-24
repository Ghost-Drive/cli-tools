import {AuthConfig} from "./types/AuthConfig.js";
import fs from 'fs';

export async function getAuthConfig(): Promise<AuthConfig> {
    let rawData = fs.readFileSync('.data/auth.json', 'utf-8');
    let config: AuthConfig = JSON.parse(rawData);
    return config;
}

export function parseGDPath(url: string) {
    const regex = /^gd:\/\/([^\/]+)\/(.*)$/;
    const match = url.match(regex);

    if (match === null || match.length !== 3) {
        throw new Error('Invalid URL format');
    }

    const workspaceId = match[1];
    const filePath = match[2];

    return { workspaceId, filePath };
}