// @todo use keypair generated based on seed phrase (same as on frontend) for encrypting / decrypting
class GDStore  {

    constructor(accessKeyId, secretAccessKey) { // @todo we will obtain these parameters from request and pass here or somehow from ctx
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
    }

    // Implement the required methods specified by the Store class

    // Add method definitions here
    async getObjectReadStream(workspaceId, key, range) {
        // Your implementation here
    }

    async getObjectMetadata(workspaceId, key) {
        // Your implementation here
    }

    async listObjects(workspaceId, prefix, delimiter, marker, maxKeys) {
        // Your implementation here
    }

    async putObject(workspaceId, key, metadata, createworkspaceIdIfNotExists, stream) {
        // Your implementation here
    }

    async copyObject(
        srcWorkspaceId,
        srcKey,
        destWorkspaceId,
        destKey,
        replaceMetadata,
        metadata
    ) {
        // Your implementation here // @todo require gd backend upgrade
    }

    async deleteObjects(workspaceId, keys) {
        // Your implementation here
    }

    async putSubresource(workspaceId, key, resource, path, contentType) {
        // Your implementation here // @todo require subresources storage development
    }

    async getSubresource(workspaceId, key, resource) {
        // Your implementation here
    }

    async deleteSubresource(workspaceId, key, resource) {
        // Your implementation here
    }
}

module.exports = {
    GDStore,
};