import {Workspace} from './types/Workspace.js';
import {Entry, EntryType} from "./types/Entry.js";
import {EntryEncryptedDetails} from "./types/EntryEncryptedDetails.js";
import {OTT, OTTAction} from "./types/OTT.js";
import forge from "node-forge";
import axios, {AxiosInstance} from 'axios';


class gdBackendClient {

    private readonly backendUrl: string;
    private readonly accessKey?: string;
    private readonly accessSecret?: string;
    private jwt?: string;
    private accessToken?: string;
    private wsId!: string;
    private authorizedAxios!: AxiosInstance;

    constructor(backendUrl: string, accessKey?: string, accessSecret?: string, jwt?: string, accessToken?: string) {
        this.backendUrl = backendUrl;
        this.accessKey = accessKey;
        this.accessSecret = accessSecret;
        if (jwt !== undefined) {
            this.jwt = jwt;
        }

        if (accessToken !== undefined) {
            this.accessToken = accessToken;
        }
    }

    async *listFiles(workspaceName:string, dir:string): AsyncGenerator<Entry, void, undefined> {
        await this.auth();
        await this.setWS(workspaceName);

        let dirSlug;
        if (dir.length === 0 || dir === '.' || dir === '/') {
            dirSlug = '';
        } else {

            const entry = await this.getEntryDetails(workspaceName, dir);
            if (entry) {
                if (entry.type !== EntryType.FOLDER) {
                    throw new Error(`${dir} is not a folder`);
                }

                dirSlug = entry.slug;
            }
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
        let authHeaders = {};
        if (this.accessToken != undefined) {
            authHeaders['Authorization'] = 'Bearer ' + this.accessToken;
        }
        if (this.jwt != undefined) {
            authHeaders['X-Token'] = 'Bearer ' + this.jwt;
        }

        if (Object.keys(authHeaders).length === 0) {
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

                this.jwt = response.data.jwt;
                authHeaders['X-Token'] = 'Bearer ' + this.jwt;

            } catch (error) {
                this.logAxiosError(error);
                throw error;
            }
        }

        this.authorizedAxios = axios.create({
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*'
            },
        });

    }

    async getFileCids(slug: string): Promise<any> {
        const response: any = await this.authorizedAxios.get(
            this.backendUrl + 'api/cid/${slug}/interim'
        );
        return response.data;
    }

    async getDownloadOtt(workspaceId:string, entry:Entry): Promise<OTT|undefined> {
        await this.auth();
        await this.setWS(workspaceId);

        const data = { slug: entry.slug };

        try {
            const response = await this.authorizedAxios.post(
                this.backendUrl + 'api/download/generate/token',
                data
            );

            return {
                filename: entry.name,
                filesize: entry.size,
                action: OTTAction.Download,
                token: response.data.user_tokens.token,
                gateway: {
                    same_ip_upload: response.data.gateway.same_ip_upload,
                    id: response.data.gateway.id,
                    upload_chunk_size: response.data.gateway.upload_chunk_size,
                    interim_chunk_size: response.data.gateway.interim_chunk_size,
                    url: response.data.gateway.url,
                    type: response.data.gateway.type
                },
                storageProviders: response.data.storage_providers,
                isOnStorageProvider: response.data.is_on_storage_provider,
                uploadChunkSize: response.data.upload_chunk_size
            };

        } catch (error) {
            this.logAxiosError(error);
        }
    }

    public async entryEncryptedDetails(file:Entry): Promise<EntryEncryptedDetails[]> {
        await this.auth();
        await this.setWS(file.workspaceId);
        const url = this.backendUrl + 'api/keys/get-encrypted-file-details?slug=' + file.slug;

        try {
            const response = await this.authorizedAxios.get(url);

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

        return [];
    }

    private async getWorkspaceKeys(): Promise<string[]> {
        // await this.auth();
        // await this.setWS(workspaceId);
        const url = this.backendUrl + 'api/keys/get_workspace';

        const response = await this.authorizedAxios.get(url);

        if (!Array.isArray(response.data.keys)) {
            throw new Error('Unexpected response for workspace pem keys');
        }

        return response.data.keys;
    }

    public async getEntryDetails(workspaceId: string, filePath: string): Promise<Entry|undefined> {
        await this.auth();
        await this.setWS(workspaceId);

        const url = this.backendUrl + 'api/file/info';

        try {

            const response = await this.authorizedAxios.post(
                url,
                { 'path': filePath }
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
            if(error.response.status !== 404) {
                this.logAxiosError(error);
            }
        }
    }


    private async setWS(workspaceId: string): Promise<boolean> {
        if (workspaceId !== this.wsId) {
            try {
                const response = await this.authorizedAxios.get(
                    this.backendUrl + 'api/workspace/switch?workspace_id=' + workspaceId,
                );
                if (this.jwt) {
                    this.jwt = response.data.token;
                }
                this.wsId = workspaceId;
                return true;
            } catch (error) {
                this.logAxiosError(error);
            }
        }

        return false;
    }

    public async createWorkspace(workspaceName: string): Promise<Workspace|undefined> {
        await this.auth();

        // works only for authentificated by oAuth token
        const data = { name: workspaceName };

        try {
            const url = this.backendUrl.replace(/\/+$/, '') + '/apiv2/workspace/create';

            const response = await this.authorizedAxios.post(
                url,
                data
            );

            return {
                name: response.data.name,
                id: response.data.id
            };

        } catch (error) {
            this.logAxiosError(error);
        }
    }

    public async manageKey(slug: string, base64EncryptionKey: string): Promise<boolean> {
        const url = this.backendUrl + 'api/keys/manage-key';
        const data = {
            slug: slug,
            encryptionKey: base64EncryptionKey,
        };

        try {
            const resp = await this.authorizedAxios.post(
                url,
                data
            );
        } catch (error) {
            this.logAxiosError(error);
        }

        return true;
    }

    public async saveEncryptedKeyForWorkspaceUsers(slug: string, base64Key: string): Promise<boolean> {

        // Helper to encrypt keys
        const pems = await this.getWorkspaceKeys();
        let encryptedKeys: any[] = [];

        for (const pem of pems) {
            const publicKey = forge.pki.publicKeyFromPem(pem);
            const encryptedKey = await publicKey.encrypt(base64Key);
            const encryptedHexKey = forge.util.bytesToHex(encryptedKey);
            encryptedKeys.push({ publicKey: pem, encryptedFileKey: encryptedHexKey });
        }

        const resp = await this.authorizedAxios.post(
            this.backendUrl + `api/keys/save_encrypted_file_keys`,
            {
                slug,
                encryptedKeys
            }
        );

        if (!resp.data.success) {
            throw new Error('Unexpected response when saving encrypted keys.');
        }

        return true;
    }

    async getUploadOTT(workspaceId, entry): Promise<OTT|null> {

        try {
            await this.auth();
            await this.setWS(workspaceId);

            const data = {
                filesize: entry.size,
                filename: entry.name
            };

            const response = await this.authorizedAxios.post(
                this.backendUrl + "api/user/generate/token",
                data
            );

            return {
                filename: entry.name,
                filesize: entry.size,
                action: OTTAction.Upload,
                token: response.data.user_token.token,
                gateway: {
                    same_ip_upload: response.data.gateway.same_ip_upload,
                    id: response.data.gateway.id,
                    upload_chunk_size: response.data.gateway.upload_chunk_size,
                    interim_chunk_size: response.data.gateway.interim_chunk_size,
                    url: response.data.gateway.url,
                    type: response.data.gateway.type
                },
                storageProviders: response.data.storage_providers,
                isOnStorageProvider: response.data.is_on_storage_provider,
                uploadChunkSize: response.data.upload_chunk_size
            };

        } catch (error) {
            this.logAxiosError(error);
        }

        return null;
    }

    getThumbOtt = this.getUploadOTT;

    async getFolderSlug(workspaceId, destinationPath): Promise<string> {
        await this.auth();
        await this.setWS(workspaceId);
        destinationPath = destinationPath.replace(/^\/+|\/+$/g, '');
        try {
            const entry = await this.getEntryDetails(workspaceId, destinationPath);
            // console.log({entry});
            if (entry && entry.type === EntryType.FOLDER ) {
                return entry.slug;
            }
            const response = await this.authorizedAxios.post(
                this.backendUrl + "api/folders/folder",
                {
                    name: destinationPath,
                    parent: null
                }
            );

            return response.data.data.slug;
        } catch (error) {
            this.logAxiosError(error);
            throw error;
        }

    }

    public async listWorkspaces(): Promise<Workspace[]> {
        await this.auth();

        try {
            const response = await this.authorizedAxios.get(
                this.backendUrl + "api/user/workspaces"
            );

            return response.data.data.map((row: any) => {
                return {
                    id: row.workspace.id,
                    name: row.workspace.name,
                    slug: row.workspace.slug,
                    role: row.role
                };
            });
        } catch (error) {
            this.logAxiosError(error);
        }

        return [];
    }

    async rm(workspaceId:string, filePath:string): Promise<boolean> {

        try {
            let entry = await this.getEntryDetails(workspaceId, filePath);

            if (entry) {
                const response = await this.authorizedAxios({
                    method: 'DELETE',
                    url: this.backendUrl + 'api/files/multiply/delete',
                    data: [entry.slug]
                });

                return response.data.success;
            }

        } catch (error) {
            this.logAxiosError(error);
        }

        return false;
    }

    private logAxiosError(error) {
        // const errors = error?.response?.data?.errors ?? [error.message];
        const errors = error?.response?.data ?? [error.message];
        console.error(errors);
        throw error;
    }
}

export { gdBackendClient };
