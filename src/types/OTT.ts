export enum OTTAction {
    Delete,
    Upload,
    Download,
}

export interface OTT {
    filename: string;
    filesize: string;
    action: OTTAction;
    gateway: any;
    storageProviders: StorageProviders;
    isOnStorageProvider: IsOnStorageProvider;
    token: string;
    uploadChunkSize: UploadChunkSize;
}

interface StorageProviders {
    [key: string]: null | undefined;
}

interface IsOnStorageProvider {
    [key: string]: boolean;
}

interface UploadChunkSize {
    [key: string]: null | number | undefined;
}
