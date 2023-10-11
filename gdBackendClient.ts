import {GDStorage} from './types/GDStorage';
import {Workspace} from './types/Workspace';
import {Entry} from "./types/Entry";
import {EntryEncryptedDetails} from "./types/EntryEncryptedDetails";
import {OTT, OTTAction} from "./types/OTT";
import * as forge from "node-forge";


// @ts-ignore
import path from 'path';
import axios, { AxiosInstance } from 'axios';
import {Console} from "node:inspector";



class gdBackendClient {

    private readonly backendUrl: string;
    private readonly accessKey: string;
    private readonly accessSecret: string;
    private token: string;
    private wsId: string;
    private authorizedAxios: AxiosInstance;

    constructor(backendUrl: string, accessKey: string, accessSecret: string) {
        this.backendUrl = backendUrl;
        this.accessKey = accessKey;
        this.accessSecret = accessSecret;
    }

    async auth() {
        if (this.token === undefined) {
            const postData = {
                access_key: this.accessKey,
                access_secret: this.accessSecret
            };

            try {
                const response = await axios.post(
                    this.backendUrl + '/user/authorize',
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
                this.backendUrl + '/download/generate/token',
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
        const url = this.backendUrl + '/keys/get-encrypted-file-details?slug=' + file.slug;
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
        const url = this.backendUrl + '/keys/get_workspace';

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

        const url = this.backendUrl + '/file/info';
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
                    this.backendUrl + '/workspace/switch?workspace_id=' + workspaceId,
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

    //
    // async getDeleteOtt(slug:string, filePath: string): Promise<OTT> {
    //     return {
    //         filename: response.data.filename,
    //         filesize: response.data.filesize,
    //         action: OTTAction.Download,
    //         endpoint: {
    //             url: response.data.endpoint,
    //             sameIpUpload: response.data.sameIpUpload
    //         },
    //         token: response.data.user_token
    //     };
    // }
    //
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

    private logAxiosError(error) {
        // const errors = error?.response?.data?.errors ?? [error.message];
        const errors = error?.response?.data ?? [error.message];
        console.error(errors);
        throw error;
    }
}

export { gdBackendClient };
