// File: aesService.ts

import forge from 'node-forge';

export class AesService {
    // This function will take a plaintext string and a key, and will return an encrypted string
    static encrypt(plaintext: string, key: string): string {
        const cipher = forge.cipher.createCipher('AES-CBC', forge.util.createBuffer(key));

        cipher.start({ iv: forge.random.getBytesSync(16) });
        cipher.update(forge.util.createBuffer(plaintext));
        cipher.finish();

        const encrypted = cipher.output;
        return forge.util.encode64(encrypted.getBytes());
    }

    // This function will take an encrypted string and a key, and will return the decrypted plaintext
    static decrypt(encrypted: string, key: string): string {
        const decipher = forge.cipher.createDecipher('AES-CBC', forge.util.createBuffer(key));

        decipher.start({ iv: forge.random.getBytesSync(16) });
        decipher.update(forge.util.createBuffer(forge.util.decode64(encrypted)));
        decipher.finish();

        const decrypted = decipher.output;
        return forge.util.decodeUtf8(decrypted.getBytes());
    }
}
