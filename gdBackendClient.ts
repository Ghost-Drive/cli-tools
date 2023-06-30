import axios from 'axios';
import { GDStorage } from './types/GDStorage';
import { Workspace } from './types/Workspace';
import { Entry } from "./types/Entry";
import { OTTType } from "./types/OTTType";

class gdBackendClient {
    private backendUrl: string;
    private accessKeyId: string;
    private gdAccessKey: string;

    constructor(backendUrl: string, accessKeyId: string, gdAccessKey: string) {
        this.backendUrl = backendUrl;
        this.accessKeyId = accessKeyId;
        this.gdAccessKey = gdAccessKey;
    }

    async authTest() {
        return true;
    }

    async getDownloadOtt(slug:string): Promise<string> {
        return '';
    }

    async getDeleteOtt(slug:string, filePath: string): Promise<string> {
        return '';
    }

    async getUploadOtt(workspaceId:string, fileDetails:object): Promise<string> {
        return '';
    }

    async createWorkspace(name:string, storage:GDStorage): Promise<string> {
        return '11';
    }
    async deleteWorkspace(name:string): Promise<boolean> {
        return true;
    }

    public async listWorkspaces(): Promise<Workspace[]> {
        return [];
    }

    async listFiles(workspaceName:string): Promise<Entry[]> {
        return [];
    }

    async rm(workspaceName:string, fileSlug:string): Promise<boolean> {
        return true;
    }
}

export { gdBackendClient };
