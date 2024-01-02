import {GDStorage} from './types/GDStorage';
import {Workspace} from './types/Workspace';
import {Entry, EntryType} from "./types/Entry";
import {EntryEncryptedDetails} from "./types/EntryEncryptedDetails";
import {OTT, OTTAction} from "./types/OTT";
import * as forge from "node-forge";
import curlirize from 'axios-curlirize';


// @ts-ignore
import path from 'path';
import axios, {AxiosInstance} from 'axios';


class gdBackendClient {

    private readonly backendUrl: string;
    private readonly accessKey?: string;
    private readonly accessSecret?: string;
    private token?: string;
    private wsId: string;
    private authorizedAxios: AxiosInstance;

    constructor(backendUrl: string, accessKey?: string, accessSecret?: string, token?: string) {
        this.backendUrl = backendUrl;
        this.accessKey = accessKey;
        this.accessSecret = accessSecret;
        if (token !== undefined) {
            this.token = token;
        }
    }

    async *listFiles(workspaceName:string, dir:string): AsyncGenerator<Entry, void, undefined> {
        await this.auth();
        await this.setWS(workspaceName);

        let dirSlug;
        if (dir.length === 0 || dir === '.' || dir === '/') {
            dirSlug = '';
        } else {

            const entry = await this.entryDetails(workspaceName, dir);

            if (entry.type !== EntryType.FOLDER) {
                throw new Error(`${dir} is not a folder`);
            }

            dirSlug = entry.slug;
        }


        function mapFileRecordToEntry(fileRecord: any): Entry {
            return {
                name: fileRecord.name,
                slug: fileRecord.slug,
                path: '', // You need to provide a mapping for this or set a default.
                size: fileRecord.size.toString(),
                workspaceId: '', // Similarly, you need to provide a mapping for this or set a default.
                isClientsideEncrypted: fileRecord.isClientsideEncrypted,
                iv: '', // Not provided in the sample. Adjust as needed.
                sha3Hash: '', // Not provided in the sample. Adjust as needed.
                type: fileRecord.type === 1 ? EntryType.FILE : EntryType.FOLDER,
                clientsideKey: fileRecord.entry_clientside_key || ''
            };
        }

        let currentPage = 1;
        let totalCount = 0;

        do {
            let url = `${this.backendUrl}/files/${dirSlug}?page=${currentPage}&order_by=createdAt&order=asc`;

            const response =
                await this.authorizedAxios.get(url);

            // Update total count from the response
            totalCount = response.data.count;

            // Yield each record one by one after mapping
            for (const record of response.data.data) {
                yield mapFileRecordToEntry(record);
            }

            // Increment the current page for the next iteration
            currentPage += 1;
        } while ((currentPage - 1) * 15 < totalCount);  // Assuming each page contains 15 records.
    }


    async auth() {
        if (this.token === undefined) {
            const postData = {
                access_key: this.accessKey,
                access_secret: this.accessSecret
            };

            try {
                const response = await axios.post(
                    this.backendUrl + 'api/user/authorize',
                    JSON.stringify(postData),
             {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );

                this.token = response.data.token;

                this.authorizedAxios = axios.create({
                    headers: {
                        'X-Token': 'Bearer ' + this.token,
                    },
                });

            } catch (error) {
                this.logAxiosError(error);
                throw error;
            }
        }

    }

    async getDownloadOtt(workspaceId:string, entry:Entry): Promise<OTT> {
        await this.auth();
        await this.setWS(workspaceId);

        const data = { slug: entry.slug };

        try {
            const response = await axios.post(
                this.backendUrl + 'api/download/generate/token',
                data,
                {
                headers: {
                    'content-type': 'application/json',
                    'X-Token': 'Bearer ' + this.token
                }
            });

            return {
                filename: entry.name,
                filesize: entry.size,
                action: OTTAction.Download,
                endpoint: {
                    url: response.data.endpoint,
                    sameIpUpload: response.data.sameIpUpload
                },
                token: response.data.user_tokens.token
            };

        } catch (error) {
            this.logAxiosError(error);
        }
    }

    public async entryEncryptedDetails(file:Entry): Promise<EntryEncryptedDetails[]> {
        await this.auth();
        await this.setWS(file.workspaceId);
        const url = this.backendUrl + 'api/keys/get-encrypted-file-details?slug=' + file.slug;
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'X-Token': 'Bearer ' + this.token
        };

        try {
            const response = await axios.get(url, { headers });

            let result:EntryEncryptedDetails[]  = [];

            for (let i = 0; i < response.data.data.length; i++) {
                const item = response.data.data[i];
                /**
                 * const publicKey = forge.pki.publicKeyFromPem(pem);
                 *             const encryptedKey = await publicKey.encrypt(base64Key);
                 *             const encryptedHexKey = forge.util.bytesToHex(encryptedKey);
                 *             encryptedKeys.push({ publicKey: pem, encryptedFileKey: encryptedHexKey });
                 */
                result.push({
                    entrySlug: file.slug,
                    userAddress: item.user_public_address.public_address,
                    userPubKey: item.user_public_address.public_key,
                    encryptedKey: forge.util.hexToBytes(item.encrypted_key)
                });
            }

            return result;
        } catch (error) {
            this.logAxiosError(error);
        }
    }

    private async getWorkspaceKeys(): Promise<string[]> {
        // await this.auth();
        // await this.setWS(workspaceId);
        const url = this.backendUrl + 'api/keys/get_workspace';

        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'X-Token': 'Bearer ' + this.token
        };

        const response = await axios.get(url, { headers });

        if (!Array.isArray(response.data.keys)) {
            throw new Error('Unexpected response for workspace pem keys');
        }

        return response.data.keys;
    }

    public async entryDetails(workspaceId: string, filePath: string): Promise<Entry> {
        await this.auth();
        await this.setWS(workspaceId);

        const url = this.backendUrl + 'api/file/info';
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'X-Token': 'Bearer ' + this.token
        };

        try {

            const response = await axios.post(
                url,
                { 'path': filePath },
                { headers }
            );


            return {
                name: response.data.name,
                slug: response.data.slug,
                path: response.data.path,
                size: response.data.size,
                workspaceId: response.data.workspace_id,
                isClientsideEncrypted: response.data.isClientsideEncrypted,
                type: response.data.type,
                iv: response.data.iv,
                sha3Hash: response.data.sha3Hash,
                clientsideKey: null
            };

        } catch (error) {
            this.logAxiosError(error);
        }
    }


    private async setWS(workspaceId: string): Promise<boolean> {
        if (workspaceId !== this.wsId) {
            try {
                const headers = {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    'X-Token': 'Bearer ' + this.token
                };
                const response = await axios.get(
                    this.backendUrl + 'api/workspace/switch?workspace_id=' + workspaceId,
                    {
                        headers: headers
                    });

                this.token = response.data.token;
                this.wsId = workspaceId;
                return true;
            } catch (error) {
                this.logAxiosError(error);
            }
        }
    }

    public async createWorkspace(workspaceName: string): Promise<Workspace> {
        // works only for authentificated by oAuth token
        const data = { name: workspaceName };

        try {
            const url = this.backendUrl.replace(/\/+$/, '') + '/apiv2/workspace/create';

            const tokenHeader = this.accessKey === undefined ? 'Authorization' : 'X-Token';

            const response = await axios.post(
                url,
                data,
                {
                    headers: {
                        'content-type': 'application/json',
                        tokenHeader: 'Bearer ' + this.token,
                        'Authorization': 'Bearer ' + this.token
                    }
                });

            return {
                name: response.data.name,
                id: response.data.id
            };

        } catch (error) {
            this.logAxiosError(error);
        }
    }

    public async saveEncryptedKeyForWorkspaceUsers(slug: string, base64Key: string) {

        // Helper to encrypt keys
        const pems = await this.getWorkspaceKeys();
        let encryptedKeys = [];

        for (const pem of pems) {
            const publicKey = forge.pki.publicKeyFromPem(pem);
            const encryptedKey = await publicKey.encrypt(base64Key);
            const encryptedHexKey = forge.util.bytesToHex(encryptedKey);
            encryptedKeys.push({ publicKey: pem, encryptedFileKey: encryptedHexKey });
        }

        const resp = await this.authorizedAxios.post(
            this.backendUrl + `/keys/save_encrypted_file_keys`,
            {
                slug,
                encryptedKeys
            }
        );

        if (!resp.data.success) {
            throw new Error('Unexpected response when saving encrypted keys.');
        }

    }

    async getUploadOTT(workspaceId, entry) {

        try {
            await this.auth();
            await this.setWS(workspaceId);

            const data = {
                filesize: entry.size,
                filename: entry.name
            };

            const response = await this.authorizedAxios.post(
                this.backendUrl + "/user/generate/token",
                data,
                {
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'content-type': 'application/json'
                    }
                }
            );

            return {
                filename: entry.name,
                filesize: entry.size,
                action: OTTAction.Upload,
                endpoint: {
                    url: response.data.endpoint,
                    sameIpUpload: response.data.sameIpUpload
                },
                token: response.data.user_token.token
            };

        } catch (error) {
            this.logAxiosError(error);
        }
    }

    getThumbOtt = this.getUploadOTT;

    async getFolderSlug(workspaceId, destinationPath): Promise<string> {
        await this.auth();
        await this.setWS(workspaceId);
        destinationPath = destinationPath.replace(/^\/+|\/+$/g, '');
        try {
            const response = await this.authorizedAxios.post(
                this.backendUrl + "/folders/folder",
                {
                    name: destinationPath,
                    parent: null
                },
                {
                    headers: {
                        'accept': 'application/json, text/plain, */*',
                        'content-type': 'application/json',
                    }
                }
            );

            return response.data.data.slug;
        } catch (error) {
            this.logAxiosError(error);
        }
    }

    async deleteWorkspace(name:string): Promise<boolean> {
        return true;
    }

    public async listWorkspaces(): Promise<Workspace[]> {
        return [];
    }

    async rm(workspaceId:string, filePath:string): Promise<boolean> {

        try {
            let entry = await this.entryDetails(workspaceId, filePath);

            const response = await this.authorizedAxios({
                method: 'DELETE',
                url: this.backendUrl + 'api/files/multiply/delete',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                },
                data: [entry.slug]
            });

            return response.data.success;

        } catch (error) {
            this.logAxiosError(error);
        }
    }

    private logAxiosError(error) {
        // const errors = error?.response?.data?.errors ?? [error.message];
        const errors = error?.response?.data ?? [error.message];
        console.error(errors);
        throw error;
    }
}

export { gdBackendClient };
