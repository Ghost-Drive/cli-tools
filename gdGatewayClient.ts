import axios from 'axios';
import { GDStorage } from './types/GDStorage';
import { Workspace } from './types/Workspace';
import { Entry } from "./types/Entry";

class gdGatewayClient {
    private gdGatewayUrl: '';

    constructor(gdGatewayUrl) {
        this.gdGatewayUrl = gdGatewayUrl;
    }

    async uploadFile(file:Blob, ott:string): Promise<string> {
        return '';
    }

    async downloadFile(fileSlug:string, ott:string): Promise<string> {
        return '';
    }

    async createWorkspace(name:string, storage:GDStorage): Promise<string> {
        return '11';
    }
    async deleteWorkspace(name:string): Promise<boolean> {
        return true;
    }

    async listWorkspaces(): Promise<Workspace[]> {
        return [];
    }

    async listFiles(workspaceName:string): Promise<Entry[]> {
        return [];
    }

    async deleteFile(workspaceName:string, fileSlug:string): Promise<boolean> {
        return true;
    }
}

export { gdGatewayClient };
