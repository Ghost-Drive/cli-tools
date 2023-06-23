import axios from 'axios';
import { GDStorage } from './types/GDStorage';
import { Workspace } from './types/Workspace';
import { Entry } from "./types/Entry";

class gdBackendClient {
    private backendUrl: string = '';

    constructor(backendUrl: string) {
        this.backendUrl = backendUrl;
    }

    async getDownloadOtt(slug:string): Promise<string> {
        return '';
    }

    async getDeleteOtt(slug:string, filePath: string): Promise<string> {
        return '';
    }

    async getUploadOtt(workspaceName:string, fileDetails:object): Promise<string> {
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

    async rm(workspaceName:string, fileSlug:string): Promise<boolean> {
        return true;
    }
}

export { gdBackendClient };
