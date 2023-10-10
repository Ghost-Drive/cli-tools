export interface Entry {
    name: string;
    slug: string;
    path: string;
    size: string;
    workspaceId: string;
    isClientsideEncrypted: boolean;
    iv: string;
    sha3Hash: string;
    type: EntryType;
    clientsideKey: string;
}

export enum EntryType {
    FILE = 1,
    FOLDER = 2
}
