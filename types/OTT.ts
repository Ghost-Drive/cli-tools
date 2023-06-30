export enum OTTType { // @todo make it exact as on backend
    Upload,
    Download,
    Delete
}

export interface OTT {
    createdAt: string;
    expiredAt: string;
    action: number;
    token: string;
    filename: string;
    filesize: number;
    actionLabel: string;
}